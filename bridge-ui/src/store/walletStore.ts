import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCAL_STORAGE_KEYS } from '../constants/constants';
import { DigestKey } from '../utils/digestKey';

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
  digestKey: string | null;
  setEVMWallet: (address: string | null, chainId: number | null, isConnected: boolean) => void;
  setBTCWallet: (address: string | null, network: string | null, isConnected: boolean) => void;
  setDigestKey: (key: string | null) => void;
  getDigestKey: () => string;
  disconnectEVM: () => void;
  disconnectBTC: () => void;
  disconnectAll: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
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
      digestKey: null,
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
      setDigestKey: (key) =>
        set(() => ({
          digestKey: key,
        })),
      getDigestKey: () => {
        const state = get();
        if (state.digestKey) {
          return state.digestKey;
        }
        const newKey = DigestKey.getDigestKey();
        set({ digestKey: newKey });
        return newKey;
      },
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
          digestKey: null,
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
