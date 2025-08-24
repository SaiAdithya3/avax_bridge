import { API_URLS } from '../constants/constants';
import type { CreateOrderRequest, CreateOrderResponse, Order } from '../types/api';
import { Err, Ok, trim0x, with0x } from '@gardenfi/utils';
import { sha256 } from 'viem';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { DigestKey } from '../utils/digestKey';
import type { AssetOption } from '../store/assetsStore';
import axios from 'axios';

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

    // Set initiator_source_address based on fromChain
    if (isEVMChain(fromAsset.chainId)) {
        initiator_source_address = evmAddress;
    } else if (isBitcoinChain(fromAsset.chainId)) {
        initiator_source_address = 'b3775c0b7fac3f54098d9aaa401bf3f0a1c6ca9f49205060c987d3b51d9ce2e8';
    }
    // Set initiator_destination_address based on toChain
    if (isEVMChain(toAsset.chainId)) {
        initiator_destination_address = evmAddress;
    } else if (isBitcoinChain(toAsset.chainId)) {
        initiator_destination_address = 'b3775c0b7fac3f54098d9aaa401bf3f0a1c6ca9f49205060c987d3b51d9ce2e8';
    }
    if ((isBitcoinChain(fromAsset.chainId) && !isBitcoinChain(toAsset.chainId)) || (isBitcoinChain(toAsset.chainId) && !isBitcoinChain(fromAsset.chainId))) {
        bitcoin_optional_recipient = btcAddress;
    }
    const nonce = Date.now().toString();
    const { secretHash } = await generateSecret(nonce);

    if (!initiator_source_address || !initiator_destination_address) {
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
  | 'completed';

// Centralized function to parse order action/state
export const parseAction = (order: any): OrderStatus => {
  // Check if swap is completed
  if (order.destination_swap?.redeem_tx_hash) {
    return 'completed';
  }
  
  // Check if redeeming is in progress
  if (order.source_swap?.initiate_tx_hash && order.destination_swap?.initiate_tx_hash) {
    return 'redeeming';
  }
  
  // Check if deposit is confirmed (has block number)
  if (order.source_swap?.initiate_block_number) {
    return 'deposit_confirmed';
  }
  
  // Check if deposit is detected (has tx hash but no block number)
  if (order.source_swap?.initiate_tx_hash) {
    return 'deposit_detected';
  }
  
  // Default: awaiting deposit
  return 'created';
};


// Fetch user orders with polling
export const fetchUserOrders = async (
  userAddress: string,
  pollInterval: number = 5000,
  maxPolls: number = 12
): Promise<(Order & {status: OrderStatus})[]> => {
  const orders: (Order & {status: OrderStatus})[] = [];
  let pollCount = 0;

  const poll = async (): Promise<(Order & {status: OrderStatus})[]> => {
    try {
      const response = await axios.get(`${API_URLS.ORDERBOOK}/orders/user/${userAddress}`);
      
      if (response.status === 200 && response.data) {
        const apiOrders = Array.isArray(response.data) ? response.data : [response.data];
        
        return apiOrders.map((order: any) => {
          const status = parseAction(order);
          return {
            ...order, 
            status
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return [];
    }
  };

  // Initial fetch
  const initialOrders = await poll();
  orders.push(...initialOrders);

  // Polling logic
  const pollOrders = async (): Promise<void> => {
    if (pollCount >= maxPolls) return;

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollCount++;

    const newOrders = await poll();
    
    // Update existing orders and add new ones
    newOrders.forEach(newOrder => {
      const existingIndex = orders.findIndex(order => order.create_order.create_id === newOrder.create_order.create_id);
      if (existingIndex >= 0) {
        orders[existingIndex] = newOrder;
      } else {
        orders.push(newOrder);
      }
    });
  };

  // Start polling
  const pollPromise = pollOrders();
  
  return orders;
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
    }
  };

  return statusConfig[status];
};
