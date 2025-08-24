import { Environment } from '@gardenfi/utils';
import * as varuint from 'varuint-bitcoin';
import * as secp256k1 from 'tiny-secp256k1';
import { BitcoinNetwork } from './bitcoin/provider/provider.interface';
import { web3 } from '@coral-xyz/anchor';

export function xOnlyPubkey(pubkey: Buffer | string): Buffer {
  if (typeof pubkey === 'string') pubkey = Buffer.from(pubkey, 'hex');
  return pubkey.length === 32 ? pubkey : pubkey.subarray(1, 33);
}

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * concat the leaf version, the length of the script, and the script itself
 */
export function serializeScript(leafScript: Buffer) {
  return Buffer.concat([
    Uint8Array.from([0xc0]),
    prefixScriptLength(leafScript),
  ]);
}

/**
 * concat the length of the script and the script itself
 */
export function prefixScriptLength(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = Buffer.allocUnsafe(varintLen);
  varuint.encode(s.length, buffer);
  return Buffer.concat([buffer, s]);
}

export function sortLeaves(leaf1: Buffer, leaf2: Buffer) {
  if (leaf1.compare(leaf2) > 0) {
    const temp = leaf1;
    leaf1 = leaf2;
    leaf2 = temp;
  }
  return [leaf1, leaf2];
}

export const toXOnly = (pubKey: string) =>
  pubKey.length === 64 ? pubKey : pubKey.slice(2);

export const isValidBitcoinPubKey = (pubKey: string): boolean => {
  if (!pubKey) return false;

  try {
    const pubKeyBuffer = Buffer.from(pubKey, 'hex');
    return secp256k1.isPoint(pubKeyBuffer);
  } catch {
    return false;
  }
};



export const getBitcoinNetwork = (network: Environment): BitcoinNetwork => {
  switch (network) {
    case Environment.MAINNET:
      return BitcoinNetwork.Mainnet;
    case Environment.TESTNET:
      return BitcoinNetwork.Testnet;
    case Environment.LOCALNET:
      return BitcoinNetwork.Regtest;
    default:
      throw new Error(`Invalid bitcoin network ${network}`);
  }
};

export const isHexString = (value: string): boolean => {
  const hex = value.toLowerCase().replace('0x', '');
  return /^[0-9a-f]+$/.test(hex);
};


export function reversify(val: string): Buffer {
  return Buffer.from(val, 'hex').reverse();
}

export function isErrorWithMessage(err: unknown): err is { message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as any).message === 'string'
  );
}
export const waitForSolanaTxConfirmation = async (
  connection: web3.Connection,
  txHash: string,
): Promise<boolean> => {
  const startTime = Date.now();
  const MAX_DURATION = 30_000;
  const RETRY_INTERVAL = 2_000;

  while (Date.now() - startTime < MAX_DURATION) {
    const latestBlockhash = await connection.getLatestBlockhash();

    const confirmation = await connection.confirmTransaction(
      {
        signature: txHash,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed',
    );

    if (confirmation.value && confirmation.value.err == null) {
      console.log('Tx Confirmed ✅');
      return true;
    }

    console.log('Tx not confirmed yet. Retrying in 2 seconds...');
    await new Promise((res) => setTimeout(res, RETRY_INTERVAL));
  }

  return false;
};
