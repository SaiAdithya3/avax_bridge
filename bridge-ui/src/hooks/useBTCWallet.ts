import { useWalletStore } from "../store/walletStore";
import { network as networkType } from "../constants/constants";

export const useBTCWallet = () => {
  const { btcWallet, setBTCWallet, disconnectBTC } = useWalletStore();

  const connect = async (address: string, network: string = networkType) => {
    try {
      setBTCWallet(address, network, true);
      return { success: true };
    } catch (error) {
      console.error('Failed to connect BTC wallet:', error);
      return { success: false, error };
    }
  };

  const disconnect = () => {
    disconnectBTC();
  };

  return {
    address: btcWallet.address,
    isConnected: btcWallet.isConnected,
    network: btcWallet.network,
    connect,
    disconnect,
  };
};
