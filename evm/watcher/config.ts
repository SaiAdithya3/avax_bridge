import { Chain } from './src/types';

// Database Configuration
export const DB_CONFIG = {
  uri: "mongodb+srv://gsnr1925:4ccbmCombV2Zp1tC@cluster0.owm6ysq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  name: process.env.MONGODB_DB || 'evm_watcher',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};

// Watcher Configuration
export const WATCHER_CONFIG = {
  pollInterval: parseInt(process.env.POLL_INTERVAL || '1000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000'),
  batchSize: parseInt(process.env.BATCH_SIZE || '10')
};

// Chain Configuration
export const chainConfig: Chain[] = [
  {
    id: 'arbitrum_sepolia',
    startBlock: 186843718,
    rpcUrl: "https://arb-sepolia.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
    maxBlockSpan: 2000,
    contracts: [
      {
        address: "0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112", // USDC
        type: "erc20"
      },
      {
        address: "0x6B1c656ad724C246049EF586Fa35D217A8db13A0", // Atomic Swap
        type: "atomic_swap"
      },
      {
        address: "0x00c1Df9bf9C7ff7F3c2A8F9e9af72DA95b350D34", // WBTC
        type: "erc20"
      }
    ]
  },
  {
    id: 'avalanche_testnet',
    startBlock: 45130202,
    rpcUrl: "https://avax-fuji.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
    maxBlockSpan: 1000,
    contracts: [
      {
        address: "0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112", // USDC
        type: "erc20"
      },
      {
        address: "0x6B1c656ad724C246049EF586Fa35D217A8db13A0", // Atomic Swap
        type: "atomic_swap"
      },
      {
        address: "0x00c1Df9bf9C7ff7F3c2A8F9e9af72DA95b350D34", // WBTC
        type: "erc20"
      }
    ]
  }
];

// Helper functions
export const getChainConfig = (chainId: string): Chain | undefined => {
  return chainConfig.find(chain => chain.id === chainId);
};

export const addContractToChain = (chainId: string, contractConfig: any): void => {
  const chain = chainConfig.find(c => c.id === chainId);
  if (chain) {
    chain.contracts.push(contractConfig);
  }
};

export const removeContractFromChain = (chainId: string, contractAddress: string): void => {
  const chain = chainConfig.find(c => c.id === chainId);
  if (chain) {
    chain.contracts = chain.contracts.filter(c => c.address !== contractAddress);
  }
};

export const getContractsForChain = (chainId: string): any[] => {
  const chain = chainConfig.find(c => c.id === chainId);
  return chain ? chain.contracts : [];
};

export const getAllContracts = (): { [chainId: string]: any[] } => {
  const result: { [chainId: string]: any[] } = {};
  chainConfig.forEach(chain => {
    result[chain.id] = chain.contracts;
  });
  return result;
};
