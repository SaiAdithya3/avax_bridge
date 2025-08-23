export interface Chain {
  id: string;
  startBlock: number;
  rpcUrl: string;
  maxBlockSpan: number; // Maximum blocks to process in each batch
  contracts: ContractConfig[];
}

export interface ContractConfig {
  address: string;
  type: 'erc20' | 'atomic_swap' | 'registry';
}

// Enhanced event data types based on ABI definitions
export interface ERC20EventData {
  Transfer: {
    from: string;
    to: string;
    value: string;
  };
  Approval: {
    owner: string;
    spender: string;
    value: string;
  };
}

export interface AtomicSwapEventData {
  Initiated: {
    orderID: string;
    secretHash: string;
    amount: string;
  };
  Redeemed: {
    orderID: string;
    secretHash: string;
    secret: string;
  };
  Refunded: {
    orderID: string;
  };
  EIP712DomainChanged: {};
}

export interface RegistryEventData {
  ATOMIC_SWAPAdded: {
    ATOMIC_SWAP: string;
  };
  NativeATOMIC_SWAPAdded: {
    nativeATOMIC_SWAP: string;
  };
  NativeUDACreated: {
    addressNativeUDA: string;
    refundAddress: string;
  };
  NativeUDAImplUpdated: {
    impl: string;
  };
  OwnershipTransferred: {
    previousOwner: string;
    newOwner: string;
  };
  UDACreated: {
    addressUDA: string;
    refundAddress: string;
    token: string;
  };
  UDAImplUpdated: {
    impl: string;
  };
}

export type AllEventData = ERC20EventData & AtomicSwapEventData & RegistryEventData;

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
  eventData: any; // Raw log data from blockchain
  parsedArgs: any; // Parsed arguments from ABI
  // Enhanced data fields for complete event information
  rawLog: {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  };
  // Complete parsed event data with proper typing
  eventDataTyped: Partial<AllEventData[keyof AllEventData]>;
  // Additional metadata
  gasUsed?: string;
  gasPrice?: string;
  // Note: These gas properties might not be available in all ethers versions
  // effectiveGasPrice?: string;
  // cumulativeGasUsed?: string;
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

// Event processing statistics
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByContract: Record<string, number>;
  lastProcessedEvent: Date;
  processingErrors: number;
}
