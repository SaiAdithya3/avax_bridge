import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { initiateViaUDA } from '../services/contractService';
import { API_URLS } from '../constants/constants';
import QRCode from 'qrcode';
import type { Order } from '../types/api';
import { useAssetsStore } from '../store/assetsStore';
import { isEVMChain } from '../services/orderService';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';

interface OrderDetailsProps {
  orderId: string;
  onBack: () => void;
}

const POLL_INTERVAL = 5000; // 5 seconds

const OrderDetails: React.FC<OrderDetailsProps> = ({ orderId, onBack }) => {
  const { address: evmAddress, walletClient } = useEVMWallet();
  const [order, setOrder] = useState<Order | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {provider} = useBitcoinWallet();
  const [initiationHash, setInitiationHash] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const { assets } = useAssetsStore();
//   console.log(isCompleted)
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrder = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch(`${API_URLS.ORDERBOOK}/orders/id/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data.result);

        if (data?.source_swap?.initiate_tx_hash) {
          setIsCompleted(false);
          setInitiationHash(data.source_swap.initiate_tx_hash);
          setQrCodeUrl('');
        } else {
          setIsCompleted(false);
          if (data?.source_swap?.deposit_address) {
            const qrCode = await QRCode.toDataURL(data.source_swap.deposit_address);
            console.log("qrCode", qrCode)
            setQrCodeUrl(qrCode);
          }
        }
      } else {
        setError('Failed to fetch order details');
      }
    } catch (err) {
      setError('Failed to fetch order details');
      console.error('Error fetching order:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };
  useEffect(() => {
    let isMounted = true;
    fetchOrder();

    // Polling for order status
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_URLS.ORDERBOOK}/orders/id/${orderId}`);
        if (response.ok) {
          const data = await response.json();
          if (!isMounted) return;
          setOrder(data.result);

          if (data?.result.source_swap?.initiate_tx_hash) {
            setIsCompleted(true);
            setInitiationHash(data.result.source_swap.initiate_tx_hash);
            setQrCodeUrl('');
            // Stop polling if completed
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          } else {
            setIsCompleted(false);
            if (data?.result?.source_swap?.deposit_address) {
              const qrCode = await QRCode.toDataURL(data.result.source_swap.deposit_address);
              setQrCodeUrl(qrCode);
            }
          }
        }
      } catch (err) {
        // Optionally handle polling errors
      }
    }, POLL_INTERVAL);

    return () => {
      isMounted = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [orderId]);

  const handleInit = async () => {
    if (!order || !walletClient || !evmAddress) return;
    setIsInitiating(true);
    setError(null);
    if(isEVMChain(order.source_swap.chain)){
      await handleInitiateUDA();
    }else{
      await handleBitcoinInit();
    }
  }

  const handleBitcoinInit = async () => {
    if (!order || !provider || !order.source_swap.deposit_address) return;
    setIsInitiating(true);
    setError(null);
    const bitcoinRes = await provider.sendBitcoin(
        order.source_swap.deposit_address,
        Number(order.source_swap.amount)
      );
    if(bitcoinRes.ok){
      setInitiationHash(bitcoinRes.val);
    }else{
      setError(bitcoinRes.error);
    }
  }

  const handleInitiateUDA = async () => {
    if (!order || !walletClient || !evmAddress) return;

    setIsInitiating(true);
    setError(null);

    try {
      console.log('Order for UDA:', order);
      console.log('Source swap chain:', order.source_swap?.chain);
      console.log('Deposit address:', order.source_swap?.deposit_address);
      console.log('Amount:', order.source_swap?.amount);

      // Validate order structure
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

  // Helper function to get asset symbol
  const getAssetSymbol = (assetString: string): string => {
    const parts = assetString.split(':');
    return parts[parts.length - 1]?.toUpperCase() || assetString.toUpperCase();
  };

  // Helper function to get chain name
  const getChainName = (assetString: string): string => {
    const parts = assetString.split(':');
    return parts[0]?.replace(/_/g, ' ') || assetString;
  };

  const formatAmount = (amount: string, decimals: number) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0';
    const formattedAmount = numAmount / Math.pow(10, decimals);
    let str = formattedAmount.toFixed(decimals);
    str = str.replace(/\.?0+$/, '');
    return str;
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#e84142] border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-600">Loading order details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-500 mb-4">{error || 'Order not found'}</p>
            <button
              onClick={onBack}
              className="px-6 py-2 bg-[#e84142] text-white rounded-xl hover:bg-[#e84142]/90 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sourceSwap = order?.source_swap;
  const destinationSwap = order?.destination_swap;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Swap
          </button>
          <span className="text-sm text-gray-500">Order #{orderId.slice(0, 8)}</span>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">From:</span>
              <span className="font-medium">
                {sourceSwap?.amount
                  ? formatAmount(
                      sourceSwap.amount,
                      assets.find(
                        a =>
                          a.asset.symbol === getAssetSymbol(sourceSwap.asset) &&
                          getChainName(a.chainName).toLowerCase() === getChainName(sourceSwap.chain).toLowerCase()
                      )?.asset.decimals ?? 18
                    )
                  : '--'}{' '}
                {sourceSwap?.asset ? getAssetSymbol(sourceSwap.asset) : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">To:</span>
              <span className="font-medium">
                {destinationSwap?.amount
                  ? formatAmount(
                      destinationSwap.amount,
                      assets.find(
                        a =>
                          a.asset.symbol === getAssetSymbol(destinationSwap.asset) &&
                          getChainName(a.chainName).toLowerCase() === getChainName(destinationSwap.chain).toLowerCase()
                      )?.asset.decimals ?? 18
                    )
                  : '--'}{' '}
                {destinationSwap?.asset ? getAssetSymbol(destinationSwap.asset) : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Source Chain:</span>
              <span className="font-medium">{sourceSwap?.chain ? getChainName(sourceSwap.chain) : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Destination Chain:</span>
              <span className="font-medium">{destinationSwap?.chain ? getChainName(destinationSwap.chain) : '--'}</span>
            </div>
          </div>
        </div>

        {/* If completed, show only order details */}
        {isCompleted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="flex flex-col items-center">
              <svg className="w-12 h-12 text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-xl font-semibold text-green-800 mb-2">Order Initiated!</h3>
              <p className="text-green-700 mb-2">Your swap has been initiated successfully. Now waiting for the counter party to complete the swap.</p>
              {initiationHash && (
                <>
                  <p className="text-sm text-green-700 mb-1">Transaction Hash:</p>
                  <code className="text-sm text-green-600 break-all">{initiationHash}</code>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* QR Code Section */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Funds</h3>
              <p className="text-gray-600 mb-4">Scan this QR code with your wallet to send funds</p>
              
              {qrCodeUrl && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block">
                  <img src={qrCodeUrl} alt="Deposit Address QR Code" className="w-48 h-48" />
                </div>
              )}
              
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Or copy the address:</p>
                <div className="bg-gray-100 rounded-lg p-3">
                  <code className="text-sm break-all">{sourceSwap?.deposit_address || '--'}</code>
                </div>
              </div>
            </div>

            {/* UDA Initiation */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Transaction</h3>
              <p className="text-gray-600 mb-4">
                After sending funds, click the button below to complete the transaction on the destination chain.
              </p>
              
              {initiationHash ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium text-green-800">Transaction Initiated!</span>
                  </div>
                  <p className="text-sm text-green-700 mb-2">Transaction Hash:</p>
                  <code className="text-sm text-green-600 break-all">{initiationHash}</code>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInit}
                  disabled={isInitiating || !evmAddress}
                  className="w-full py-3 px-4 bg-[#e84142] text-white font-medium rounded-xl hover:bg-[#e84142]/90 focus:outline-none focus:ring-2 focus:ring-[#e84142]/70 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isInitiating ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                      Initiating Transaction...
                    </div>
                  ) : (
                    'Initiate Transaction'
                  )}
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderDetails;
