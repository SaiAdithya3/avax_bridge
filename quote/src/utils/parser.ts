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
  
  // Validate asset exists globally
  if (!config.supportedAssets[asset]) {
    return null;
  }

  // Validate asset is supported on the specified chain
  if (!config.supportedChains[chain].supportedAssets.includes(asset)) {
    return null;
  }

  return { chain, asset };
}

/**
 * Get all valid chain:asset combinations for error messages
 */
export function getValidChainAssetCombinations(): string[] {
  const combinations: string[] = [];
  
  for (const [chainId, chain] of Object.entries(config.supportedChains)) {
    for (const asset of chain.supportedAssets) {
      combinations.push(`${chainId}:${asset}`);
    }
  }
  
  return combinations;
}

/**
 * Validate if a chain:asset combination is supported
 */
export function isValidChainAsset(chain: string, asset: string): boolean {
  return config.supportedChains[chain]?.supportedAssets.includes(asset) ?? false;
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
  try {
    // Handle very large numbers by using Number first, then converting to string
    const baseAmount = parseFloat(amount);
    const divisor = Math.pow(10, decimals);
    
    const result = baseAmount / divisor;
    
    // Format with proper decimal places, removing trailing zeros
    return result.toFixed(decimals).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error converting base to display:', error);
    return '0';
  }
}
