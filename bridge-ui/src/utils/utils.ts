import { LOCAL_STORAGE_KEYS } from '../constants/constants';

export const clearLocalStorageExcept = (keysToKeep: string[]) => {
  const allKeys = Object.values(LOCAL_STORAGE_KEYS);
  allKeys.forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
};

export const formatAddress = (address: string, length: number = 6): string => {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
};

export const formatBalance = (balance: string | number, decimals: number = 6): string => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  return num.toFixed(decimals);
};

export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidBTCAddress = (address: string): boolean => {
  // Basic BTC address validation (can be enhanced)
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || 
         /^bc1[a-z0-9]{39,59}$/.test(address);
};
