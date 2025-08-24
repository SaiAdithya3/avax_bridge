import React, { useEffect, useState, useRef } from 'react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { initiateViaUDA } from '../services/contractService';
import { API_URLS } from '../constants/constants';
import QRCode from 'qrcode';
import type { Order } from '../types/api';
import { useAssetsStore } from '../store/assetsStore';
import { isEVMChain, parseAction } from '../services/orderService';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import SwapProgress from './SwapProgress';

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
  const { setShowHero } = useAssetsStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Determine current step based on order status
  const getCurrentStep = (): 'awaiting_deposit' | 'deposit_detected' | 'deposit_confirmed' | 'redeeming' | 'completed' => {
    if (!order) return 'awaiting_deposit';
    
    const status = parseAction(order);
    
    switch (status) {
      case 'completed':
        return 'completed';
      case 'redeeming':
        return 'redeeming';
      case 'deposit_confirmed':
        return 'deposit_confirmed';
      case 'deposit_detected':
        return 'deposit_detected';
      default:
        return 'awaiting_deposit';
    }
  };

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
    setShowHero(false);

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


  return (
    <div className="max-w-4xl mx-auto p-6">
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

        {/* Swap Progress */}
        <SwapProgress
          order={order}
          currentStep={getCurrentStep()}
          initiationHash={initiationHash}
          qrCodeUrl={qrCodeUrl}
          onInitiate={handleInit}
          isInitiating={isInitiating}
          error={error}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default OrderDetails;
