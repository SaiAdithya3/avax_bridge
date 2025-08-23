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

export interface WatcherOptions {
  pollInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  batchSize?: number;
}
