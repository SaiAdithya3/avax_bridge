import React, { useEffect, useState, useRef } from 'react';
import { useAssetsStore, type AssetOption } from '../store/assetsStore';
import { motion, AnimatePresence } from 'framer-motion';

const Swap: React.FC = () => {
  const {
    assets,
    fromAsset,
    toAsset,
    sendAmount,
    receiveAmount,
    isLoading,
    isQuoteLoading,
    error,
    fetchAssets,
    setFromAsset,
    setToAsset,
    setSendAmount,
    swapAssets,
    clearError,
  } = useAssetsStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState<'from' | 'to' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAssetSelect = (asset: AssetOption, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromAsset(asset);
    } else {
      setToAsset(asset);
    }
    setIsDropdownOpen(null);
  };

  const getFilteredAssets = (type: 'from' | 'to') => {
    if (type === 'from') {
      // For "from" dropdown, exclude the selected "to" asset
      return assets.filter(asset => !toAsset || asset.value !== toAsset.value);
    } else {
      // For "to" dropdown, exclude the selected "from" asset
      return assets.filter(asset => !fromAsset || asset.value !== fromAsset.value);
    }
  };

  const AssetDropdown: React.FC<{
    type: 'from' | 'to';
    selectedAsset: AssetOption | null;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (asset: AssetOption) => void;
  }> = ({ type, selectedAsset, isOpen, onToggle, onSelect }) => (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <div className="flex items-center space-x-2">
          {selectedAsset ? (
            <>
              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                {selectedAsset.asset.symbol.charAt(0)}
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">{selectedAsset.asset.symbol}</div>
                <div className="text-xs text-gray-500">{selectedAsset.chainName}</div>
              </div>
            </>
          ) : (
            <span className="text-gray-500">Select asset</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {getFilteredAssets(type).map((asset) => (
              <button
                key={asset.value}
                onClick={() => onSelect(asset)}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
              >
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                  {asset.asset.symbol.charAt(0)}
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium text-gray-900">{asset.asset.symbol}</div>
                  <div className="text-xs text-gray-500">{asset.chainName}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Bridge Assets</h2>
        
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-red-700 text-sm">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* From Asset */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
          <AssetDropdown
            type="from"
            selectedAsset={fromAsset}
            isOpen={isDropdownOpen === 'from'}
            onToggle={() => setIsDropdownOpen(isDropdownOpen === 'from' ? null : 'from')}
            onSelect={(asset) => handleAssetSelect(asset, 'from')}
          />
          <div className="relative mt-2">
            <input
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.0"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!fromAsset}
              autoComplete="off"
            />
            {isQuoteLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={swapAssets}
            disabled={!fromAsset || !toAsset}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </motion.button>
        </div>

        {/* To Asset */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
          <AssetDropdown
            type="to"
            selectedAsset={toAsset}
            isOpen={isDropdownOpen === 'to'}
            onToggle={() => setIsDropdownOpen(isDropdownOpen === 'to' ? null : 'to')}
            onSelect={(asset) => handleAssetSelect(asset, 'to')}
          />
          <div className="relative mt-2">
            <input
              type="number"
              placeholder="0.0"
              value={receiveAmount}
              readOnly
              className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
              disabled={!toAsset}
            />
            {isQuoteLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Bridge Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!fromAsset || !toAsset || !sendAmount || isLoading || isQuoteLoading}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              Loading Assets...
            </div>
          ) : isQuoteLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              Getting Quote...
            </div>
          ) : (
            'Bridge Assets'
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default Swap;
