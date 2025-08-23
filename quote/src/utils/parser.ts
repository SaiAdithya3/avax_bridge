import { config } from '../config';

export interface ParsedAsset {
  chain: string;
  asset: string;
}

/**
 * Parse chain:asset format (e.g., "arbitrum_sepolia:bitcoin")
 */
export function parseChainAsset(input: string): ParsedAsset | null {
  const parts = input.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [chain, asset] = parts;
  
  // Validate chain exists
  if (!config.supportedChains[chain]) {
    return null;
  }
  
  // Validate asset exists
  if (!config.supportedAssets[asset]) {
    return null;
  }

  return { chain, asset };
}

/**
 * Format asset for display (e.g., "bitcoin:btc")
 */
export function formatAssetDisplay(chain: string, asset: string): string {
  const assetInfo = config.supportedAssets[asset];
  if (!assetInfo) return `${chain}:${asset}`;
  
  return `${asset}:${assetInfo.symbol.toLowerCase()}`;
}

/**
 * Convert base amount to display amount
 */
export function baseToDisplay(amount: string, decimals: number): string {
  const baseAmount = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const whole = baseAmount / divisor;
  const fraction = baseAmount % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole}.${fractionStr}`;
}
