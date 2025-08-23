import { Result } from 'neverthrow';

export type CreateOrder = {
    source_chain: string;
    destination_chain: string;
    source_asset: string;
    destination_asset: string;
    source_amount: string;
    destination_amount: string;
    initiator_source_address?: string;
    initiator_destination_address?: string;
    secret_hash?: string;
    created_at: string;
    create_id: string;
    input_token_price: number;
    output_token_price: number;
    bitcoin_optional_recipient?: string;
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
    timelock: string;
    amount: string;
    secret_hash: string;
    secret: string;
    initiate_tx_hash: string;
    redeem_tx_hash: string;
    refund_tx_hash: string;
    initiate_block_number: string | null;
    redeem_block_number: string | null;
    refund_block_number: string | null;
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
};

// AsyncResult type alias for better readability
export type AsyncResult<T, E> = Result<T, E>;

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
