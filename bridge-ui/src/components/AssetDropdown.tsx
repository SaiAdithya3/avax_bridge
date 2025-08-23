import { useEffect, useState } from 'react';
import { API_URLS } from '../constants/constants';
import axios from 'axios';

// The backend expects asset keys (e.g., "bitcoin"), not symbols (e.g., "btc") in the params.
// So we must always use the asset key, not the symbol, in the value for the dropdown/options.

type Asset = {
  symbol: string;
  name: string;
  decimals: number;
  cmcId: number;
  // Optionally, assetKey?: string; // Not present in API, so we infer it below
};

type Chain = {
  id: string;
  name: string;
  rpcUrl?: string;
  assets: Asset[];
};

type SupportedAssetsResponse = {
  status: string;
  result: Chain[];
};

type AssetOption = {
  chainId: string;
  chainName: string;
  asset: Asset;
  assetKey: string; // The canonical asset key (e.g., "bitcoin")
};

const AssetDropdown = () => {
  const [options, setOptions] = useState<AssetOption[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await axios.get<SupportedAssetsResponse>(
          API_URLS.QUOTE + '/supported-assets'
        );
        const chains = res.data.result;
        const flatOptions: AssetOption[] = [];

        // To get the assetKey, we need to map symbol to assetKey.
        // We'll build a lookup from all assets in all chains.
        // This assumes that for each asset in a chain, the assetKey is unique for that symbol.
        // We'll build a map: symbol (lowercase) => assetKey
        const symbolToAssetKey: Record<string, string> = {};

        // First pass: build symbolToAssetKey from all assets in all chains
        chains.forEach((chain) => {
          chain.assets.forEach((asset) => {
            // The assetKey is not present in the asset object, but in the backend config it is the key in supportedAssets.
            // Here, we infer assetKey from the symbol, assuming uniqueness.
            // If the API ever returns assetKey, use that instead.
            // For now, we use a hardcoded mapping for known assets:
            if (asset.symbol.toLowerCase() === 'btc') symbolToAssetKey['btc'] = 'bitcoin';
            if (asset.symbol.toLowerCase() === 'avax') symbolToAssetKey['avax'] = 'avax';
            if (asset.symbol.toLowerCase() === 'usdt') symbolToAssetKey['usdt'] = 'usdt';
            // Add more mappings as needed
          });
        });

        // Second pass: build flatOptions with correct assetKey
        chains.forEach((chain) => {
          chain.assets.forEach((asset) => {
            const assetKey = symbolToAssetKey[asset.symbol.toLowerCase()] || asset.symbol.toLowerCase();
            flatOptions.push({
              chainId: chain.id,
              chainName: chain.name,
              asset,
              assetKey,
            });
          });
        });

        setOptions(flatOptions);
      } catch (err) {
        console.error('Failed to fetch supported assets', err);
      }
    };
    fetchAssets();
  }, []);

  return (
    <div>
      <select>
        {options.map((opt) => (
          <option
            key={`${opt.chainId}:${opt.assetKey}`}
            value={`${opt.chainId}:${opt.assetKey}`}
          >
            {opt.asset.symbol} ({opt.asset.name}) - {opt.chainName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssetDropdown;