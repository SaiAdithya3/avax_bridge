import React, { useEffect, useState, useCallback } from "react";
import { useEVMWallet } from "../hooks/useEVMWallet";
import { useOrdersStore } from "../store/ordersStore";
import {
  fetchUserOrders,
  filterPendingOrders,
  generateSecret,
  parseAction,
} from "../services/orderService";
import { useBitcoinWallet } from "@gardenfi/wallet-connectors";
import { isEVMChain } from "../services/orderService";
import { evmRedeem } from "../services/contractService";
import { isBitcoinChain } from "../services/orderService";
import { type WalletClient } from "viem";
import type { Order } from "../types/api";
import type { IBitcoinWallet } from "../services/bitcoin/wallet/wallet.interface";
import { GardenHTLC } from "../services/bitcoin/htlc";
import { toXOnly } from "../services/utils";
import { trim0x } from "@gardenfi/utils";
import { BitcoinProvider } from "../services/bitcoin/provider/provider";
import { BitcoinNetwork } from "../services/bitcoin/provider/provider.interface";
import { BitcoinWallet } from "../services/bitcoin/wallet/wallet";

export const PendingOrdersManager: React.FC = () => {
  const { address: evmAddress, walletClient: evmWalletClient } = useEVMWallet();
  const { account, provider } = useBitcoinWallet();

  const {
    userOrders,
    pendingOrders,
    isLoadingUserOrders,
    userOrdersError,
    setUserOrders,
    setPendingOrders,
    setLoadingUserOrders,
    setUserOrdersError,
  } = useOrdersStore();

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<{
    success: boolean;
    message: string;
    processedCount: number;
    results: Array<{
      orderId: string;
      success: boolean;
      message: string;
      txHash?: string;
    }>;
  } | null>(null);

  const executeOrderRedemption = async (
    order: Order,
    walletClient: WalletClient
  ): Promise<{ success: boolean; message: string; txHash?: string } | undefined> => {
    try {
      const { destination_swap } = order;
      console.log("Processing order redemption for chain:", destination_swap.chain);

      // Check if destination swap is EVM-based
      if (isEVMChain(destination_swap.chain)) {
        console.log("Processing EVM redemption for order:", order.create_order.create_id);
        
        const redeemResult = await evmRedeem(order);

        if (redeemResult.ok) {
          console.log("EVM redemption successful:", redeemResult.val);
          return {
            success: true,
            message: "EVM redeem successful",
            txHash: redeemResult.val,
          };
        } else {
          console.log("EVM redemption failed:", redeemResult.error);
          return {
            success: false,
            message: `EVM redeem failed: ${redeemResult.error}`,
          };
        }
      } else if (isBitcoinChain(destination_swap.chain)) {
        console.log("Processing Bitcoin redemption for order:", order.create_order.create_id);
        
        const bitcoinProvider = new BitcoinProvider(
            BitcoinNetwork.Testnet,
            'https://mempool.space/testnet4/api'
          );
          const btcWallet = BitcoinWallet.fromPrivateKey(
            'af530c3d2212740a8428193fce82bfddcf7e83bee29a2b9b2f25b5331bae1bf5',
            bitcoinProvider,
            { pkType: 'p2wpkh', pkPath: "m/84'/0'/0'/0/0" },
          );
          const { secret } = await generateSecret(order.create_order.nonce);
        const redeemResult = await bitcoinRedeem(btcWallet, order, secret);
        if (redeemResult) {
          console.log("Bitcoin redemption successful:", redeemResult);
          return {
            success: true,
            message: "Bitcoin redeem successful",
            txHash: redeemResult,
          };
        } else {
          return {
            success: false,
            message: "Bitcoin redeem failed: No transaction hash returned",
          };
        }
      } else {
        console.log("Unsupported chain:", destination_swap.chain);
        return {
          success: false,
          message: `Unsupported destination chain: ${destination_swap.chain}`,
        };
      }
    } catch (error) {
      console.error("Error in executeOrderRedemption:", error);
      return {
        success: false,
        message: `Error processing order: ${String(error)}`,
      };
    }
  };

  const executePendingOrdersRedemption = async (
    orders: Order[],
    walletClient: WalletClient
  ): Promise<{
    success: boolean;
    message: string;
    processedCount: number;
    results: Array<{
      orderId: string;
      success: boolean;
      message: string;
      txHash?: string;
    }>;
  }> => {
    const results: Array<{
      orderId: string;
      success: boolean;
      message: string;
      txHash?: string;
    }> = [];
    let processedCount = 0;

    console.log("Starting redemption for", orders.length, "orders");

    for (const order of orders) {
      try {
        console.log("Processing order:", order.create_order.create_id);
        const result = await executeOrderRedemption(order, walletClient);
        
        const resultEntry = {
          orderId: order.create_order.create_id,
          success: result?.success ?? false,
          message: result?.message ?? "",
          txHash: result?.txHash,
        };
        
        results.push(resultEntry);
        console.log("Order result:", resultEntry);

        if (result?.success) {
          processedCount++;
        }
      } catch (error) {
        console.error("Error processing order:", order.create_order.create_id, error);
        results.push({
          orderId: order.create_order.create_id,
          success: false,
          message: String(error),
        });
      }
    }

    const message =
      processedCount > 0
        ? `Successfully processed ${processedCount} orders`
        : "No orders processed successfully";

    console.log("Redemption completed. Processed:", processedCount, "out of", orders.length);

    return {
      success: processedCount > 0,
      message,
      processedCount,
      results,
    };
  };

  // Fetch user orders
  const fetchOrders = useCallback(async () => {
    if (!evmAddress && !account) {
      setUserOrdersError("No wallet connected");
      return;
    }

    try {
      setLoadingUserOrders(true);
      setUserOrdersError(null);

      // Use EVM address if available, otherwise use BTC address
      const userAddress = evmAddress || account!;
      const orders = await fetchUserOrders(userAddress);

      setUserOrders(
        orders.map((order) => ({
          ...order,
          status: parseAction(order),
        }))
      );

      // Filter pending orders
      const pending = filterPendingOrders(orders);
      setPendingOrders(pending);
    } catch (error) {
      setUserOrdersError(String(error));
      console.error("Error fetching orders:", error);
    } finally {
      setLoadingUserOrders(false);
    }
  }, [
    evmAddress,
    account,
    setUserOrders,
    setPendingOrders,
    setLoadingUserOrders,
    setUserOrdersError,
  ]);

  // Execute pending orders redemption
  const executeRedemption = useCallback(async () => {
    if (!evmWalletClient) {
      setLastExecutionResult({
        success: false,
        message: "EVM wallet not connected",
        processedCount: 0,
        results: [],
      });
      return;
    }

    if (pendingOrders.length === 0) {
      setLastExecutionResult({
        success: true,
        message: "No pending orders to execute",
        processedCount: 0,
        results: [],
      });
      return;
    }

    try {
      setIsExecuting(true);
      console.log("Executing redemption for", pendingOrders.length, "orders");
      
      const result = await executePendingOrdersRedemption(
        pendingOrders,
        evmWalletClient
      );
      
      console.log("Redemption result:", result);
      setLastExecutionResult(result);

      // Refresh orders after execution
      if (result.processedCount > 0) {
        await fetchOrders();
      }
    } catch (error) {
      console.error("Redemption error:", error);
      setLastExecutionResult({
        success: false,
        message: String(error),
        processedCount: 0,
        results: [],
      });
    } finally {
      setIsExecuting(false);
    }
  }, [pendingOrders, evmWalletClient, fetchOrders]);

  // Auto-refresh orders every 30 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Execute redemption separately to avoid blocking the polling
  useEffect(() => {
    if (pendingOrders.length > 0 && evmWalletClient && !isExecuting) {
      executeRedemption();
    }
  }, [pendingOrders, evmWalletClient, isExecuting, executeRedemption]);


  const bitcoinRedeem = async (
    wallet: IBitcoinWallet,
    order: Order,
    secret: string
  ) => {
    // Get the UTXO (initiate tx) from the order
    if (!order.destination_swap.initiate_tx_hash) {
      throw new Error('Failed to get initiate_tx_hash');
    }
    const fillerInitTx = order.destination_swap.initiate_tx_hash
      .split(',')
      .at(-1)
      ?.split(':')
      .at(0);

    if (!fillerInitTx) {
      throw new Error('Failed to get initiate_tx_hash');
    }
    console.log("fillerInitTx", fillerInitTx);
    console.log(order.destination_swap.secret_hash)
    // Construct the GardenHTLC executor
    const bitcoinExecutor = await GardenHTLC.from(
      wallet,
      Number(order.destination_swap.amount),
      order.destination_swap.secret_hash,
      toXOnly(order.destination_swap.initiator),
      toXOnly(order.destination_swap.redeemer),
      order.destination_swap.timelock,
      [fillerInitTx]
    );
    console.log("secret", secret)
    // Get the redeem transaction hex
    const redeemHex = await bitcoinExecutor.getRedeemHex(
      trim0x(secret),
      order.create_order?.bitcoin_optional_recipient || undefined
    );

    // Broadcast the redeem transaction
    const provider = await wallet.getProvider();
    const txHash = await provider.broadcast(redeemHex);

    return txHash;
  };
  return <></>;
};
