import { CMCService } from './cmcService';
import { config } from '../config';

export interface AssetPrice {
  cmcId: number;
  symbol: string;
  price: number;
  usdValue: number;
  lastUpdated: string;
}

export interface ExchangeRate {
  fromAsset: string;
  toAsset: string;
  rate: number;
  fromPrice: number;
  toPrice: number;
}

export class PriceService {
  private cmcService: CMCService;
  private priceCache: Map<number, AssetPrice> = new Map();
  private cacheExpiry: Map<number, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.cmcService = new CMCService();
  }

  /**
   * Get current price for an asset
   */
  async getAssetPrice(asset: string): Promise<AssetPrice> {
    const assetInfo = config.supportedAssets[asset];
    if (!assetInfo) {
      throw new Error(`Unsupported asset: ${asset}`);
    }

    const now = Date.now();
    const cached = this.priceCache.get(assetInfo.cmcId);
    
    // Return cached price if still valid
    if (cached && this.cacheExpiry.get(assetInfo.cmcId)! > now) {
      return cached;
    }

    try {
      const price = await this.cmcService.getPrice(assetInfo.cmcId);
      
      const assetPrice: AssetPrice = {
        cmcId: assetInfo.cmcId,
        symbol: assetInfo.symbol,
        price,
        usdValue: price, // For now, assuming 1:1 with USD for simplicity
        lastUpdated: new Date().toISOString()
      };

      // Cache the price
      this.priceCache.set(assetInfo.cmcId, assetPrice);
      this.cacheExpiry.set(assetInfo.cmcId, now + this.CACHE_DURATION);

      return assetPrice;

    } catch (error) {
      console.error(`Error fetching price for ${asset}:`, error);
      
      // Return cached price if available (even if expired)
      if (cached) {
        console.log(`Using cached price for ${asset}`);
        return cached;
      }
      
      throw error;
    }
  }

  /**
   * Get exchange rate between two assets
   */
  async getExchangeRate(fromAsset: string, toAsset: string): Promise<ExchangeRate> {
    const [fromPrice, toPrice] = await Promise.all([
      this.getAssetPrice(fromAsset),
      this.getAssetPrice(toAsset)
    ]);

    const rate = fromPrice.price / toPrice.price;

    return {
      fromAsset,
      toAsset,
      rate,
      fromPrice: fromPrice.price,
      toPrice: toPrice.price
    };
  }

  /**
   * Calculate destination amount based on exchange rate
   */
  async calculateDestinationAmount(
    fromAsset: string,
    toAsset: string,
    fromAmount: string
  ): Promise<{ toAmount: string; exchangeRate: number; fromUsdValue: number; toUsdValue: number }> {
    const exchangeRate = await this.getExchangeRate(fromAsset, toAsset);
    const fromAssetInfo = config.supportedAssets[fromAsset];
    const toAssetInfo = config.supportedAssets[toAsset];

    if (!fromAssetInfo || !toAssetInfo) {
      throw new Error('Asset info not found');
    }

    // Convert from base units to human readable
    const fromAmountHuman = parseFloat(fromAmount) / Math.pow(10, fromAssetInfo.decimals);
    
    // Calculate destination amount in human readable format
    const toAmountHuman = fromAmountHuman * exchangeRate.rate;
    
    // Convert back to base units
    const toAmount = Math.floor(toAmountHuman * Math.pow(10, toAssetInfo.decimals)).toString();
    
    // Calculate USD values
    const fromUsdValue = fromAmountHuman * exchangeRate.fromPrice;
    const toUsdValue = toAmountHuman * exchangeRate.toPrice;

    return {
      toAmount,
      exchangeRate: exchangeRate.rate,
      fromUsdValue,
      toUsdValue
    };
  }

  /**
   * Get USD value for an amount in base units
   */
  async getUsdValue(asset: string, amount: string): Promise<number> {
    const assetPrice = await this.getAssetPrice(asset);
    const assetInfo = config.supportedAssets[asset];
    
    if (!assetInfo) {
      throw new Error(`Asset info not found for ${asset}`);
    }

    const amountHuman = parseFloat(amount) / Math.pow(10, assetInfo.decimals);
    return amountHuman * assetPrice.price;
  }
}
