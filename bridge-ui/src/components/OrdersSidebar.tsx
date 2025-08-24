import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { getOrderStatusInfo, parseAction, type OrderStatus } from '../services/orderService';
import { useOrdersStore } from '../store/ordersStore';
import { API_URLS } from '../constants/constants';
import { useAssetsStore } from '../store/assetsStore';

interface OrdersSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderClick: (orderId: string) => void;
}

const ASSET_LOGOS: Record<string, string> = {
  wbtc: "https://garden.imgix.net/token-images/wbtc.svg",
  avax: "https://garden.imgix.net/token-images/avax.svg",
  usdc: "https://garden.imgix.net/token-images/usdc.svg",
  bitcoin: "https://garden.imgix.net/token-images/bitcoin.svg",
};

function getAssetLogo(symbol: string) {
  const key = symbol.toLowerCase();
  let url: string | undefined;
  if (key === "btc" || key === "bitcoin") url = ASSET_LOGOS.bitcoin;
  else if (key === "usdc") url = ASSET_LOGOS.usdc;
  else if (key === "wbtc") url = ASSET_LOGOS.wbtc;
  else if (key === "avax") url = ASSET_LOGOS.avax;

  if (url) {
    return (
      <img
        src={url}
        alt={symbol}
        className="w-5 h-5 rounded-full object-contain"
        style={{ background: "#fff" }}
      />
    );
  }
  return (
    <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
      {symbol.charAt(0)}
    </div>
  );
}

const OrdersSidebar: React.FC<OrdersSidebarProps> = ({ isOpen, onClose, onOrderClick }) => {
  const { address: evmAddress } = useEVMWallet();
  const { 
    orders, 
    isLoading, 
    error, 
    setOrders, 
    setLoading, 
    setError
  } = useOrdersStore();

  const [isPolling, setIsPolling] = useState(false);
  const { assets } = useAssetsStore();



  // Fetch orders with polling
  const fetchOrders = async () => {
    if (!evmAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URLS.ORDERBOOK}/orders/user/${evmAddress}`);
      if (response.ok) {
        const data = await response.json();
        const apiOrders = data.result
        
        const userOrders = apiOrders.map((order: any) => {
          const status = parseAction(order);
          return {
            ... order,
            status,
          };
        });
        
        // Sort orders by creation date (latest first)
        const sortedOrders = userOrders.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setOrders(sortedOrders);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err) {
      setError('Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start polling
  const startPolling = () => {
    if (!evmAddress || isPolling) return;

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URLS.ORDERBOOK}/orders/user/${evmAddress}`);
        if (response.ok) {
          const data = await response.json();
          const apiOrders = data.result;
          
          const userOrders = apiOrders.map((order: any) => {
            const status = parseAction(order);
            return {
             ...order,
             status,
            };
          });
          
          // Sort orders by creation date (latest first)
          const sortedOrders = userOrders.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          setOrders(sortedOrders);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 10000); // Poll every 10 seconds

    // Cleanup after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsPolling(false);
    }, 120000);

    return () => clearInterval(pollInterval);
  };

  useEffect(() => {
    if (evmAddress && isOpen) {
      fetchOrders();
      startPolling();
    }
  }, [evmAddress, isOpen]);



  // Helper function to extract asset symbol from asset string
  const getAssetSymbol = (assetString: string): string => {
    const parts = assetString.split(':');
    return parts[parts.length - 1]?.toUpperCase() || assetString.toUpperCase();
  };

  // Helper function to format amount
  const formatAmount = (amount: string, decimals: number) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0';
    const formattedAmount = numAmount / Math.pow(10, decimals);
    let str = formattedAmount.toFixed(decimals);
    str = str.replace(/\.?0+$/, '');
    return str;
  };

  // Helper function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!evmAddress) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>



            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                  <span className="text-gray-600">Loading orders...</span>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              {/* Orders List */}
              {orders.length === 0 && !isLoading ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Orders Found</h3>
                  <p className="text-gray-500">You don't have any orders with the selected status</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order, index) => {
                    const statusInfo = getOrderStatusInfo(order.status);
                    const sourceSymbol = getAssetSymbol(order.source_swap.asset);
                    const destinationSymbol = getAssetSymbol(order.destination_swap.asset);
                    // const sourceChainName = getChainName(order.source_swap.chain);
                    // const destinationChainName = getChainName(order.destination_swap.chain);

                    return (
                      <motion.div
                        key={order.create_order.create_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100"
                        onClick={() => onOrderClick(order.create_order.create_id)}
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.icon} {statusInfo.label}
                            </span>
                            <span className="text-xs text-gray-500">#{order.create_order.create_id.slice(0, 6)}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>

                        {/* Order Summary */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {getAssetLogo(sourceSymbol)}
                              <span className="font-medium">{sourceSymbol}</span>
                            </div>
                            <span className="text-gray-600">
                              {formatAmount(order.source_swap.amount, assets.find(a => a.asset.symbol === sourceSymbol)?.asset.decimals ?? 18)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                              <ArrowRight className="w-3 h-3 text-gray-500" />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {getAssetLogo(destinationSymbol)}
                              <span className="font-medium">{destinationSymbol}</span>
                            </div>
                            <span className="text-gray-600">
                              {formatAmount(order.destination_swap.amount, assets.find(a => a.asset.symbol === destinationSymbol)?.asset.decimals ?? 18)}
                            </span>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-xs text-gray-500">{formatDate(order.created_at)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OrdersSidebar;
