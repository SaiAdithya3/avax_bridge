import React, { useEffect, useState, useCallback } from 'react';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { useOrdersStore } from '../store/ordersStore';
import { fetchUserOrders, filterPendingOrders, executePendingOrdersRedemption, parseAction } from '../services/orderService';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';

export const PendingOrdersManager: React.FC = () => {
    const { address: evmAddress, walletClient: evmWalletClient } = useEVMWallet();
    const { account, provider } = useBitcoinWallet();
    
    const {
        userOrders,
        pendingOrders,
        isLoadingUserOrders,
        userOrdersError,
        setUserOrders,
        setPendingOrders,
        setLoadingUserOrders,
        setUserOrdersError,
    } = useOrdersStore();

    const [isExecuting, setIsExecuting] = useState(false);
    const [lastExecutionResult, setLastExecutionResult] = useState<{
        success: boolean;
        message: string;
        processedCount: number;
        results: Array<{ orderId: string; success: boolean; message: string; txHash?: string }>;
    } | null>(null);

    // Fetch user orders
    const fetchOrders = useCallback(async () => {
        if (!evmAddress && !account) {
            setUserOrdersError('No wallet connected');
            return;
        }

        try {
            setLoadingUserOrders(true);
            setUserOrdersError(null);
            
            // Use EVM address if available, otherwise use BTC address
            const userAddress = evmAddress || account!;
            const orders = await fetchUserOrders(userAddress);
            
            setUserOrders(orders.map((order) => ({
                ...order,
                status: parseAction(order)
            })));
            
            // Filter pending orders
            const pending = filterPendingOrders(orders);
            setPendingOrders(pending);
            
        } catch (error) {
            setUserOrdersError(String(error));
            console.error('Error fetching orders:', error);
        } finally {
            setLoadingUserOrders(false);
        }
    }, [evmAddress, account, setUserOrders, setPendingOrders, setLoadingUserOrders, setUserOrdersError]);

    // Execute pending orders redemption
    const executeRedemption = useCallback(async () => {
        if (!evmWalletClient) {
            setLastExecutionResult({
                success: false,
                message: 'EVM wallet not connected',
                processedCount: 0,
                results: []
            });
            return;
        }

        if (pendingOrders.length === 0) {
            setLastExecutionResult({
                success: true,
                message: 'No pending orders to execute',
                processedCount: 0,
                results: []
            });
            return;
        }

        try {
            setIsExecuting(true);
            const result = await executePendingOrdersRedemption(pendingOrders, evmWalletClient);
            setLastExecutionResult(result);
            
            // Refresh orders after execution
            if (result.processedCount > 0) {
                await fetchOrders();
            }
        } catch (error) {
            setLastExecutionResult({
                success: false,
                message: String(error),
                processedCount: 0,
                results: []
            });
        } finally {
            setIsExecuting(false);
        }
    }, [pendingOrders, evmWalletClient, fetchOrders]);

    // Auto-refresh orders every 30 seconds
    useEffect(() => {
        fetchOrders();
        executeRedemption();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    return (
       <>
       </>
    );
};
