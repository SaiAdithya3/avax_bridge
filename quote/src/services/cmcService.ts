import { config } from '../config';

export interface CMCQuote {
  price: number;
  volume_24h: number;
  market_cap: number;
  last_updated: string;
}

export interface CMCResponse {
  data: Record<string, {
    id: number;
    name: string;
    symbol: string;
    quote: {
      USD: CMCQuote;
    };
  }>;
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
  };
}

export class CMCService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.coinMarketCap.apiKey;
    this.baseUrl = config.coinMarketCap.baseUrl;
  }

  /**
   * Fetch latest prices for multiple cryptocurrencies
   */
  async getLatestPrices(cmcIds: number[]): Promise<Record<number, CMCQuote>> {
    try {
      if (!this.apiKey) {
        throw new Error('CMC API key not configured');
      }

      if (cmcIds.length === 0) {
        return {};
      }

      const ids = cmcIds.join(',');
      const url = `${this.baseUrl}/cryptocurrency/quotes/latest?id=${ids}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-CMC_PRO_API_KEY': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CMC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as CMCResponse;

      if (data.status.error_code !== 0) {
        throw new Error(`CMC API error: ${data.status.error_message}`);
      }

      const prices: Record<number, CMCQuote> = {};
      
      for (const [id, coin] of Object.entries(data.data)) {
        prices[parseInt(id)] = coin.quote.USD;
      }

      return prices;

    } catch (error) {
      console.error('Error fetching CMC prices:', error);
      throw error;
    }
  }

  /**
   * Get price for a single cryptocurrency
   */
  async getPrice(cmcId: number): Promise<number> {
    const prices = await this.getLatestPrices([cmcId]);
    const price = prices[cmcId];
    
    if (!price) {
      throw new Error(`Price not found for CMC ID: ${cmcId}`);
    }
    
    return price.price;
  }

  /**
   * Calculate exchange rate between two assets
   */
  async getExchangeRate(fromCmcId: number, toCmcId: number): Promise<number> {
    const [fromPrice, toPrice] = await Promise.all([
      this.getPrice(fromCmcId),
      this.getPrice(toCmcId)
    ]);

    return fromPrice / toPrice;
  }
}
