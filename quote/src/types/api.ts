// Base API Response structure
export interface ApiResponse<T> {
  status: 'Ok' | 'Error';
  result: T;
}

// Quote request parameters
export interface QuoteRequest {
  from: string;    // e.g., "arbitrum_sepolia:bitcoin"
  to: string;      // e.g., "avalanche_testnet:avax"
  amount: string;  // e.g., "1000000000" (in base units)
}

// Asset information
export interface AssetInfo {
  asset: string;      // e.g., "bitcoin:btc"
  amount: string;     // e.g., "10000" (in base units)
  display: string;    // e.g., "0.00010000" (human readable)
  value: string;      // e.g., "11.5723" (USD value)
}

// Quote result
export interface QuoteResult {
  source: AssetInfo;
  destination: AssetInfo;
}

// Quote response - can be either success with results or error with message
export type QuoteResponse = ApiResponse<QuoteResult[] | string>;

// Supported assets types
export interface SupportedAsset {
  symbol: string;
  name: string;
  decimals: number;
  cmcId: number;
}

export interface SupportedChain {
  id: string;
  name: string;
  rpcUrl?: string;
  assets: SupportedAsset[];
}

export type SupportedAssetsResponse = ApiResponse<SupportedChain[]>;

// Generic response utility types
export type SuccessResponse<T> = ApiResponse<T>;
export type ErrorResponse = ApiResponse<string>;

// Response utility functions
export function createSuccessResponse<T>(result: T): SuccessResponse<T> {
  return {
    status: 'Ok',
    result
  };
}

export function createErrorResponse(message: string): ErrorResponse {
  return {
    status: 'Error',
    result: message
  };
}
