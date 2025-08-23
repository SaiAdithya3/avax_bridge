import { useWalletStore } from '../store/walletStore';
import { DigestKey } from '../utils/digestKey';

export const useDigestKey = () => {
  const { digestKey, setDigestKey, getDigestKey } = useWalletStore();

  const generateNewDigestKey = () => {
    const newKey = DigestKey.getDigestKey();
    setDigestKey(newKey);
    return newKey;
  };

  const clearDigestKey = () => {
    DigestKey.clearDigestKey();
    setDigestKey(null);
  };

  const hasDigestKey = () => {
    return DigestKey.hasDigestKey();
  };

  return {
    digestKey,
    getDigestKey,
    generateNewDigestKey,
    clearDigestKey,
    hasDigestKey,
  };
};
