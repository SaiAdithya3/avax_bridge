import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { getFilteredOrders, getOrderStatusInfo, parseAction, type OrderStatus } from '../services/orderService';
import { useOrdersStore } from '../store/ordersStore';
import { API_URLS } from '../constants/constants';
import OrderDetails from './OrderDetails';
import type { Order } from '../types/api';
import { useAssetsStore } from '../store/assetsStore';

const ASSET_LOGOS: Record<string, string> = {
  wbtc: "https://garden.imgix.net/token-images/wbtc.svg",
  avax: "https://garden.imgix.net/token-images/avax.svg",
  usdc: "https://garden.imgix.net/token-images/usdc.svg",
  bitcoin: "https://garden.imgix.net/token-images/bitcoin.svg",
};

const CHAIN_LOGOS: Record<string, string> = {
  'arbitrum sepolia': "https://garden.imgix.net/chain_images/arbitrumSepolia.svg",
  'avalanche testnet': "https://garden.imgix.net/token-images/avax.svg",
  'bitcoin testnet': "https://garden.imgix.net/token-images/bitcoin.svg",
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
    return (
      <img
        src={url}
        alt={chainName}
        className="w-5 h-5 rounded-full object-contain"
        style={{ background: "#fff" }}
      />
    );
  }
  return (
    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-500">
      {chainName.charAt(0)}
    </div>
  );
}

const UserOrders: React.FC = () => {
  const { address: evmAddress } = useEVMWallet();
  const { 
    userOrders,
    isLoadingUserOrders,
    userOrdersError,
    setUserOrders,
    setLoadingUserOrders,
    setUserOrdersError,
  } = useOrdersStore();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [filteredOrders, setFilteredOrders] = useState<(Order & {status: OrderStatus})[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { assets } = useAssetsStore();

  // Status filter options
  const statusOptions: Array<{ value: OrderStatus | 'all'; label: string; count: number }> = [
    { value: 'all', label: 'All Orders', count: userOrders.length },
    { value: 'created', label: 'Awaiting Deposit', count: userOrders.filter(o => o.status === 'created').length },
    { value: 'deposit_detected', label: 'Deposit Detected 0/1', count: userOrders.filter(o => o.status === 'deposit_detected').length },
    { value: 'deposit_confirmed', label: 'Deposit Confirmed', count: userOrders.filter(o => o.status === 'deposit_confirmed').length },
    { value: 'redeeming', label: 'Redeeming', count: userOrders.filter(o => o.status === 'redeeming').length },
    { value: 'completed', label: 'Swap Completed', count: userOrders.filter(o => o.status === 'completed').length },
  ];

  // Fetch orders with polling
  const fetchOrders = async () => {
    if (!evmAddress) return;

    setLoadingUserOrders(true);
    setUserOrdersError(null);

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
        
        setUserOrders(userOrders);
        setFilteredOrders(getFilteredOrders(userOrders, statusFilter));
      } else {
        setUserOrdersError('Failed to fetch orders');
      }
    } catch (err) {
      setUserOrdersError('Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingUserOrders(false);
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
          
          setUserOrders(userOrders);
          setFilteredOrders(getFilteredOrders(userOrders, statusFilter));
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
    if (evmAddress) {
      fetchOrders();
      startPolling();
    }
  }, [evmAddress]);

  useEffect(() => {
    setFilteredOrders(getFilteredOrders(userOrders.map((order) => ({
      ...order,
      status: parseAction(order)
    })), statusFilter));
  }, [userOrders, statusFilter]);

  // Helper function to extract asset symbol from asset string
  const getAssetSymbol = (assetString: string): string => {
    const parts = assetString.split(':');
    return parts[parts.length - 1]?.toUpperCase() || assetString.toUpperCase();
  };

  // Helper function to extract chain name from asset string
  const getChainName = (assetString: string): string => {
    const parts = assetString.split(':');
    return parts[0]?.replace(/_/g, ' ') || assetString;
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

  // Show OrderDetails if an order is selected
  if (selectedOrderId) {
    return (
      <OrderDetails 
        orderId={selectedOrderId} 
        onBack={() => setSelectedOrderId(null)} 
      />
    );
  }

  if (!evmAddress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Wallet</h3>
            <p className="text-gray-500">Please connect your wallet to view your orders</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">My Orders</h1>
        <p className="text-gray-600">Track your cross-chain atomic swaps</p>
      </div>

      {/* Status Filter */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="w-full overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-max">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  statusFilter === option.value
                    ? 'bg-[#e84142] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingUserOrders && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#e84142] border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-600">Loading orders...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {userOrdersError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{userOrdersError}</span>
          </div>
        </div>
      )}

      {/* Orders List */}
      <AnimatePresence>
        {filteredOrders.length === 0 && !isLoadingUserOrders ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Orders Found</h3>
              <p className="text-gray-500">You don't have any orders with the selected status</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order, index) => {
              const statusInfo = getOrderStatusInfo(order.status);
              const sourceSymbol = getAssetSymbol(order.source_swap.asset);
              const destinationSymbol = getAssetSymbol(order.destination_swap.asset);
              const sourceChainName = getChainName(order.source_swap.chain);
              const destinationChainName = getChainName(order.destination_swap.chain);

              const isNonInitiated = order.status === 'created';
              
              return (
                <motion.div
                  key={order.create_order.create_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-200 ${
                    isNonInitiated 
                      ? 'hover:shadow-xl cursor-pointer hover:border-[#e84142]/30' 
                      : 'hover:shadow-xl'
                  }`}
                  onClick={isNonInitiated ? () => setSelectedOrderId(order.create_order.create_id) : undefined}
                >
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                      <span className="text-sm text-gray-500">#{order.create_order.create_id.slice(0, 8)}</span>
                      {isNonInitiated && (
                        <span className="text-xs text-[#e84142] bg-[#e84142]/10 px-2 py-1 rounded-full">
                          Click to initiate
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Source Asset */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">From</span>
                        <div className="flex items-center gap-2">
                          {getAssetLogo(sourceSymbol)}
                          <span className="font-semibold">{sourceSymbol}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getChainLogo(sourceChainName)}
                          <span className="text-sm text-gray-600">{sourceChainName}</span>
                        </div>
                        <span className="font-semibold text-lg">{formatAmount(order.source_swap.amount, assets.find(a => a.asset.symbol === sourceSymbol)?.asset.decimals ?? 18)}</span>
                      </div>
                    </div>

                    {/* Destination Asset */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">To</span>
                        <div className="flex items-center gap-2">
                          {getAssetLogo(destinationSymbol)}
                          <span className="font-semibold">{destinationSymbol}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getChainLogo(destinationChainName)}
                          <span className="text-sm text-gray-600">{destinationChainName}</span>
                        </div>
                        <span className="font-semibold text-lg">{formatAmount(order.destination_swap.amount, assets.find(a => a.asset.symbol === destinationSymbol)?.asset.decimals ?? 18)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Hashes */}
                  {(order.source_swap.initiate_tx_hash || order.destination_swap.initiate_tx_hash) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {order.source_swap.initiate_tx_hash && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Source TX:</span>
                            <a
                              href={`https://explorer.avax-test.network/tx/${order.source_swap.initiate_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 hover:text-blue-800 truncate"
                            >
                              { order.source_swap.initiate_tx_hash ? 
                              order.source_swap.initiate_tx_hash.slice(0, 10) + "..." + order.source_swap.initiate_tx_hash.slice(-8) :
                              "--"
                              }
                            </a>
                          </div>
                        )}
                        {order.destination_swap.initiate_tx_hash && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Destination TX:</span>
                            <a
                              href={`https://explorer.avax-test.network/tx/${order.destination_swap.initiate_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 hover:text-blue-800 truncate"
                            >
                              { order.destination_swap.initiate_tx_hash ? 
                              order.destination_swap.initiate_tx_hash.slice(0, 10) + "..." + order.destination_swap.initiate_tx_hash.slice(-8) :
                              "--"
                              }
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status Description */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">{statusInfo.description}</p>
                    
                    {/* Initiate Button for non-initiated orders */}
                    {isNonInitiated && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(order.create_order.create_id);
                          }}
                          className="px-4 py-2 bg-[#e84142] text-white text-sm font-medium rounded-lg hover:bg-[#e84142]/90 transition-colors"
                        >
                          Initiate Order
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserOrders;
