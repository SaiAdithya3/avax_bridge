import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, X } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { formatAddress } from '../utils/utils';
import { ConnectWalletModal } from './ConnectWallet';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import { Network } from '@gardenfi/utils';
import avalancheLogo from '../assets/avalanche-avax-logo.svg';
import bitcoinLogo from '../assets/bitcoin-btc-logo.svg';

const navbarVariants = {
  hidden: { opacity: 0, scale: 0.98, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const Navbar = () => {
  const {
    address: evmAddress,
    isConnected: evmConnected,
    connectAsync,
    disconnect,
  } = useEVMWallet();
  const {
    account,
    connect,
    isConnected: btcConnected,
    network, 
    disconnect: btcDisconnect,
  } = useBitcoinWallet();

  const [modalOpen, setModalOpen] = useState(false);
  const [loadingEVM, setLoadingEVM] = useState(false);
  const [loadingBTC, setLoadingBTC] = useState(false);
  const [modalTab, setModalTab] = useState<'evm' | 'btc' | undefined>(undefined);

  const handleEVMConnect = async (connector: any) => {
    setLoadingEVM(true);
    try {
      await connectAsync({ connector });
      setModalOpen(false);
      setModalTab(undefined);
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
      setModalTab(undefined);
    } catch (error) {
      console.error('Failed to connect BTC wallet:', error);
    } finally {
      setLoadingBTC(false);
    }
  };

  const isAnyWalletConnected = evmConnected || btcConnected;
  const isBothWalletsConnected = evmConnected && btcConnected;
  const isOnlyEVMConnected = evmConnected && !btcConnected;
  const isOnlyBTCConnected = !evmConnected && btcConnected;

  const handleCloseModal = () => {
    setModalOpen(false);
    setLoadingEVM(false);
    setLoadingBTC(false);
    setModalTab(undefined);
  };

  useEffect(() => {
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
  }, [modalOpen]);

  const connectWalletModalProps = {
    open: modalOpen,
    onClose: handleCloseModal,
    onEVMConnect: handleEVMConnect,
    onBTCConnect: handleBTCConnect,
    loadingEVM,
    loadingBTC,
    ...(modalTab ? { initialTab: modalTab } : {})
  };

  return (
    <>
      <AnimatePresence>
        <motion.nav
          key="navbar"
          variants={navbarVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="p-4"
        >
          <motion.div
            className="max-w-7xl bg-gradient-to-r from-orange-100 to-red-100 p-4 rounded-2xl px-8 mx-auto shadow-lg flex items-center justify-between overflow-hidden"
            initial={{ width: 0, opacity: 0, x: "50%" }}
            animate={{ width: "100%", opacity: 1, x: "0%" }}
            exit={{ width: 0, opacity: 0, x: "50%" }}
            transition={{ width: { type: "spring", stiffness: 60, damping: 20, duration: 1.2 }, opacity: { delay: 0.2, duration: 0.6 } }}
          >
            <motion.div
              variants={itemVariants}
              className="flex items-center space-x-2"
            >
              <motion.span
                variants={itemVariants}
                className="text-xl font-display font-semibold text-gray-900"
              >
                Avalanche Bridge
              </motion.span>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex items-center space-x-3"
            >
              {!isAnyWalletConnected ? (
                <motion.div variants={itemVariants}>
                  <button
                    onClick={() => {
                      setModalTab(undefined);
                      setModalOpen(true);
                    }}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200 text-sm font-medium flex items-center shadow"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </button>
                </motion.div>
              ) : (
                <motion.div variants={itemVariants} className="flex items-center space-x-3">
                  {evmConnected && (
                    <motion.div
                      variants={itemVariants}
                      className="flex items-center space-x-2 px-3 cursor-pointer hover:bg-blue-200 transition-colors duration-200 py-2 bg-blue-100 rounded-lg shadow-sm"
                    >
                      <img src={avalancheLogo} alt="avalanche" className="w-6 h-6 rounded-full" />
                      <span className="text-sm text-blue-800 font-medium">
                        EVM: {formatAddress(evmAddress!)}
                      </span>
                    </motion.div>
                  )}
                  {btcConnected && (
                    <motion.div
                      variants={itemVariants}
                      className="flex items-center space-x-2 px-3 py-2 bg-orange-100 rounded-lg shadow-sm cursor-pointer hover:bg-orange-200 transition-colors duration-200"
                    >
                      <img src={bitcoinLogo} alt="bitcoin" className="w-6 h-6 rounded-full" />
                      <span className="text-sm text-orange-700 font-medium">
                        BTC: {formatAddress(account!)}
                      </span>
                    </motion.div>
                  )}
                  {!isBothWalletsConnected ? (
                    <>
                    <motion.button
                      variants={itemVariants}
                      onClick={() => {
                        if (isOnlyEVMConnected) {
                          setModalTab('btc');
                        } else if (isOnlyBTCConnected) {
                          setModalTab('evm');
                        } else {
                          setModalTab(undefined);
                        }
                        setModalOpen(true);
                      }}
                      className="p-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-colors duration-200 flex items-center justify-center shadow"
                      title="Connect another wallet"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                     <motion.button
                     variants={itemVariants}
                     onClick={() => {
                       disconnect();
                       btcDisconnect();
                     }}
                     className="p-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-colors duration-200 flex items-center justify-center shadow"
                   >
                    <X className="w-4 h-4" />
                   </motion.button>
                   </>

                  ) : (
                    <motion.button
                      variants={itemVariants}
                      onClick={() => {
                        disconnect();
                        btcDisconnect();
                      }}
                      className="p-2 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-colors duration-200 flex items-center justify-center shadow"
                    >
                     <X className="w-4 h-4" />
                    </motion.button>
                  )}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.nav>
      </AnimatePresence>
      <ConnectWalletModal
        {...connectWalletModalProps}
      />
    </>
  );
};