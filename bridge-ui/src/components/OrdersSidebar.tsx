import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { useBTCWallet } from '../hooks/useBTCWallet';
import { getOrderStatusInfo, parseAction, type OrderStatus, fetchUserOrders, filterPendingOrders } from '../services/orderService';
import { useOrdersStore } from '../store/ordersStore';
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
  const { address: btcAddress } = useBTCWallet();
  
  const { 
    userOrders, 
    pendingOrders,
    isLoadingUserOrders, 
    userOrdersError, 
    setUserOrders, 
    setPendingOrders,
    setLoadingUserOrders, 
    setUserOrdersError
  } = useOrdersStore();

  const [isPolling, setIsPolling] = useState(false);
  const { assets } = useAssetsStore();

  // Fetch orders
  const fetchOrders = async () => {
    if (!evmAddress && !btcAddress) return;

    setLoadingUserOrders(true);
    setUserOrdersError(null);

    try {
      const userAddress = evmAddress || btcAddress!;
      const orders = await fetchUserOrders(userAddress);
      
      // Add status to each order
      const ordersWithStatus = orders.map((order: any) => {
        const status = parseAction(order);
        return {
          ...order,
          status,
        };
      });
      
      // Sort orders by creation date (latest first)
      const sortedOrders = ordersWithStatus.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setUserOrders(sortedOrders);
      
      // Filter and set pending orders
      const pending = filterPendingOrders(orders);
      setPendingOrders(pending);
      
    } catch (err) {
      setUserOrdersError('Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingUserOrders(false);
    }
  };

  // Start polling
  const startPolling = () => {
    setIsPolling(true);
    fetchOrders();
    
    const interval = setInterval(fetchOrders, 10000); // Poll every 10 seconds
    
    // Store interval ID for cleanup
    (window as any).ordersPollingInterval = interval;
  };

  // Stop polling
  const stopPolling = () => {
    setIsPolling(false);
    if ((window as any).ordersPollingInterval) {
      clearInterval((window as any).ordersPollingInterval);
      (window as any).ordersPollingInterval = null;
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (isOpen) {
      fetchOrders();
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isOpen, evmAddress, btcAddress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const getAssetSymbol = (assetValue: string) => {
    const parts = assetValue.split(':');
    if (parts.length > 1) {
      return parts[1].toUpperCase();
    }
    return assetValue.toUpperCase();
  };

  const formatAmount = (amount: string, decimals: number = 6) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Orders</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchOrders}
                  disabled={isLoadingUserOrders}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Refresh orders"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingUserOrders ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Pending Orders Section */}
              {pendingOrders.length > 0 && (
                <div className="p-4 border-b bg-yellow-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-yellow-800">Pending Redemption</h3>
                    <span className="text-sm bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                      {pendingOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pendingOrders.slice(0, 3).map((order) => (
                      <div
                        key={order.create_order.create_id}
                        className="p-3 bg-white rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                        onClick={() => onOrderClick(order.create_order.create_id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getAssetLogo(getAssetSymbol(order.source_swap.asset))}
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            {getAssetLogo(getAssetSymbol(order.destination_swap.asset))}
                          </div>
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatAmount(order.source_swap.amount)} → {formatAmount(order.destination_swap.amount)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Ready for redemption
                        </div>
                      </div>
                    ))}
                    {pendingOrders.length > 3 && (
                      <div className="text-center text-sm text-yellow-700">
                        +{pendingOrders.length - 3} more pending orders
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* All Orders Section */}
              <div className="p-4">
                <h3 className="font-medium mb-3">All Orders</h3>
                
                {isLoadingUserOrders && (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                )}

                {userOrdersError && (
                  <div className="text-center py-8 text-red-600">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>{userOrdersError}</p>
                    <button
                      onClick={fetchOrders}
                      className="mt-2 text-blue-600 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!isLoadingUserOrders && !userOrdersError && userOrders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2" />
                    <p>No orders found</p>
                  </div>
                )}

                                 {!isLoadingUserOrders && !userOrdersError && userOrders.length > 0 && (
                   <div className="space-y-3">
                     {userOrders.map((order: any) => {
                       const statusInfo = getOrderStatusInfo(order.status);
                       const isPending = pendingOrders.some(p => p.create_order.create_id === order.create_order.create_id);
                       
                       return (
                         <div
                           key={order.create_order.create_id}
                           className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                             isPending 
                               ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' 
                               : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                           }`}
                           onClick={() => onOrderClick(order.create_order.create_id)}
                         >
                           <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center space-x-2">
                               {getAssetLogo(getAssetSymbol(order.source_swap.asset))}
                               <ArrowRight className="w-4 h-4 text-gray-400" />
                               {getAssetLogo(getAssetSymbol(order.destination_swap.asset))}
                             </div>
                             <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                               {statusInfo.label}
                             </div>
                           </div>
                           <div className="text-sm text-gray-600">
                             {formatAmount(order.source_swap.amount)} → {formatAmount(order.destination_swap.amount)}
                           </div>
                           <div className="text-xs text-gray-500 mt-1">
                             {new Date(order.created_at).toLocaleDateString()}
                           </div>
                         </div>
                       );
                     })}
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

export default OrdersSidebar;
