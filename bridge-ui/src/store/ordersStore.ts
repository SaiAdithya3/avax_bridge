import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Order } from '../types/api';
import type { OrderStatus } from '../services/orderService';

interface OrdersState {
  // User orders (from /orders/user/:user_id)
  userOrders: (Order & {status: OrderStatus})[];
  // Pending orders (orders ready for redemption)
  pendingOrders: Order[];
  // Loading states
  isLoadingUserOrders: boolean;
  isLoadingPendingOrders: boolean;
  // Error states
  userOrdersError: string | null;
  pendingOrdersError: string | null;
  // Actions
  setUserOrders: (orders: (Order & {status: OrderStatus})[]) => void;
  setPendingOrders: (orders: Order[]) => void;
  setLoadingUserOrders: (loading: boolean) => void;
  setLoadingPendingOrders: (loading: boolean) => void;
  setUserOrdersError: (error: string | null) => void;
  setPendingOrdersError: (error: string | null) => void;
  // Clear all data
  clearOrders: () => void;
}

export const useOrdersStore = create<OrdersState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    userOrders: [],
    pendingOrders: [],
    isLoadingUserOrders: false,
    isLoadingPendingOrders: false,
    userOrdersError: null,
    pendingOrdersError: null,

    // Actions
    setUserOrders: (orders) => set({ userOrders: orders }),
    setPendingOrders: (orders) => set({ pendingOrders: orders }),
    setLoadingUserOrders: (loading) => set({ isLoadingUserOrders: loading }),
    setLoadingPendingOrders: (loading) => set({ isLoadingPendingOrders: loading }),
    setUserOrdersError: (error) => set({ userOrdersError: error }),
    setPendingOrdersError: (error) => set({ pendingOrdersError: error }),
    
    clearOrders: () => set({
      userOrders: [],
      pendingOrders: [],
      isLoadingUserOrders: false,
      isLoadingPendingOrders: false,
      userOrdersError: null,
      pendingOrdersError: null,
    }),
  }))
);
