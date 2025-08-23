import { API_URLS } from '../constants/constants';
import type { CreateOrderRequest, CreateOrderResponse } from '../types/api';
import { useAssetsStore } from '../store/assetsStore';
import { useEVMWallet } from '../hooks/useEVMWallet';
import { useBitcoinWallet } from '@gardenfi/wallet-connectors';
import { Err, Ok, trim0x, with0x } from '@gardenfi/utils';
import { sha256 } from 'viem';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { DigestKey } from '../utils/digestKey';


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


export const buildCreateOrderRequest = async (
): Promise<CreateOrderRequest> => {
    const {fromAsset, toAsset, sendAmount, receiveAmount} = useAssetsStore();
    const {address: evmAddress} = useEVMWallet();
    const {account: btcAddress} = useBitcoinWallet();
    if (!fromAsset || !toAsset || !sendAmount || !receiveAmount) {
        throw new Error('Invalid swap data');
    }
    let initiator_source_address: string | undefined = undefined;
    let initiator_destination_address: string | undefined = undefined;
    let bitcoin_optional_recipient: string | undefined = undefined;

    // Set initiator_source_address based on fromChain
    if (isEVMChain(fromAsset.chainName)) {
        initiator_source_address = evmAddress;
    } else if (isBitcoinChain(fromAsset.chainName)) {
        initiator_source_address = btcAddress;
    }

    // Set initiator_destination_address based on toChain
    if (isEVMChain(toAsset.chainName)) {
        initiator_destination_address = evmAddress;
    } else if (isBitcoinChain(toAsset.chainName)) {
        initiator_destination_address = btcAddress;
    }

    // Set bitcoin_optional_recipient if swap is from Bitcoin to something else
    if (isBitcoinChain(fromAsset.chainName) && !isBitcoinChain(toAsset.chainName)) {
        bitcoin_optional_recipient = btcAddress;
    }
    const nonce = Date.now().toString();
    const { secretHash} = await generateSecret(nonce);

    return {
        source_chain: fromAsset.chainName,
        destination_chain: toAsset.chainName,
        source_asset: fromAsset.asset.symbol.toLowerCase(),
        destination_asset: toAsset.asset.symbol.toLowerCase(),
        source_amount: sendAmount,
        destination_amount: receiveAmount,
        nonce: nonce,
        initiator_source_address,
        initiator_destination_address,
        secret_hash: secretHash,
        bitcoin_optional_recipient,
    };
};


export const createOrder = async (
): Promise<CreateOrderResponse> => {
  const orderData = buildCreateOrderRequest();

  try {
    const response = await fetch(`${API_URLS.ORDERBOOK}/api/orders`, {
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
