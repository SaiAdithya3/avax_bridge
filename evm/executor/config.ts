import dotenv from 'dotenv';

dotenv.config();

// Database Configuration
export const DB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  name: process.env.MONGODB_DB || 'avax_bridge',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};

// Executor Configuration
export const EXECUTOR_CONFIG = {
  pollInterval: parseInt(process.env.POLL_INTERVAL || '2000'), // 2 seconds
  maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000'),
};

// Wallet Configuration
export const WALLET_CONFIG = {
  privateKey: process.env.EVM_PRIVATE_KEY || '',
  chainId: parseInt(process.env.CHAIN_ID || '43113'), // Avalanche testnet default
  rpcUrl: process.env.EVM_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  avalancheRpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
};

if (!WALLET_CONFIG.privateKey) {
  throw new Error('EVM_PRIVATE_KEY environment variable is required');
}