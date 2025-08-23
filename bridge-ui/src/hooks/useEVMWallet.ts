import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { useChainId } from "wagmi";
import { clearLocalStorageExcept } from "../utils/utils";
import { LOCAL_STORAGE_KEYS } from "../constants/constants";

export const useEVMWallet = () => {
  const { data: walletClient } = useWalletClient();
  const { address, isConnected, connector } = useAccount();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { status, connectors, isPending, connectAsync } = useConnect();
  const chainId = useChainId();

  const disconnect = () => {
    disconnectWallet();
    clearLocalStorageExcept([
      LOCAL_STORAGE_KEYS.notification,
      LOCAL_STORAGE_KEYS.deletedOrders,
    ]);
  };

  return {
    walletClient,
    address,
    connectors,
    isPending,
    connector,
    isConnected,
    status,
    disconnect,
    connectAsync,
    chainId,
  };
};
