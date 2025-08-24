import { DatabaseService } from './database';
import { BalanceService } from './balanceService';
import { Order, Swap, UDABalanceCheck, EvmChain } from '../types';
import { CONFIG } from '../config';
import { Result, err, ok } from 'neverthrow';
import { ethers } from 'ethers';
import { REGISTRY_ABI } from './abi';

export class UDAWatcher {
  private databaseService: DatabaseService;
  private balanceService: BalanceService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.databaseService = new DatabaseService();
    this.balanceService = new BalanceService();
  }

  async start(): Promise<Result<void, string>> {
    try {
      // Connect to database
      const connectResult = await this.databaseService.connect();
      if (connectResult.isErr()) {
        return err(`Failed to connect to database: ${connectResult.error}`);
      }

      // Check provider health
      const healthCheck = await this.checkProviderHealth();
      if (healthCheck.isErr()) {
        return err(`Provider health check failed: ${healthCheck.error}`);
      }

      this.isRunning = true;
      
      // Start the main loop
      this.startMainLoop();
      
      return ok(undefined);
    } catch (error) {
      return err(`Failed to start UDA Watcher: ${error}`);
    }
  }

  async stop(): Promise<Result<void, string>> {
    try {
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Disconnect from database
      await this.databaseService.disconnect();
      
      return ok(undefined);
    } catch (error) {
      return err(`Failed to stop UDA Watcher: ${error}`);
    }
  }

  private startMainLoop(): void {
    // Run immediately once
    this.processOrders();
    
    // Then set up interval
    this.intervalId = setInterval(() => {
      if (this.isRunning) {
        this.processOrders();
      }
    }, CONFIG.uda.pollInterval);
  }

  private async processOrders(): Promise<void> {
    try {
      // Get all orders from database
      const ordersResult = await this.databaseService.getAllOrders();
      if (ordersResult.isErr()) {
        console.error('Failed to fetch orders:', ordersResult.error);
        return;
      }

      const orders = ordersResult.value;
      console.log(`Found ${orders.length} orders`);

      if (orders.length === 0) {
        return;
      }

      // Extract only source swaps from orders
      const sourceSwaps: {orderId: string, swap: Swap}[] = [];
      orders.forEach(order => {
        if (order.source_swap) {
          sourceSwaps.push({orderId: order.create_order.create_id, swap: order.source_swap});
        }
      });

      // Filter out bitcoin swaps (shouldn't happen but safety check)
      const evmSourceSwaps = sourceSwaps.filter(swap => swap.swap.chain !== 'bitcoin_testnet');

      // Check balances for source swaps only
      const balanceChecksResult = await this.balanceService.checkMultipleSwaps(evmSourceSwaps);
      if (balanceChecksResult.isErr()) {
        console.error('Failed to check balances:', balanceChecksResult.error);
        return;
      }

      const balanceChecks = balanceChecksResult.value;
      
      // Process balance check results
      await this.processBalanceChecks(balanceChecks);

    } catch (error) {
      console.error('Error in processOrders:', error);
    }
  }

  private async processBalanceChecks(balanceChecks: UDABalanceCheck[]): Promise<void> {
    try {
      for (const balanceCheck of balanceChecks) {
        // Simple log format
        console.log(`order_id: ${balanceCheck.orderId}, deposit_address: ${balanceCheck.depositAddress}, amount: ${balanceCheck.requiredAmount}, balance: ${balanceCheck.currentBalance}`);

        // Handle amount match (sufficient balance)
        if (balanceCheck.hasEnoughBalance) {
          await this.handleAmountMatch(balanceCheck);
        }
      }

    } catch (error) {
      console.error('Error processing balance checks:', error);
    }
  }

  private async checkProviderHealth(): Promise<Result<void, string>> {
    try {
      const chains: EvmChain[] = ['avalanche_testnet', 'arbitrum_sepolia'];
      
      for (const chain of chains) {
        const isHealthy = await this.balanceService.isProviderHealthy(chain);
        if (!isHealthy) {
          return err(`Provider for chain ${chain} is not healthy`);
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(`Provider health check failed: ${error}`);
    }
  }

  // Public method to manually trigger order processing
  async triggerOrderProcessing(): Promise<Result<void, string>> {
    try {
      await this.processOrders();
      return ok(undefined);
    } catch (error) {
      return err(`Failed to trigger order processing: ${error}`);
    }
  }

  // Public method to manually trigger amount match handler for testing
  async triggerAmountMatchHandler(balanceCheck: UDABalanceCheck): Promise<Result<void, string>> {
    try {
      await this.handleAmountMatch(balanceCheck);
      return ok(undefined);
    } catch (error) {
      return err(`Failed to trigger amount match handler: ${error}`);
    }
  }

  // Get current status
  getStatus(): { isRunning: boolean; lastCheck: Date | null } {
    return {
      isRunning: this.isRunning,
      lastCheck: this.isRunning ? new Date() : null
    };
  }

  /**
   * Handler for when an order has sufficient balance (amount match)
   * This is a placeholder for future implementation
   */
  private async handleAmountMatch(balanceCheck: UDABalanceCheck): Promise<void> {
    try {
      await this.initiateAtomicSwap(balanceCheck);
    } catch (error) {
      console.error(`Error in amount match handler for order ${balanceCheck.orderId}:`, error);
    }
  }

  /**
   * Initiate atomic swap when amount matches
   */
  private async initiateAtomicSwap(balanceCheck: UDABalanceCheck): Promise<void> {
    try {
      const { chainConfig } = balanceCheck;
      
      console.log(`🚀 Initiating atomic swap for ${balanceCheck.orderId}`);

      // Validate private key
      if (!chainConfig.private_key || chainConfig.private_key === '') {
        throw new Error(`Private key not set for chain ${balanceCheck.chain}`);
      }
      
      if (!chainConfig.private_key.startsWith('0x')) {
        throw new Error(`Private key must start with 0x for chain ${balanceCheck.chain}`);
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpc_url);
      const wallet = new ethers.Wallet(chainConfig.private_key, provider);
      const contract = new ethers.Contract(chainConfig.htlc_registry_address, REGISTRY_ABI, wallet);

      //   function createERC20SwapAddress(
      //     address token,
      //     address refundAddress,
      //     address redeemer,
      //     uint256 timelock,
      //     uint256 amount,
      //     bytes32 secretHash
      // )
      
      // Format the secret hash properly for ethers.js (ensure it's 0x prefixed and 32 bytes)
      let secretHash = balanceCheck.swap.secret_hash;
      if (!secretHash.startsWith('0x')) {
        secretHash = '0x' + secretHash;
      }
      
      // Ensure the secret hash is exactly 32 bytes (64 hex characters + 0x prefix)
      if (secretHash.length !== 66) { // 0x + 64 hex chars
        console.warn(`Warning: Secret hash length is ${secretHash.length - 2} bytes, expected 32 bytes`);
      }
      
      console.log(`   Formatted Secret Hash: ${secretHash}`);
      console.log(`   Secret Hash Length: ${(secretHash.length - 2) / 2} bytes`);
                    
      const tx = await contract.createERC20SwapAddress(
        balanceCheck.tokenAddress,        // token address
        balanceCheck.swap.initiator,      // refund address
        balanceCheck.swap.redeemer,      // redeemer address
        balanceCheck.swap.timelock,       // timelock from database
        balanceCheck.swap.amount,         // amount
        secretHash                         // properly formatted secret hash
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Failed to initiate atomic swap for ${balanceCheck.orderId}:`, error);
    }
  }
}
