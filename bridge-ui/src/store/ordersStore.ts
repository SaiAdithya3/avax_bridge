import { create } from 'zustand';
import { type UserOrder, type OrderStatus } from '../services/orderService';

interface OrdersState {
  orders: UserOrder[];
  isLoading: boolean;
  error: string | null;
  statusFilter: OrderStatus | 'all';
  
  // Actions
  setOrders: (orders: UserOrder[]) => void;
  addOrder: (order: UserOrder) => void;
  updateOrder: (orderId: string, updates: Partial<UserOrder>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStatusFilter: (filter: OrderStatus | 'all') => void;
  clearOrders: () => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  statusFilter: 'all',

  setOrders: (orders) => set({ orders }),
  
  addOrder: (order) => {
    const { orders } = get();
    const existingIndex = orders.findIndex(o => o.id === order.id);
    if (existingIndex >= 0) {
      const updatedOrders = [...orders];
      updatedOrders[existingIndex] = order;
      set({ orders: updatedOrders });
    } else {
      set({ orders: [...orders, order] });
    }
  },

  updateOrder: (orderId, updates) => {
    const { orders } = get();
    const updatedOrders = orders.map(order => 
      order.id === orderId ? { ...order, ...updates } : order
    );
    set({ orders: updatedOrders });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  
  clearOrders: () => set({ orders: [] }),
}));
