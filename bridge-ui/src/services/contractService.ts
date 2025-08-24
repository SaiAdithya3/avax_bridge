import {
  checkAllowanceAndApprove,
  Ok,
  Err,
  Fetcher,
  trim0x,
  type AsyncResult,
} from "@gardenfi/utils";
import { erc20Abi, getContract, type WalletClient } from "viem";
import { type APIResponse, with0x } from "@gardenfi/utils";

import axios from "axios";
import { API_URLS } from "../constants/constants";
import { generateSecret, isEVMChain } from "./orderService";
import { useEVMWallet } from "../hooks/useEVMWallet";
import { switchOrAddNetwork } from "../utils/networkUtils";
import { type EvmChain, type Order } from "../types/api";
import { AtomicSwapABI } from "./atomicSwapABI";

export const initiate = async (order: Order): AsyncResult<string, string> => {
  const { address: evmAddress, walletClient } = useEVMWallet();
  if (!evmAddress) return Err("No account found");
  if (evmAddress.toLowerCase() !== order.source_swap.initiator.toLowerCase())
    return Err("Account address and order initiator mismatch");
  if (!isEVMChain(order.source_swap.chain))
    return Err("Source chain is not an EVM chain");

  const _walletClient = await switchOrAddNetwork(
    order.source_swap.chain as EvmChain,
    walletClient as WalletClient
  );
  if (!_walletClient.ok) return Err(_walletClient.error);
  const wallet = _walletClient.val.walletClient;
  if (!wallet.account) return Err("No account found");

  const { create_order, source_swap } = order;

  if (
    !source_swap.amount ||
    !source_swap.redeemer ||
    !source_swap.timelock ||
    !create_order.secret_hash
  )
    return Err("Invalid order");

  const secretHash = with0x(create_order.secret_hash);
  const timelock = BigInt(source_swap.timelock);
  const redeemer = with0x(source_swap.redeemer);
  const amount = BigInt(source_swap.amount);

  const tokenAddress = await getTokenAddress(
    order.source_swap.asset,
    walletClient as WalletClient
  );
  if (!tokenAddress.ok) return Err(tokenAddress.error);

  return _initiateOnErc20HTLC(
    secretHash,
    timelock,
    amount,
    redeemer,
    order.source_swap.asset,
    tokenAddress.val,
    source_swap.swap_id,
    wallet
  );
};

const getTokenAddress = async (
  asset: string,
  walletClient: WalletClient
): AsyncResult<string, string> => {
  try {
    const atomicSwap = getContract({
      address: with0x(asset),
      abi: AtomicSwapABI,
      client: walletClient,
    });

    const token = await atomicSwap.read.token();
    return Ok(token);
  } catch (error) {
    return Err("Failed to get token address", String(error));
  }
};

const _initiateOnErc20HTLC = async (
  secretHash: `0x${string}`,
  timelock: bigint,
  amount: bigint,
  redeemer: `0x${string}`,
  asset: string,
  tokenAddress: string,
  orderId: string,
  walletClient: WalletClient
): AsyncResult<string, string> => {
  if (!walletClient.account) return Err("No account found");

  try {
    const atomicSwap = getContract({
      address: with0x(asset),
      abi: AtomicSwapABI,
      client: walletClient,
    });

    const approval = await checkAllowanceAndApprove(
      Number(amount),
      tokenAddress,
      asset,
      walletClient
    );
    if (!approval.ok) return Err(approval.error);

    const domain = await atomicSwap.read.eip712Domain();

    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: {
        name: domain[1],
        version: domain[2],
        chainId: Number(domain[3]),
        verifyingContract: domain[4],
      },
      types: {
        Initiate: [
          { name: "redeemer", type: "address" },
          { name: "timelock", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "secretHash", type: "bytes32" },
        ],
      },
      primaryType: "Initiate",
      message: {
        redeemer,
        timelock,
        amount,
        secretHash,
      },
    });

    const res = await Fetcher.post<APIResponse<string>>(
      API_URLS.ORDERBOOK + "/initiate",
      {
        body: JSON.stringify({
          order_id: orderId,
          signature,
          perform_on: "Source",
        }),
      }
    );
    if (res.error) return Err(res.error);
    return Ok(res.result ? res.result : "Initiate hash not found");
  } catch (error) {
    console.log("init error :", error);
    return Err(String(error));
  }
};

export const redeem = async (order: Order): AsyncResult<string, string> => {
  const { secret } = await generateSecret(order.create_order.nonce);
  try {
    const res = await axios.post(API_URLS.ORDERBOOK + "/redeem", {
      order_id: order.create_order.create_id,
      secret: trim0x(secret),
      perform_on: "Destination",
    });
    if (res.status === 200) {
      return Ok(res.data ? res.data : "Redeem hash not found");
    } else {
      return Err("Redeem failed: Transaction receipt not successful");
    }
  } catch (error) {
    return Err(String(error));
  }
};

export const initiateViaUDA = async (walletClient: WalletClient, order: Order): AsyncResult<`0x${string}`, string> => {
  if (!walletClient) return Err("No wallet client found");
  if (!walletClient.account) return Err("No account found");
  
  const _walletClient = await switchOrAddNetwork(
    order.source_swap.chain as EvmChain,
    walletClient as WalletClient
  );
  if (!_walletClient.ok) return Err(_walletClient.error);
  const wallet = _walletClient.val.walletClient;
  
  if (!wallet.account) return Err("No account found");
  if (!wallet.chain) return Err("No chain found");

  if (wallet.chain.id !== getChainId(order.source_swap.chain)) {
    return Err(`Chain mismatch. Expected ${order.source_swap.chain}, got ${wallet.chain.name}`);
  }

  const tx = await wallet.writeContract({
    address: with0x(order.source_swap.token_address),
    abi: erc20Abi ,
    functionName: "transfer",
    args: [order.source_swap.deposit_address as `0x${string}`, BigInt(order.source_swap.amount)],
    account: wallet.account,
    chain: wallet.chain
  })
  if (!tx) return Err("Failed to send transaction");

  return Ok(tx);
};

const getChainId = (chain: string): number => {
  switch (chain.toLowerCase()) {
    case 'avalanche_testnet':
      return 43113;
    case 'arbitrum_sepolia':
      return 421614;
    case 'ethereum':
      return 1;
    default:
      console.error('Unsupported chain:', chain);
      throw new Error(`Unsupported chain: ${chain}`);
  }
};