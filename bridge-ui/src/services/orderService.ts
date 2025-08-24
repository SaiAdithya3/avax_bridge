import { API_URLS } from '../constants/constants';
import type { CreateOrderRequest, CreateOrderResponse, Order } from '../types/api';
import { Err, Ok, trim0x, with0x } from '@gardenfi/utils';
import { sha256, type WalletClient } from 'viem';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { DigestKey } from '../utils/digestKey';
import type { AssetOption } from '../store/assetsStore';
import axios from 'axios';
import { evmRedeem } from './contractService';
import { BitcoinNetwork, BitcoinProvider, BitcoinWallet, toXOnly } from '@gardenfi/core';

/**
 * You must pass in all required data to these service functions.
 * Do not use React hooks in this file.
 * Instead, pass in the values from your component.
 */

export const generateSecret = async (nonce: string): Promise<{ secret: `0x${string}`; secretHash: `0x${string}` }> => {
    const signature = await signMessage(nonce);
    if (!signature.ok) {
        throw new Error('Failed to sign message');
    }

    const secret = sha256(with0x(signature.val));
    const secretHash = sha256(secret);
    return { secret, secretHash };
}

const signMessage = async (nonce: string) => {
    const digestKey = DigestKey.getDigestKey();
    if (!digestKey) {
        throw new Error('No digest key found');
    }
    const ECPair = ECPairFactory(ecc);

    const signMessage = 'Avalanche Bridge' + nonce.toString();
    const signMessageBuffer = Buffer.from(signMessage, 'utf8');
    const hash = sha256(signMessageBuffer);

    const digestKeyBuf = Buffer.from(trim0x(digestKey), 'hex');
    if (digestKeyBuf.length !== 32) {
        return Err('Invalid private key length. Expected 32 bytes.');
    }
    const keyPair = ECPair.fromPrivateKey(digestKeyBuf);
    const signature = keyPair.sign(Buffer.from(trim0x(hash), 'hex'));
    return Ok(signature.toString('hex'));
}

// Utility to determine if a chain is EVM-based
export const isEVMChain = (chain: string): boolean => {
    // Add more EVM chain names as needed
    const evmChains = ['arbitrum_sepolia', 'avalanche_testnet'];
    return evmChains.includes(chain.toLowerCase());
};

// Utility to determine if a chain is Bitcoin
export const isBitcoinChain = (chain: string): boolean => {
    return chain.toLowerCase() === 'bitcoin_testnet' || chain.toLowerCase() === 'bitcoin';
};

/**
 * Fetch user orders from the orderbook
 * This is the single source of truth for fetching orders
 */
export const fetchUserOrders = async (userAddress: string): Promise<Order[]> => {
    try {
        const response = await axios.get(`${API_URLS.ORDERBOOK}/orders/user/${userAddress}`);
        
        if (response.status !== 200) {
            throw new Error('Failed to fetch user orders from orderbook');
        }
        
        return response.data.result || [];
    } catch (error) {
        console.error('Error fetching user orders:', error);
        throw error;
    }
};

/**
 * Filter orders that are ready for redemption
 * Orders are ready when both source_swap and destination_swap are initiated but destination_swap is not redeemed
 */
export const filterPendingOrders = (orders: Order[]): Order[] => {
    return orders.filter(order => {
        const { source_swap, destination_swap } = order;
        
        // Check if both swaps are initiated
        const sourceInitiated = source_swap.initiate_tx_hash && source_swap.initiate_tx_hash !== '';
        const destinationInitiated = destination_swap.initiate_tx_hash && destination_swap.initiate_tx_hash !== '';
        
        // Check if destination swap is not redeemed
        const destinationNotRedeemed = !destination_swap.redeem_tx_hash || destination_swap.redeem_tx_hash === '';
        
        return sourceInitiated && destinationInitiated && destinationNotRedeemed;
    });
};

/**
 * Build the order request.
 * All required data must be passed in from the component.
 */
export const buildCreateOrderRequest = async ({
    fromAsset,
    toAsset,
    sendAmount,
    receiveAmount,
    evmAddress,
    btcAddress,
}: {
    fromAsset: AssetOption;
    toAsset: AssetOption;
    sendAmount: number;
    receiveAmount: number;
    evmAddress: string;
    btcAddress: string;
}): Promise<CreateOrderRequest> => {
    if (!fromAsset || !toAsset || !sendAmount || !receiveAmount) {
        throw new Error('Invalid swap data');
    }
    let initiator_source_address: string | undefined = undefined;
    let initiator_destination_address: string | undefined = undefined;
    let bitcoin_optional_recipient: string | undefined = undefined;

    const bitcoinProvider = new BitcoinProvider(
        BitcoinNetwork.Testnet,
        'https://48.217.250.147:18443',
      );
      const btcWallet = BitcoinWallet.fromPrivateKey(
        'af530c3d2212740a8428193fce82bfddcf7e83bee29a2b9b2f25b5331bae1bf5',
        bitcoinProvider,
        { pkType: 'p2wpkh', pkPath: "m/84'/0'/0'/0/0" },
      );
      const pubKey = await btcWallet.getPublicKey();
      const pubKeyXOnly  = toXOnly(pubKey)
    // Set initiator_source_address based on fromChain
    if (isEVMChain(fromAsset.chainId)) {
        initiator_source_address = evmAddress;
    } else if (isBitcoinChain(fromAsset.chainId)) {
        initiator_source_address = pubKeyXOnly
    }
    // Set initiator_destination_address based on toChain
    if (isEVMChain(toAsset.chainId)) {
        initiator_destination_address = evmAddress;
    } else if (isBitcoinChain(toAsset.chainId)) {
        initiator_destination_address = pubKeyXOnly
    }
    if ((isBitcoinChain(fromAsset.chainId) && !isBitcoinChain(toAsset.chainId)) || (isBitcoinChain(toAsset.chainId) && !isBitcoinChain(fromAsset.chainId))) {
        bitcoin_optional_recipient = btcAddress;
    }
    const nonce = Date.now().toString();
    const { secretHash } = await generateSecret(nonce);

    if (!initiator_source_address || !initiator_destination_address || !secretHash) {
        throw new Error('Invalid initiator addresses');
    }

    return {
        from: fromAsset.value.toLowerCase(),
        to: toAsset.value.toLowerCase(),
        source_amount: sendAmount.toString(),
        destination_amount: receiveAmount.toString(),
        nonce: nonce,
        initiator_source_address: initiator_source_address,
        initiator_destination_address: initiator_destination_address,
        secret_hash: trim0x(secretHash),
        bitcoin_optional_recipient: bitcoin_optional_recipient || null,
    };
};

/**
 * Create an order.
 * All required data must be passed in from the component.
 */
export const createOrder = async ({
    fromAsset,
    toAsset,
    sendAmount,
    receiveAmount,
    evmAddress,
    btcAddress,
}: {
    fromAsset: AssetOption
    toAsset: AssetOption;
    sendAmount: string;
    receiveAmount: string;
    evmAddress: string;
    btcAddress: string;
}): Promise<CreateOrderResponse> => {

    const formattedSendAmount = (Number(sendAmount) * Math.pow(10, fromAsset.asset.decimals));
    const formattedReceiveAmount = (Number(receiveAmount) * Math.pow(10, toAsset.asset.decimals));
    
    const orderData = await buildCreateOrderRequest({
        fromAsset,
        toAsset,
        sendAmount: formattedSendAmount,
        receiveAmount: formattedReceiveAmount,
        evmAddress,
        btcAddress,
    });
    console.log('orderData', orderData);
    try {
        const response = await fetch(`${API_URLS.ORDERBOOK}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: CreateOrderResponse = await response.json();
        return data;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

// Order status types
export type OrderStatus = 
  | 'created'
  | 'deposit_detected'
  | 'deposit_confirmed'
  | 'redeeming'
  | 'completed'
  | 'counterPartyInitiated'
  | 'counterPartyRedeemed'

// Centralized function to parse order action/state
export const parseAction = (order: any): OrderStatus => {
  // Check if swap is completed
  if (order.destination_swap?.redeem_tx_hash) {
    return 'completed';
  }

  if (order.source_swap?.initiate_tx_hash && !order.source_swap?.initiate_block_number) {
    return 'deposit_detected';
  }

  if (order.source_swap?.initiate_block_number && !order.destination_swap?.initiate_tx_hash) {
    return 'deposit_confirmed';
  }
  
  // Check if source is initiated but destination not initiated (counter party needs to initiate)
  if (order.source_swap?.initiate_tx_hash && !order.destination_swap?.initiate_tx_hash) {
    return 'counterPartyInitiated';
  }
  
  // Check if redeeming is in progress
  if (order.source_swap?.initiate_tx_hash && order.destination_swap?.initiate_tx_hash) {
    return 'redeeming';
  }
  
  if (order.source_swap?.initiate_tx_hash && order.destination_swap?.initiate_tx_hash && !order.destination_swap?.redeem_tx_hash) {
    return 'counterPartyRedeemed';
  }
  // Default: awaiting deposit
  return 'created';
};

// Get filtered orders by status
export const getFilteredOrders = (orders: (Order & {status: OrderStatus})[], statusFilter: OrderStatus | 'all'): (Order & {status: OrderStatus})[] => {
  if (statusFilter === 'all') {
    return orders;
  }
  return orders.filter(order => order.status === statusFilter);
};

// Get order status display info
export const getOrderStatusInfo = (status: OrderStatus) => {
  const statusConfig = {
    created: {
      label: 'Awaiting Deposit',
      color: 'bg-gray-100 text-gray-800',
      icon: '📋',
      description: 'Order has been created and is waiting for deposit'
    },
    deposit_detected: {
      label: 'Deposit Detected 0/1',
      color: 'bg-yellow-100 text-yellow-800',
      icon: '🔍',
      description: 'Deposit transaction detected, waiting for confirmation'
    },
    deposit_confirmed: {
      label: 'Deposit Confirmed',
      color: 'bg-blue-100 text-blue-800',
      icon: '✅',
      description: 'Deposit confirmed, ready for destination transaction'
    },
    redeeming: {
      label: 'Redeeming',
      color: 'bg-purple-100 text-purple-800',
      icon: '🔄',
      description: 'Swap is being redeemed'
    },
    completed: {
      label: 'Swap Completed',
      color: 'bg-emerald-100 text-emerald-800',
      icon: '🎉',
      description: 'Swap has been completed successfully'
    },
    counterPartyInitiated: {
      label: 'Counter Party Initiated',
      color: 'bg-orange-100 text-orange-800',
      icon: '🤝',
      description: 'Counter party has initiated their side of the swap'
    },
    counterPartyRedeemed: {
      label: 'Ready for Redemption',
      color: 'bg-green-100 text-green-800',
      icon: '💰',
      description: 'Ready to redeem the swap'
    },
    pending: {
      label: 'Pending',
      color: 'bg-gray-100 text-gray-800',
      icon: '⏳',
      description: 'Order is in pending state'
    }
  };

  // Return the status config or a default if status is not found
  return statusConfig[status] || {
    label: 'Unknown Status',
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
    description: 'Unknown order status'
  };
};
