import dotenv from 'dotenv';

dotenv.config();

// Main Configuration Object
export const CONFIG = {
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || "mongodb+srv://gsnr1925:4ccbmCombV2Zp1tC@cluster0.owm6ysq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    name: process.env.MONGODB_DB || 'orderbook',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // Chain Configurations
  chains: {
    avalanche_testnet: {
      identifier: 'avalanche_testnet',
      rpc_url: "https://avax-fuji.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
      private_key: process.env.AVALANCHE_PRIVATE_KEY || '',
      htlc_registry_address: "0x66F20a5Fbf43e4B36Ac9e2D9DE33E8B8cAfD3ab7",
      chain_id: 43113,
      name: 'Avalanche C-Chain Testnet'
    },
    arbitrum_sepolia: {
      identifier: 'arbitrum_sepolia',
      rpc_url: "https://arb-sepolia.g.alchemy.com/v2/GE3ckFWo2EhIEsrrYkc55",
      private_key: process.env.ARBITRUM_PRIVATE_KEY || '',
      htlc_registry_address: "0x66F20a5Fbf43e4B36Ac9e2D9DE33E8B8cAfD3ab7",
      chain_id: 421614,
      name: 'Arbitrum Sepolia Testnet'
    }
  },

  // UDA Watcher Configuration
  uda: {
    pollInterval: parseInt(process.env.UDA_POLL_INTERVAL || '5000'), // 5 seconds
    maxRetries: parseInt(process.env.UDA_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.UDA_RETRY_DELAY || '5000'),
  },


};

// Legacy exports for backward compatibility (deprecated)
export const DB_CONFIG = CONFIG.database;
export const RPC_CONFIG = Object.fromEntries(
  Object.entries(CONFIG.chains).map(([key, chain]) => [key, chain.rpc_url])
);
export const UDA_CONFIG = CONFIG.uda;
