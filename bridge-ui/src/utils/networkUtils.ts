import { createWalletClient, http, custom, type WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { type AsyncResult, Err, Ok } from '@gardenfi/utils';
import { type EvmChain } from '../types/api';

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
  
  return isSupportedChain(sourceChain) && isSupportedChain(destinationChain);
};

// Switch or add network function
export const switchOrAddNetwork = async (
  chain: EvmChain,
  walletClient: WalletClient,
): Promise<AsyncResult<{ message: string; walletClient: WalletClient }, string>> => {
  console.log("chain", chain)
  const chainID = evmToViemChainMap[chain];
  console.log("chainID", chainID)
  const currentChainId = await walletClient.getChainId();
  console.log("currentChainId", currentChainId)
  if (chainID) {
    try {
      await walletClient.switchChain({ id: chainID.id });
      const newWalletClient = createWalletClient({
        account: walletClient.account,
        chain: chainID,
        transport: custom(walletClient.transport),
      });
      return Ok({
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

          return Ok({
            message: "Added network",
            walletClient: newWalletClient as WalletClient,
          });
        } catch (addError) {
          return Err("Failed to add network");
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
        return Ok({
          message: "Added network",
          walletClient: newWalletClient as WalletClient,
        });
      } else {
        return Err("Failed to switch network");
      }
    }
  } else {
    return Err("Chain not supported");
  }
};
