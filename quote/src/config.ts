export interface Asset {
  symbol: string;
  name: string;
  decimals: number;
  cmcId: number;
}

export interface Chain {
  id: string;
  name: string;
  rpcUrl?: string;
}

export interface Config {
  port: number;
  coinMarketCap: {
    apiKey: string;
    baseUrl: string;
  };
  supportedAssets: Record<string, Asset>;
  supportedChains: Record<string, Chain>;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  coinMarketCap: {
    apiKey: process.env.CMC_API_KEY || '',
    baseUrl: 'https://pro-api.coinmarketcap.com/v1'
  },
  supportedAssets: {
    bitcoin: {
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      cmcId: 1
    },
    avax: {
      symbol: 'AVAX',
      name: 'Avalanche',
      decimals: 18,
      cmcId: 5805
    },
    usdt: {
      symbol: 'USDT',
      name: 'Tether',
      decimals: 6,
      cmcId: 825
    }
  },
  supportedChains: {
    avalanche_testnet: {
      id: 'avalanche_testnet',
      name: 'Avalanche Testnet',
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc'
    },
    bitcoin_testnet: {
      id: 'bitcoin_testnet',
      name: 'Bitcoin Testnet'
    },
    arbitrum_sepolia: {
      id: 'arbitrum_sepolia',
      name: 'Arbitrum Sepolia',
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc'
    }
  }
};
