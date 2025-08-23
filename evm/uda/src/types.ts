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

// EVM Chain type for supported chains (excluding bitcoin)
export type EvmChain = 'avalanche_testnet' | 'arbitrum_sepolia';

// Chain Configuration Type
export type ChainConfig = {
  identifier: EvmChain;
  rpc_url: string;
  private_key: string;
  htlc_registry_address: string;
  chain_id: number;
  name: string;
};

// Chain Configurations Type
export type ChainConfigs = {
  [K in EvmChain]: ChainConfig;
};

// UDA Balance Check Result
export type UDABalanceCheck = {
    orderId: string;
    chain: EvmChain;
    tokenAddress: string;
    depositAddress: string;
    requiredAmount: string;
    currentBalance: string;
    hasEnoughBalance: boolean;
    timestamp: Date;
};



// AsyncResult type alias for better readability
export type AsyncResult<T, E> = Result<T, E>;
