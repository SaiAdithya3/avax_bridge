import { QuoteRequest, QuoteResponse, QuoteResult, createSuccessResponse, createErrorResponse } from '../types/api';
import { parseChainAsset, formatAssetDisplay, baseToDisplay, getValidChainAssetCombinations } from '../utils/parser';
import { config } from '../config';
import { PriceService } from './priceService';

export class QuoteService {
  private priceService: PriceService;

  constructor() {
    this.priceService = new PriceService();
  }

  /**
   * Generate a quote for cross-chain swap
   */
  async generateQuote(request: QuoteRequest): Promise<QuoteResponse> {
    try {
      // Parse and validate inputs
      const fromAsset = parseChainAsset(request.from);
      const toAsset = parseChainAsset(request.to);
      
      if (!fromAsset || !toAsset) {
        const validCombinations = getValidChainAssetCombinations();
        return createErrorResponse(`Invalid chain:asset format. Valid combinations: ${validCombinations.join(', ')}`);
      }

      // Get asset info
      const fromAssetInfo = config.supportedAssets[fromAsset.asset];
      const toAssetInfo = config.supportedAssets[toAsset.asset];
      
      if (!fromAssetInfo || !toAssetInfo) {
        return createErrorResponse('Unsupported asset');
      }

      // Convert amount to display format
      const fromDisplay = baseToDisplay(request.amount, fromAssetInfo.decimals);
      
      // Get real exchange rate and calculate destination amount
      const calculation = await this.priceService.calculateDestinationAmount(
        fromAsset.asset,
        toAsset.asset,
        request.amount
      );
      
      // Format destination amount
      const toDisplay = baseToDisplay(calculation.toAmount, toAssetInfo.decimals);

      const quoteResult: QuoteResult = {
        source: {
          asset: formatAssetDisplay(fromAsset.chain, fromAsset.asset),
          amount: request.amount,
          display: fromDisplay,
          value: calculation.fromUsdValue.toFixed(4)
        },
        destination: {
          asset: formatAssetDisplay(toAsset.chain, toAsset.asset),
          amount: calculation.toAmount,
          display: toDisplay,
          value: calculation.toUsdValue.toFixed(4)
        }
      };

      return createSuccessResponse([quoteResult]);

    } catch (error) {
      console.error('Error generating quote:', error);
      return createErrorResponse('Failed to generate quote');
    }
  }
}
