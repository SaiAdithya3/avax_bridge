import { createWalletClient, http, custom, type WalletClient } from 'viem';
import { avalanche, arbitrumSepolia } from 'viem/chains';
import { Result, err, ok } from 'neverthrow';
import { EvmChain } from '../types';

// Map EVM chains to Viem chains
export const evmToViemChainMap: Record<EvmChain, any> = {
  avalanche_testnet: {
    id: 43113,
    name: 'Avalanche Fuji Testnet',
    network: 'avalanche-fuji',
    nativeCurrency: {
      decimals: 18,
      name: 'Avalanche',
      symbol: 'AVAX',
    },
    rpcUrls: {
      default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },
      public: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },
    },
    blockExplorers: {
      default: { name: 'SnowTrace', url: 'https://testnet.snowtrace.io' },
    },
  },
  arbitrum_sepolia: arbitrumSepolia,
};

// Check if a chain is supported
export const isSupportedChain = (chain: string): chain is EvmChain => {
  return chain === 'avalanche_testnet' || chain === 'arbitrum_sepolia';
};

// Check if order is for supported chains
export const isOrderForSupportedChains = (order: any): boolean => {
  const sourceChain = order.source_swap?.chain;
  const destinationChain = order.destination_swap?.chain;
  
  return isSupportedChain(sourceChain) || isSupportedChain(destinationChain);
};

// Switch or add network function
export const switchOrAddNetwork = async (
  chain: EvmChain,
  walletClient: WalletClient,
): Promise<Result<{ message: string; walletClient: WalletClient }, string>> => {
  const chainID = evmToViemChainMap[chain];
  const currentChainId = await walletClient.getChainId();
  
  if (chainID) {
    try {
      if (chainID.id === currentChainId) {
        return ok({ message: "Already on the network", walletClient });
      }
      
      await walletClient.switchChain({ id: chainID.id });
      const newWalletClient = createWalletClient({
        account: walletClient.account,
        chain: chainID,
        transport: custom(walletClient.transport),
      });

      return ok({
        message: "Switched chain",
        walletClient: newWalletClient as WalletClient,
      });
    } catch (error: any) {
      // If switching fails, attempt to add the network
      if (error.code === 4902 || error.code === -32603) {
        try {
          await walletClient.addChain({ chain: chainID });
          const newWalletClient = createWalletClient({
            account: walletClient.account,
            chain: chainID,
            transport: custom(walletClient.transport),
          });

          return ok({
            message: "Added network",
            walletClient: newWalletClient as WalletClient,
          });
        } catch (addError) {
          return err("Failed to add network");
        }
      } else if (
        error.body?.method?.includes("wallet_switchEthereumChain") ||
        error.message?.includes("wallet_switchEthereumChain")
      ) {
        const newWalletClient = createWalletClient({
          account: walletClient.account,
          chain: chainID,
          transport: http(),
        });
        return ok({
          message: "Added network",
          walletClient: newWalletClient as WalletClient,
        });
      } else {
        return err("Failed to switch network");
      }
    }
  } else {
    return err("Chain not supported");
  }
};
