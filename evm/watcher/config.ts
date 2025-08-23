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
    startBlock: 184658726,
    rpcUrl: "https://arb-sepolia.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
    maxBlockSpan: 2000,
    contracts: [
      {
        address: "0xC90Ad772eCc10a52a681ceDAE6EbBD3470A0c829", // USDC
        type: "erc20"
      }
    ]
  },
  {
    id: 'avalanche_testnet',
    startBlock: 32062545,
    rpcUrl: "https://avax-fuji.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
    maxBlockSpan: 1000,
    contracts: [
      {
        address: "0x5425890298aed601595a70AB815c96711a31Bc65", // USDC
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
