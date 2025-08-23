import { ChainConfig, ContractConfig } from './src/types';

// Database Configuration
export const DB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
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

// RPC Endpoints
export const RPC_ENDPOINTS = {
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  optimism: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'
};

// Contract Configurations
export const CONTRACTS: { [chainId: string]: ContractConfig[] } = {
  ethereum: [
    // Example: USDC Token (ERC20)
    {
      address: "0xA0b86a33E6441b8c4C1C1b8B4b2b8B4b2b8B4b2b",
      name: "USDC Token",
      type: "erc20",
      startBlock: 15000000,
      events: ["Transfer", "Approval"]
    },
    // Example: USDT Token (ERC20)
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      name: "USDT Token",
      type: "erc20",
      startBlock: 15000000,
      events: ["Transfer", "Approval"]
    }
  ]
};

// Chain Configurations
export const CHAIN_CONFIGS: ChainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    rpcUrl: RPC_ENDPOINTS.ethereum,
    chainId: 1,
    blockTime: 12,
    confirmations: 12,
    contracts: CONTRACTS.ethereum || []
  },
  {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    rpcUrl: RPC_ENDPOINTS.avalanche,
    chainId: 43114,
    blockTime: 2,
    confirmations: 20,
    contracts: CONTRACTS.avalanche || []
  },
  {
    id: 'polygon',
    name: 'Polygon',
    rpcUrl: RPC_ENDPOINTS.polygon,
    chainId: 137,
    blockTime: 2,
    confirmations: 200,
    contracts: CONTRACTS.polygon || []
  },
  {
    id: 'bsc',
    name: 'Binance Smart Chain',
    rpcUrl: RPC_ENDPOINTS.bsc,
    chainId: 56,
    blockTime: 3,
    confirmations: 15,
    contracts: CONTRACTS.bsc || []
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    rpcUrl: RPC_ENDPOINTS.arbitrum,
    chainId: 42161,
    blockTime: 1,
    confirmations: 10,
    contracts: CONTRACTS.arbitrum || []
  },
  {
    id: 'optimism',
    name: 'Optimism',
    rpcUrl: RPC_ENDPOINTS.optimism,
    chainId: 10,
    blockTime: 2,
    confirmations: 10,
    contracts: CONTRACTS.optimism || []
  }
];

// Helper functions
export const getChainConfig = (chainId: string): ChainConfig | undefined => {
  return CHAIN_CONFIGS.find(chain => chain.id === chainId);
};

export const addContractToChain = (chainId: string, contractConfig: ContractConfig): void => {
  const chain = CHAIN_CONFIGS.find(c => c.id === chainId);
  if (chain) {
    chain.contracts.push(contractConfig);
  }
  
  // Also update the CONTRACTS object
  if (!CONTRACTS[chainId]) {
    CONTRACTS[chainId] = [];
  }
  CONTRACTS[chainId].push(contractConfig);
};

export const removeContractFromChain = (chainId: string, contractAddress: string): void => {
  const chain = CHAIN_CONFIGS.find(c => c.id === chainId);
  if (chain) {
    chain.contracts = chain.contracts.filter(c => c.address !== contractAddress);
  }
  
  if (CONTRACTS[chainId]) {
    CONTRACTS[chainId] = CONTRACTS[chainId].filter(c => c.address !== contractAddress);
  }
};

export const getContractsForChain = (chainId: string): ContractConfig[] => {
  return CONTRACTS[chainId] || [];
};

export const getAllContracts = (): { [chainId: string]: ContractConfig[] } => {
  return CONTRACTS;
};
