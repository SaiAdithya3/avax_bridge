export const LOCAL_STORAGE_KEYS = {
  notification: 'notification',
  deletedOrders: 'deletedOrders',
  evmWallet: 'evmWallet',
  btcWallet: 'btcWallet',
} as const;

export const WALLET_TYPES = {
  EVM: 'evm',
  BTC: 'btc',
} as const;

export const SUPPORTED_CHAINS = {
  AVALANCHE: 43114,
  ETHEREUM: 1,
  POLYGON: 137,
} as const;

export const network = 'testnet';