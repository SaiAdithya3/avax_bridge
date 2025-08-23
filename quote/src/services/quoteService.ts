import { QuoteRequest, QuoteResponse, QuoteResult, createSuccessResponse, createErrorResponse } from '../types/api';
import { parseChainAsset, formatAssetDisplay, baseToDisplay } from '../utils/parser';
import { config } from '../config';

export class QuoteService {
  /**
   * Generate a quote for cross-chain swap
   */
  generateQuote(request: QuoteRequest): QuoteResponse {
    try {
      // Parse and validate inputs
      const fromAsset = parseChainAsset(request.from);
      const toAsset = parseChainAsset(request.to);
      
      if (!fromAsset || !toAsset) {
        return createErrorResponse('Invalid from or to asset format');
      }

      // Get asset info
      const fromAssetInfo = config.supportedAssets[fromAsset.asset];
      const toAssetInfo = config.supportedAssets[toAsset.asset];
      
      if (!fromAssetInfo || !toAssetInfo) {
        return createErrorResponse('Unsupported asset');
      }

      // Convert amount to display format
      const fromDisplay = baseToDisplay(request.amount, fromAssetInfo.decimals);
      
      // Dummy exchange rate (we'll replace this with real CMC data later)
      const dummyExchangeRate = 15000; // 1 BTC = 15000 AVAX (example)
      
      // Calculate destination amount (dummy calculation)
      const fromAmountBase = BigInt(request.amount);
      const toAmountBase = fromAmountBase * BigInt(Math.floor(dummyExchangeRate * 1000000)) / BigInt(1000000);
      
      // Format destination amount
      const toDisplay = baseToDisplay(toAmountBase.toString(), toAssetInfo.decimals);
      
      // Dummy USD values (we'll replace with real CMC data later)
      const fromValue = "11.5723"; // Dummy USD value
      const toValue = "11.5376";   // Dummy USD value

      const quoteResult: QuoteResult = {
        source: {
          asset: formatAssetDisplay(fromAsset.chain, fromAsset.asset),
          amount: request.amount,
          display: fromDisplay,
          value: fromValue
        },
        destination: {
          asset: formatAssetDisplay(toAsset.chain, toAsset.asset),
          amount: toAmountBase.toString(),
          display: toDisplay,
          value: toValue
        }
      };

      return createSuccessResponse([quoteResult]);

    } catch (error) {
      console.error('Error generating quote:', error);
      return createErrorResponse('Failed to generate quote');
    }
  }
}
