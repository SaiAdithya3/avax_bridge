import { config } from '../config';
import { SupportedChain, SupportedAssetsResponse, createSuccessResponse } from '../types/api';

export class SupportedAssetsService {
  /**
   * Get all supported chains with their assets
   */
  getSupportedAssets(): SupportedAssetsResponse {
    const supportedChains: SupportedChain[] = [];

    for (const [, chain] of Object.entries(config.supportedChains)) {
      const assets = chain.supportedAssets.map(assetKey => {
        const asset = config.supportedAssets[assetKey];
        return {
          symbol: asset.symbol,
          name: asset.name,
          decimals: asset.decimals,
          cmcId: asset.cmcId
        };
      });

      supportedChains.push({
        id: chain.id,
        name: chain.name,
        rpcUrl: chain.rpcUrl,
        assets
      });
    }

    return createSuccessResponse(supportedChains);
  }

  /**
   * Get supported assets for a specific chain
   */
  getSupportedAssetsForChain(chainId: string): SupportedAssetsResponse {
    const chain = config.supportedChains[chainId];
    
    if (!chain) {
      return createSuccessResponse([]);
    }

    const assets = chain.supportedAssets.map(assetKey => {
      const asset = config.supportedAssets[assetKey];
      return {
        symbol: asset.symbol,
        name: asset.name,
        decimals: asset.decimals,
        cmcId: asset.cmcId
      };
    });

    const supportedChain: SupportedChain = {
      id: chain.id,
      name: chain.name,
      rpcUrl: chain.rpcUrl,
      assets
    };

    return createSuccessResponse([supportedChain]);
  }
}
