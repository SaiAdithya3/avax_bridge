import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCAL_STORAGE_KEYS } from '../constants/constants';

interface WalletState {
  evmWallet: {
    address: string | null;
    isConnected: boolean;
    chainId: number | null;
  };
  btcWallet: {
    address: string | null;
    isConnected: boolean;
    network: string | null;
  };
  setEVMWallet: (address: string | null, chainId: number | null, isConnected: boolean) => void;
  setBTCWallet: (address: string | null, network: string | null, isConnected: boolean) => void;
  disconnectEVM: () => void;
  disconnectBTC: () => void;
  disconnectAll: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      evmWallet: {
        address: null,
        isConnected: false,
        chainId: null,
      },
      btcWallet: {
        address: null,
        isConnected: false,
        network: null,
      },
      setEVMWallet: (address, chainId, isConnected) =>
        set((state) => ({
          evmWallet: {
            ...state.evmWallet,
            address,
            chainId,
            isConnected,
          },
        })),
      setBTCWallet: (address, network, isConnected) =>
        set((state) => ({
          btcWallet: {
            ...state.btcWallet,
            address,
            network,
            isConnected,
          },
        })),
      disconnectEVM: () =>
        set((state) => ({
          evmWallet: {
            ...state.evmWallet,
            address: null,
            isConnected: false,
            chainId: null,
          },
        })),
      disconnectBTC: () =>
        set((state) => ({
          btcWallet: {
            ...state.btcWallet,
            address: null,
            isConnected: false,
            network: null,
          },
        })),
      disconnectAll: () =>
        set({
          evmWallet: {
            address: null,
            isConnected: false,
            chainId: null,
          },
          btcWallet: {
            address: null,
            isConnected: false,
            network: null,
          },
        }),
    }),
    {
      name: LOCAL_STORAGE_KEYS.evmWallet,
      partialize: (state) => ({
        evmWallet: state.evmWallet,
        btcWallet: state.btcWallet,
      }),
    }
  )
);
