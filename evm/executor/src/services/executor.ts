import { DatabaseService } from './database';
import { OrderProcessor } from './orderProcessor';
import { ContractService } from './contractService';
import { WalletService } from './wallet';
import { EXECUTOR_CONFIG } from '../../config';
import { OrderWithAction } from '../types';
import { Result, err, ok } from 'neverthrow';

export class ExecutorService {
  private databaseService: DatabaseService;
  private contractService: ContractService;
  private walletService: WalletService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.databaseService = new DatabaseService();
    this.walletService = new WalletService();
    this.contractService = new ContractService(this.walletService);
  }

  async start(): Promise<Result<void, string>> {
    try {
      // Connect to database
       const dbResult = await this.databaseService.connect();
       if (dbResult.isErr()) {
         return err(`Failed to connect to database: ${dbResult.error}`);
      }

      console.log('Starting EVM Executor...');
      console.log(`Wallet address: ${this.walletService.getAddress()}`);
      console.log('Supported chains: avalanche_testnet, arbitrum_sepolia');
      
      this.isRunning = true;
      this.startPolling();
      
      return ok(undefined);
    } catch (error) {
      return err(`Failed to start executor: ${error}`);
    }
  }

  async stop(): Promise<Result<void, string>> {
    try {
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      const dbResult = await this.databaseService.disconnect();
      if (dbResult.isErr()) {
        return err(`Failed to disconnect from database: ${dbResult.error}`);
      }

      console.log('EVM Executor stopped');
      return ok(undefined);
    } catch (error) {
      return err(`Failed to stop executor: ${error}`);
    }
  }

  private startPolling(): void {
    this.intervalId = setInterval(async () => {
      if (!this.isRunning) return;
      
      await this.processOrders();
    }, EXECUTOR_CONFIG.pollInterval);
  }

  private async processOrders(): Promise<void> {
    try {
      // Fetch pending orders from database
      const ordersResult = await this.databaseService.fetchPendingOrders();
      if (ordersResult.isErr()) {
        console.error(`Failed to fetch orders: ${ordersResult.error}`);
        return;
      }

      const orders = ordersResult.value;
      if (orders.length === 0) {
        console.log('No pending orders found');
        return;
      }

      console.log(`Found ${orders.length} pending orders`);

      // Filter for supported chains
      const supportedOrders = OrderProcessor.getSupportedChainOrders(orders);
      if (supportedOrders.length === 0) {
        console.log('No orders for supported chains (avalanche_testnet or arbitrum_sepolia)');
        return;
      }

      console.log(`Found ${supportedOrders.length} orders for supported chains`);

      // Analyze orders and get actionable ones
      const actionableOrders = OrderProcessor.getActionableOrders(supportedOrders);
      
      if (actionableOrders.length === 0) {
        console.log('No actionable orders found');
        return;
      }

      console.log(`Processing ${actionableOrders.length} actionable orders`);

      // Process each actionable order
      for (const orderWithAction of actionableOrders) {
        await this.processOrder(orderWithAction);
      }
    } catch (error) {
      console.error(`Error processing orders: ${error}`);
    }
  }

  private async processOrder(orderWithAction: OrderWithAction): Promise<void> {
    const { order, action, reason } = orderWithAction;
    const orderId = order.create_order.create_id;

    console.log(`Processing order ${orderId}: ${action} - ${reason}`);
    console.log(`Source chain: ${order.source_swap.chain}, Destination chain: ${order.destination_swap.chain}`);

    try {
      switch (action) {
        case 'counterPartyInitiated':
          await this.handleCounterPartyInitiated(order);
          break;
        
        case 'counterPartyRedeemed':
          await this.handleCounterPartyRedeemed(order);
          break;
        
        default:
          console.log(`No action needed for order ${orderId}: ${action}`);
      }
    } catch (error) {
      console.error(`Error processing order ${orderId}: ${error}`);
    }
  }

  private async handleCounterPartyInitiated(order: any): Promise<void> {
    const orderId = order.create_order.create_id;
    
    try {
      console.log(`Initiating destination swap for order ${orderId} on chain ${order.destination_swap.chain}`);
      
      const result = await this.contractService.initiate(order);
      
      if (result.isOk()) {
        const txHash = result.value;
        console.log(`Destination swap initiated for order ${orderId}: ${txHash}`);
        
        // Update database with transaction hash
        await this.databaseService.updateOrder(orderId, {
          destination_swap: {
            ...order.destination_swap,
            initiate_tx_hash: txHash,
            initiate_block_number: null // Will be updated by watcher
          }
        });
      } else {
        console.error(`Failed to initiate destination swap for order ${orderId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error handling counter party initiated for order ${orderId}: ${error}`);
    }
  }

  private async handleCounterPartyRedeemed(order: any): Promise<void> {
    const orderId = order.create_order.create_id;
    
    try {
      console.log(`Redeeming destination swap for order ${orderId} on chain ${order.source_swap.chain}`);
      
      const result = await this.contractService.redeem(order);
      
      if (result.isOk()) {
        const txHash = result.value;
        console.log(`Destination swap redeemed for order ${orderId}: ${txHash}`);
        
        // Update database with transaction hash
        await this.databaseService.updateOrder(orderId, {
          destination_swap: {
            ...order.destination_swap,
            redeem_tx_hash: txHash,
            redeem_block_number: null // Will be updated by watcher
          }
        });
      } else {
        console.error(`Failed to redeem destination swap for order ${orderId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error handling counter party redeemed for order ${orderId}: ${error}`);
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    walletAddress: string;
    pollInterval: number;
    supportedChains: string[];
  }> {
    return {
      isRunning: this.isRunning,
      walletAddress: this.walletService.getAddress(),
      pollInterval: EXECUTOR_CONFIG.pollInterval,
      supportedChains: ['avalanche_testnet', 'arbitrum_sepolia']
    };
  }
}
