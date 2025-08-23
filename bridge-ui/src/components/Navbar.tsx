import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { formatAddress } from '../utils/utils';
import { ConnectWalletModal } from './ConnectWallet';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import { Network } from '@gardenfi/utils';

export const Navbar = () => {
  const {
    address: evmAddress,
    isConnected: evmConnected,
    connectors,
    connectAsync,
    disconnect,
  } = useEVMWallet();
  const {
    account,
    availableWallets,
    connect,
    isConnected,
    provider, 
    network, 
    disconnect: btcDisconnect,
    isConnecting
  } = useBitcoinWallet();

  const [modalOpen, setModalOpen] = useState(false);
  const [loadingEVM, setLoadingEVM] = useState(false);
  const [loadingBTC, setLoadingBTC] = useState(false);

  const handleEVMConnect = async (connector: any) => {
    setLoadingEVM(true);
    try {
      await connectAsync({ connector });
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to connect EVM wallet:', error);
    } finally {
      setLoadingEVM(false);
    }
  };

  const handleBTCConnect = async (wallet: any) => {
    setLoadingBTC(true);
    try {
      if (typeof connect === 'function') {
        await connect(wallet, network as Network);
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to connect BTC wallet:', error);
    } finally {
      setLoadingBTC(false);
    }
  };

  const isAnyWalletConnected = evmConnected || isConnected;

  const handleCloseModal = () => {
    setModalOpen(false);
    setLoadingEVM(false);
    setLoadingBTC(false);
  };

  // Add escape key listener
  useState(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseModal();
      }
    };

    if (modalOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  });

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white border-b border-gray-200 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center space-x-2"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-xl font-display font-semibold text-gray-900">
              Avalanche Bridge
            </span>
          </motion.div>

          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center space-x-3"
          >
            {!isAnyWalletConnected ? (
              <div>
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200 text-sm font-medium flex items-center"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {evmConnected && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700 font-medium">
                      EVM: {formatAddress(evmAddress!)}
                    </span>
                    <button
                      onClick={disconnect}
                      className="text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </div>
                )}
                {isConnected && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-orange-700 font-medium">
                      BTC: {formatAddress(account!)}
                    </span>
                    <button
                      onClick={btcDisconnect}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </motion.nav>
      <ConnectWalletModal
        open={modalOpen}
        onClose={handleCloseModal}
        onEVMConnect={handleEVMConnect}
        onBTCConnect={handleBTCConnect}
        loadingEVM={loadingEVM}
        loadingBTC={loadingBTC}
      />
    </>
  );
};