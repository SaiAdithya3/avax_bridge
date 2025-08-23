import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Shield, Zap } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import { Network } from '@gardenfi/utils';

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
  onEVMConnect: (connector: any) => void;
  onBTCConnect: (wallet: any) => void;
  loadingEVM: boolean;
  loadingBTC: boolean;
}

export const ConnectWalletModal = ({
  open,
  onClose,
  onEVMConnect,
  onBTCConnect,
  loadingEVM,
  loadingBTC,
}: ConnectWalletModalProps) => {
  const { connectors } = useEVMWallet();
  const { availableWallets, connect, network } = useBitcoinWallet();

  const [activeTab, setActiveTab] = useState<'evm' | 'btc'>('evm');

  const handleEVMConnect = async (connector: any) => {
    try {
      await onEVMConnect(connector);
    } catch (error) {
      console.error('Failed to connect EVM wallet:', error);
    }
  };

  const handleBTCConnect = async (wallet: any) => {
    try {
      if (typeof connect === 'function') {
        await connect(wallet, network as Network);
      }
      onBTCConnect(wallet);
    } catch (error) {
      console.error('Failed to connect BTC wallet:', error);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-display font-semibold text-gray-900">
                Connect Wallet
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4">
              <div className="flex space-x-2">
                <button
                  className={`flex-1 py-2 rounded-t-lg font-semibold text-sm transition-colors ${
                    activeTab === 'evm'
                      ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-500'
                      : 'bg-gray-50 text-gray-600 border-b-2 border-transparent hover:bg-gray-100'
                  }`}
                  onClick={() => setActiveTab('evm')}
                >
                  EVM Wallets
                </button>
                <button
                  className={`flex-1 py-2 rounded-t-lg font-semibold text-sm transition-colors ${
                    activeTab === 'btc'
                      ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                      : 'bg-gray-50 text-gray-600 border-b-2 border-transparent hover:bg-gray-100'
                  }`}
                  onClick={() => setActiveTab('btc')}
                >
                  Bitcoin Wallets
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 pt-4">
              <div className="flex flex-col md:flex-row md:space-x-6">
                {/* EVM Wallets Section */}
                <div className={`flex-1 ${activeTab === 'evm' ? '' : 'hidden md:block'}`}>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">EVM Wallets</h3>
                  </div>
                  <div className="space-y-3">
                    {connectors.map((connector) => (
                      <motion.button
                        key={connector.uid}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleEVMConnect(connector)}
                        disabled={loadingEVM}
                        className="w-full flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">
                            {connector.name || 'Unknown Wallet'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {connector.ready ? 'Ready to connect' : 'Not available'}
                          </p>
                        </div>
                        {loadingEVM && (
                          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Bitcoin Wallets Section */}
                <div className={`flex-1 ${activeTab === 'btc' ? '' : 'hidden md:block'}`}>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Bitcoin Wallets</h3>
                  </div>
                  <div className="space-y-3">
                    {availableWallets ? (
                      Object.values(availableWallets).map((wallet: any, index: number) => (
                        <motion.button
                          key={wallet.id || index}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleBTCConnect(wallet)}
                          disabled={loadingBTC}
                          className="w-full flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-gray-900">
                              {wallet.name || wallet.title || 'Bitcoin Wallet'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {wallet.description || 'Connect your Bitcoin wallet'}
                            </p>
                          </div>
                          {loadingBTC && (
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </motion.button>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No Bitcoin wallets available</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Make sure you have a Bitcoin wallet extension installed
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Multi-Wallet Support
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Connect both EVM and Bitcoin wallets to use the bridge. You can connect multiple wallets simultaneously.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};