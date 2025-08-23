import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { API_URLS } from '../constants/constants';

export type Asset = {
  symbol: string;
  name: string;
  decimals: number;
  cmcId: number;
};

export type Chain = {
  id: string;
  name: string;
  rpcUrl?: string;
  assets: Asset[];
};

export type AssetOption = {
  chainId: string;
  chainName: string;
  asset: Asset;
  value: string; // format: chainId:assetSymbol
};

export type QuoteLeg = {
  asset: string; // e.g. "bitcoin:btc"
  amount: string;
  display: string;
  value: string;
};

export type QuoteResult = {
  source: QuoteLeg;
  destination: QuoteLeg;
};

export type QuoteResponse = {
  status: string;
  result: QuoteResult[];
};

interface AssetsState {
  assets: AssetOption[];
  fromAsset: AssetOption | null;
  toAsset: AssetOption | null;
  sendAmount: string;
  receiveAmount: string;
  quote: QuoteResponse | null;
  isLoading: boolean;
  isQuoteLoading: boolean;
  error: string | null;
  quoteDebounceTimer: NodeJS.Timeout | null;
  
  // Actions
  fetchAssets: () => Promise<void>;
  setFromAsset: (asset: AssetOption | null) => void;
  setToAsset: (asset: AssetOption | null) => void;
  setSendAmount: (amount: string) => void;
  swapAssets: () => void;
  getQuote: () => Promise<void>;
  debouncedGetQuote: () => void;
  clearError: () => void;
}

// Helper to get the canonical asset key for backend (e.g., 'bitcoin' for BTC, 'avax' for AVAX, etc.)
function getAssetKeyFromSymbol(symbol: string): string {
  // Add mappings as needed
  const map: Record<string, string> = {
    btc: 'bitcoin',
    avax: 'avax',
    usdt: 'usdt',
  };
  return map[symbol.toLowerCase()] || symbol.toLowerCase();
}

// Helper to build the correct value for backend param (chainId:assetKey)
function buildBackendAssetValue(chainId: string, asset: Asset): string {
  return `${chainId}:${getAssetKeyFromSymbol(asset.symbol)}`;
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export const useAssetsStore = create<AssetsState>()(
  persist(
    (set, get) => ({
      assets: [],
      fromAsset: null,
      toAsset: null,
      sendAmount: '',
      receiveAmount: '',
      quote: null,
      isLoading: false,
      isQuoteLoading: false,
      error: null,
      quoteDebounceTimer: null,

      fetchAssets: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await axios.get(`${API_URLS.QUOTE}/supported-assets`);
          const chains: Chain[] = response.data.result;
          
          const flatOptions: AssetOption[] = [];
          chains.forEach((chain) => {
            chain.assets.forEach((asset) => {
              flatOptions.push({
                chainId: chain.id,
                chainName: chain.name,
                asset,
                // For dropdown, keep value as chainId:assetSymbol for display, but backend param will be built dynamically
                value: `${chain.id}:${asset.symbol}`,
              });
            });
          });
          set({ assets: flatOptions, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch assets:', error);
          set({ 
            error: 'Failed to fetch supported assets', 
            isLoading: false 
          });
        }
      },

      setFromAsset: (asset) => {
        set({ fromAsset: asset });
        // Auto-fetch quote if both assets are selected and amount is set
        const { toAsset, sendAmount } = get();
        if (asset && toAsset && sendAmount && parseFloat(sendAmount) > 0) {
          get().debouncedGetQuote();
        }
      },

      setToAsset: (asset) => {
        set({ toAsset: asset });
        // Auto-fetch quote if both assets are selected and amount is set
        const { fromAsset, sendAmount } = get();
        if (fromAsset && asset && sendAmount && parseFloat(sendAmount) > 0) {
          get().debouncedGetQuote();
        }
      },

      setSendAmount: (amount) => {
        // Prevent negative numbers and invalid input
        const numAmount = parseFloat(amount);
        if (amount === '' || (numAmount >= 0 && !isNaN(numAmount))) {
          set({ sendAmount: amount });
          // Auto-fetch quote if both assets are selected and amount is valid
          const { fromAsset, toAsset } = get();
          if (fromAsset && toAsset && amount && numAmount > 0) {
            get().debouncedGetQuote();
          } else if (amount === '' || numAmount === 0) {
            // Clear quote if amount is empty or zero
            set({ quote: null, receiveAmount: '' });
          }
        }
      },

      swapAssets: () => {
        const { fromAsset, toAsset } = get();
        set({
          fromAsset: toAsset,
          toAsset: fromAsset,
          sendAmount: get().receiveAmount,
          receiveAmount: get().sendAmount,
        });
        // Auto-fetch quote after swap if amount is valid
        const newAmount = get().sendAmount;
        if (toAsset && fromAsset && newAmount && parseFloat(newAmount) > 0) {
          get().debouncedGetQuote();
        }
      },

      debouncedGetQuote: debounce(async () => {
        const { fromAsset, toAsset, sendAmount } = get();
        
        if (!fromAsset || !toAsset || !sendAmount) {
          set({ quote: null, isQuoteLoading: false });
          return;
        }

        const numAmount = parseFloat(sendAmount);
        if (numAmount <= 0 || isNaN(numAmount)) {
          set({ quote: null, receiveAmount: '', isQuoteLoading: false });
          return;
        }

        try {
          set({ isQuoteLoading: true, error: null });
          
          // Format amount based on decimals
          const formattedAmount = (numAmount * Math.pow(10, fromAsset.asset.decimals)).toString();

          // Build correct backend param for 'from' and 'to'
          const fromParam = buildBackendAssetValue(fromAsset.chainId, fromAsset.asset);
          const toParam = buildBackendAssetValue(toAsset.chainId, toAsset.asset);

          const url = `${API_URLS.QUOTE}/quote?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}&amount=${formattedAmount}`;
          
          const response = await axios.get<QuoteResponse>(url);
          
          if (response.data.status === 'Ok' && Array.isArray(response.data.result) && response.data.result.length > 0) {
            // Use the new quote response format
            const quoteResult = response.data.result[0];
            set({ 
              quote: response.data,
              receiveAmount: quoteResult.destination.display,
              isQuoteLoading: false 
            });
          } else {
            set({ 
              error: 'Failed to get quote', 
              isQuoteLoading: false,
              quote: null 
            });
          }
        } catch (error) {
          console.error('Failed to get quote:', error);
          set({ 
            error: 'Failed to get quote', 
            isQuoteLoading: false,
            quote: null 
          });
        }
      }, 500), // 500ms debounce

      getQuote: async () => {
        const { fromAsset, toAsset, sendAmount } = get();
        
        if (!fromAsset || !toAsset || !sendAmount) {
          set({ quote: null, isQuoteLoading: false });
          return;
        }

        const numAmount = parseFloat(sendAmount);
        if (numAmount <= 0 || isNaN(numAmount)) {
          set({ quote: null, receiveAmount: '', isQuoteLoading: false });
          return;
        }

        try {
          set({ isQuoteLoading: true, error: null });
          
          // Format amount based on decimals
          const formattedAmount = (numAmount * Math.pow(10, fromAsset.asset.decimals)).toString();

          // Build correct backend param for 'from' and 'to'
          const fromParam = buildBackendAssetValue(fromAsset.chainId, fromAsset.asset);
          const toParam = buildBackendAssetValue(toAsset.chainId, toAsset.asset);

          const url = `${API_URLS.QUOTE}/quote?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}&amount=${formattedAmount}`;
          
          const response = await axios.get<QuoteResponse>(url);
          
          if (response.data.status === 'Ok' && Array.isArray(response.data.result) && response.data.result.length > 0) {
            // Use the new quote response format
            const quoteResult = response.data.result[0];
            set({ 
              quote: response.data,
              receiveAmount: quoteResult.destination.display,
              isQuoteLoading: false 
            });
          } else {
            set({ 
              error: 'Failed to get quote', 
              isQuoteLoading: false,
              quote: null 
            });
          }
        } catch (error) {
          console.error('Failed to get quote:', error);
          set({ 
            error: 'Failed to get quote', 
            isQuoteLoading: false,
            quote: null 
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'assets-store',
      partialize: (state) => ({
        fromAsset: state.fromAsset,
        toAsset: state.toAsset,
        sendAmount: state.sendAmount,
        receiveAmount: state.receiveAmount,
      }),
    }
  )
);
