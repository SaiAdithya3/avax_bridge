import React, { useEffect, useState } from 'react';
import { useAssetsStore, type AssetOption } from '../store/assetsStore';
import { motion, AnimatePresence } from 'framer-motion';
import {AssetDropdown} from './AssetDropdown';
import { createOrder } from '../services/orderService';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import { useEVMWallet } from '../hooks/useEVMWallet';
import OrderDetails from './OrderDetails';

const Swap: React.FC = () => {
  const {
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

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState<'from' | 'to' | null>(null);
  const { account: btcAddress } = useBitcoinWallet();
  const { address: evmAddress } = useEVMWallet();
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

  // Show OrderDetails if order was created
  if (createdOrderId) {
    return (
      <OrderDetails 
        orderId={createdOrderId} 
        onBack={() => setCreatedOrderId(null)} 
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className=" relative w-full flex items-center flex-col rounded-3xl p-6">
        
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
        <div className=" bg-white mb-2 w-full rounded-2xl shadow-lg border border-gray-100 p-6">
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
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e84142]/70 focus:border-transparent"
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

        <div className="flex -my-2 top-52 w-full items-center absolute justify-center ">
          <motion.button
            whileHover={{ scale: 1, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={swapAssets}
            transition={{ duration: 0.2, ease: "linear" }}
            disabled={!fromAsset || !toAsset}
            className="p-2 bg-[#e84142]/70 border border-[#e84142]/70 hover:bg-[#e84142]/80  rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </motion.button>
        </div>

        {/* To Asset */}
        <div className="mb-2 w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
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
          className="w-full py-3 px-4 bg-[#e84142] text-white font-medium rounded-2xl hover:bg-[#e84142] focus:outline-none focus:ring-2 focus:ring-[#e84142]/70 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={async () => {
            try {
              const result = await createOrder({
                btcAddress: btcAddress || '',
                evmAddress: evmAddress || '',
                fromAsset: fromAsset!,
                toAsset: toAsset!,
                sendAmount: sendAmount || '',
                receiveAmount: receiveAmount || '',
              });
              
              if (result.status === 'ok' && result.result) {
                setCreatedOrderId(result.result);
              }
            } catch (error) {
              console.error('Failed to create order:', error);
            }
          }}
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
