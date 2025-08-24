import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, AlertCircle } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { initiateViaUDA } from '../services/contractService';
import { API_URLS } from '../constants/constants';
import QRCode from 'qrcode';
import type { Order } from '../types/api';
import { isEVMChain, parseAction } from '../services/orderService';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import SwapProgress from './SwapProgress';

interface OrderDetailsModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

const POLL_INTERVAL = 2000; // 2 seconds

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ orderId, isOpen, onClose, onBack }) => {
  const { address: evmAddress, walletClient } = useEVMWallet();
  const [order, setOrder] = useState<Order | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { provider } = useBitcoinWallet();
  const [initiationHash, setInitiationHash] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(false);

  // Cleanly fetch and update order, status, QR, and hash
  const fetchAndUpdateOrder = useCallback(
    async (showLoading = false) => {
      if (!orderId) return;
      if (showLoading) setIsLoading(true);

      try {
        const response = await fetch(`${API_URLS.ORDERBOOK}/orders/id/${orderId}`);
        if (!response.ok) {
          setError('Failed to fetch order details');
          setOrder(null);
          setQrCodeUrl('');
          setInitiationHash(null);
          return;
        }
        const data = await response.json();
        if (!isMountedRef.current) return;

        setOrder(data.result);

        // Update initiation hash and QR code
        const txHash = data?.result?.source_swap?.initiate_tx_hash;
        const depositAddress = data?.result?.source_swap?.deposit_address;

        if (txHash) {
          setInitiationHash(txHash);
          setQrCodeUrl('');
        } else if (depositAddress) {
          try {
            const qrCode = await QRCode.toDataURL(depositAddress);
            setQrCodeUrl(qrCode);
          } catch (qrErr) {
            setQrCodeUrl('');
          }
        } else {
          setQrCodeUrl('');
        }
      } catch (err) {
        setError('Failed to fetch order details');
        setOrder(null);
        setQrCodeUrl('');
        setInitiationHash(null);
        console.error('Error fetching order:', err);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [orderId]
  );

  // Polling logic
  useEffect(() => {
    isMountedRef.current = true;

    if (!orderId || !isOpen) {
      setOrder(null);
      setQrCodeUrl('');
      setInitiationHash(null);
      setError(null);
      setIsLoading(false);
      setIsInitiating(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Reset state for new order
    setOrder(null);
    setQrCodeUrl('');
    setInitiationHash(null);
    setError(null);
    setIsLoading(true);
    setIsInitiating(false);

    // Initial fetch
    fetchAndUpdateOrder(true);

         // Start polling
     if (pollingRef.current) {
       clearInterval(pollingRef.current);
       pollingRef.current = null;
     }
     pollingRef.current = setInterval(() => {
       fetchAndUpdateOrder(false);
     }, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [orderId, isOpen, fetchAndUpdateOrder]);


  

  const handleInit = async () => {
    if (!order || !walletClient || !evmAddress) return;
    setIsInitiating(true);
    setError(null);

    if (isEVMChain(order.source_swap.chain)) {
      await handleInitiateUDA();
    } else {
      await handleBitcoinInit();
    }
  };

  const handleBitcoinInit = async () => {
    if (!order || !provider || !order.source_swap.deposit_address) return;
    setIsInitiating(true);
    setError(null);

    const bitcoinRes = await provider.sendBitcoin(
      order.source_swap.deposit_address,
      Number(order.source_swap.amount)
    );

    if (bitcoinRes.ok) {
      setInitiationHash(bitcoinRes.val);
    } else {
      setError(bitcoinRes.error);
    }
    setIsInitiating(false);
  };

  const handleInitiateUDA = async () => {
    if (!order || !walletClient || !evmAddress) return;

    setIsInitiating(true);
    setError(null);

    try {
      if (!order.source_swap?.chain || !order.source_swap?.deposit_address || !order.source_swap?.amount) {
        setError('Invalid order structure');
        return;
      }

      const hash = await initiateViaUDA(walletClient, order);
      if (hash.ok) {
        setInitiationHash(hash.val);
      } else {
        setError(hash.error);
      }
    } catch (err) {
      setError('Failed to initiate UDA transaction');
      console.error('UDA initiation error:', err);
    } finally {
      setIsInitiating(false);
    }
  };

  if (!orderId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-4 z-50 flex items-center justify-center"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onBack}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                  </button>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
                    <p className="text-sm text-gray-500">#{orderId.slice(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {isLoading ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center py-12"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"
                    />
                    <span className="text-gray-600">Loading order details...</span>
                  </motion.div>
                ) : error || !order ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
                    <p className="text-gray-500 mb-4">{error || 'Order not found'}</p>
                    <button
                      onClick={() => {
                        setError(null);
                      }}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    {/* Swap Progress */}
                    <SwapProgress
                      order={{
                        ...order,
                        status: parseAction(order)
                      }}
                      initiationHash={initiationHash}
                      qrCodeUrl={qrCodeUrl}
                      onInitiate={handleInit}
                      isInitiating={isInitiating}
                      error={error}
                      isLoading={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OrderDetailsModal;
