export interface Chain {
  id: string;
  startBlock: number;
  rpcUrl: string;
  maxBlockSpan: number; // Maximum blocks to process in each batch
  contracts: ContractConfig[];
}

export interface ContractConfig {
  address: string;
  type: 'erc20' | 'atomic_swap';
}

export interface WatchedEvent {
  id: string;
  chainId: string;
  contractAddress: string;
  contractType: string;
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
