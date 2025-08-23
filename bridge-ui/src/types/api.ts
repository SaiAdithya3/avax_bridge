export type CreateOrderRequest = {
  from: string; // e.g. "arbitrum_sepolia:usdc"
  to: string;   // e.g. "avalanche_testnet:usdc"
  source_amount: string;
  destination_amount: string;
  initiator_source_address: string;
  initiator_destination_address: string;
  secret_hash: string;
  bitcoin_optional_recipient: string | null;
  nonce: string;
};

export type CreateOrderResponse = {
  status: 'ok';
  result: string;
};

export type SwapFormData = {
  fromChain: string;
  toChain: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
};

export type CreateOrder = {
  from: string; // e.g. "arbitrum_sepolia:usdc"
  to: string;   // e.g. "avalanche_testnet:usdc"
  source_amount: string;
  destination_amount: string;
  initiator_source_address: string;
  initiator_destination_address: string;
  secret_hash: string;
  bitcoin_optional_recipient: string | null;
  nonce: string;
  create_id: string;
};

export type Order = {
  created_at: string;
  source_swap: Swap;
  destination_swap: Swap;
  create_order: CreateOrder;
};

export type Swap = {
  created_at: string;
  swap_id: string;
  chain: Chain;
  asset: string;
  htlc_address: string;
  token_address: string;
  initiator: string;
  redeemer: string;
  filled_amount: string;
  amount: string;
  timelock: number;
  secret_hash: string;
  secret: string | null;
  initiate_tx_hash: string | null;
  redeem_tx_hash: string | null;
  refund_tx_hash: string | null;
  initiate_block_number: string | null;
  redeem_block_number: string | null;
  refund_block_number: string | null;
  deposit_address: string | null;
};

export declare const Chains: {
  readonly bitcoin_testnet: "bitcoin_testnet";
  readonly arbitrum_sepolia: "arbitrum_sepolia";
  readonly avalanche_testnet: "avalanche_testnet";
};
export type Chain = keyof typeof Chains;

// EVM Chain type for supported chains
export type EvmChain = 'avalanche_testnet' | 'arbitrum_sepolia';

// Action types for order processing
export type OrderAction = 
    | 'matched'
    | 'initiateDetected'
    | 'redeemDetected'
    | 'completed'
    | 'counterPartyInitiated'
    | 'counterPartyRedeemed'
    | 'pending';

// Order status with action
export type OrderWithAction = {
    order: Order;
    action: OrderAction;
    reason: string;
}

// Contract interaction types
export type InitiateParams = {
    secretHash: `0x${string}`;
    timelock: bigint;
    amount: bigint;
    redeemer: `0x${string}`;
    asset: string;
};

export type RedeemParams = {
    orderId: string;
    secret: string;
};
