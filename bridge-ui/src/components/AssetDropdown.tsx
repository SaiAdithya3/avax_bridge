import { useRef } from "react";
import { useAssetsStore, type AssetOption } from "../store/assetsStore";
import { motion, AnimatePresence } from "framer-motion";
import avalancheLogo from "../assets/avalanche-avax-logo.svg";

// Asset and chain logo URLs (not JSX)
const ASSET_LOGOS: Record<string, string> = {
  wbtc: "https://garden.imgix.net/token-images/wbtc.svg",
  avax: avalancheLogo,
  usdt: "https://garden.imgix.net/token-images/usdt.svg",
  bitcoin: "https://garden.imgix.net/token-images/bitcoin.svg",
};

const CHAIN_LOGOS: Record<string, string> = {
  'Arbitrum Sepolia': "https://garden.imgix.net/chain_images/arbitrumSepolia.svg",
  'Avalanche Testnet': avalancheLogo,
  'Bitcoin Testnet': "https://garden.imgix.net/token-images/bitcoin.svg",
};

function getAssetLogo(symbol: string) {
  const key = symbol.toLowerCase();
  let url: string | undefined;
  if (key === "btc" || key === "bitcoin") url = ASSET_LOGOS.bitcoin;
  else if (key === "usdt") url = ASSET_LOGOS.usdt;
  else if (key === "wbtc") url = ASSET_LOGOS.wbtc;
  else if (key === "avax") url = ASSET_LOGOS.avax;

  if (url) {
    if (url.startsWith("data:") || url.startsWith("/") || url.startsWith("static/") || url.endsWith(".svg")) {
      return (
        <img
          src={url}
          alt={symbol}
          className="w-6 h-6 rounded-full object-contain"
          style={{ background: "#fff" }}
        />
      );
    }
    // fallback
    return (
      <img
        src={url}
        alt={symbol}
        className="w-6 h-6 rounded-full object-contain"
        style={{ background: "#fff" }}
      />
    );
  }
  return (
    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
      {symbol.charAt(0)}
    </div>
  );
}

function getChainLogo(chainName: string) {
  const url = CHAIN_LOGOS[chainName];
  if (url) {
    // avalancheLogo is imported as a module, others are URLs
    if (typeof url === "string") {
      return (
        <img
          src={url}
          alt={chainName}
          className="w-5 h-5 rounded-full object-contain"
          style={{ background: "#fff" }}
        />
      );
    }
  }
  return (
    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-500">
      {chainName.charAt(0)}
    </div>
  );
}

export const AssetDropdown: React.FC<{
  type: "from" | "to";
  selectedAsset: AssetOption | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (asset: AssetOption) => void;
}> = ({ type, selectedAsset, isOpen, onToggle, onSelect }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { assets, fromAsset, toAsset } = useAssetsStore();

  const getFilteredAssets = (type: "from" | "to") => {
    if (type === "from") {
      return assets.filter(
        (asset) => !toAsset || asset.value !== toAsset.value
      );
    } else {
      return assets.filter(
        (asset) => !fromAsset || asset.value !== fromAsset.value
      );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm"
      >
        <div className="flex items-center gap-3">
          {selectedAsset ? (
            <>
              <div className="flex items-center">
                {getAssetLogo(selectedAsset.asset.symbol)}
              </div>
                <span className="font-semibold text-gray-900 text-base leading-tight">
                  {selectedAsset.asset.symbol}
                </span>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1 mt-0.5">
                  {getChainLogo(selectedAsset.chainName)}
                  <span className="text-xs text-gray-500 font-medium ml-1">{selectedAsset.chainName}</span>
                </div>
              </div>
            </>
          ) : (
            <span className="text-gray-400 font-medium text-base">Select asset</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto"
          >
            {getFilteredAssets(type).length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-base font-medium">
                <span className="inline-flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  No assets available
                </span>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between flex-col gap-2">
                {getFilteredAssets(type).map((asset) => {
                  const isSelected = selectedAsset && selectedAsset.value === asset.value;
                  return (
                    <button
                      key={asset.value}
                      onClick={() => onSelect(asset)}
                      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-150 group
                        ${isSelected
                          ? "bg-[#e84142]/5 border-2 border-[#e84142]/70 shadow"
                          : "hover:bg-gray-50 border border-transparent"
                        } focus:outline-none`}
                    >
                      <div className="flex items-center w-full">
                        {/* Asset logo and symbol */}
                        <div className="flex items-center gap-2 pr-3 border-gray-200 min-w-0">
                          {getAssetLogo(asset.asset.symbol)}
                          <span className="font-semibold text-gray-900 text-base leading-tight truncate">
                            {asset.asset.symbol}
                          </span>
                        </div>
                        {/* Chain logo and name */}
                        <div className="flex items-center gap-1 min-w-0 ml-4">
                          {getChainLogo(asset.chainName)}
                          <span className="text-xs text-gray-500 font-medium ml-1 truncate">
                            {asset.chainName}
                          </span>
                        </div>
                        {/* Selected checkmark */}
                        {isSelected && (
                          <span className="ml-auto flex items-center">
                            <svg
                              className="w-5 h-5 text-[#e84142] flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
