export interface ChainConfig {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  blockTime: number; // in seconds
  confirmations: number;
  contracts: ContractConfig[];
}

export interface ContractConfig {
  address: string;
  name: string;
  type: 'erc20'; // Contract type determines which ABI to use
  startBlock?: number;
  events: string[]; // event signatures to watch
}

export interface WatchedEvent {
  id: string;
  chainId: string;
  contractAddress: string;
  contractName: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  eventName: string;
  eventSignature: string;
  eventData: any;
  parsedArgs: any;
  timestamp: Date;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockInfo {
  number: number;
  hash: string;
  timestamp: number;
  processed: boolean;
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatcherStatus {
  chainId: string;
  lastProcessedBlock: number;
  currentBlock: number;
  isRunning: boolean;
  lastActivity: Date;
  errorCount: number;
  lastError?: string;
}

export interface EventHandler {
  eventName: string;
  handler: (event: WatchedEvent) => Promise<void>;
}

export interface WatcherOptions {
  pollInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  batchSize?: number;
}
