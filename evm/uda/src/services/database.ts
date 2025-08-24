import { MongoClient, Db, Collection } from 'mongodb';
import { CONFIG } from '../config';
import { Order, EvmChain } from '../types';
import { Result, err, ok } from 'neverthrow';

export class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private ordersCollection: Collection | null = null;

  async connect(): Promise<Result<void, string>> {
    try {
      this.client = new MongoClient(CONFIG.database.uri, CONFIG.database.options);
      await this.client.connect();
      
      this.db = this.client.db(CONFIG.database.name);
      this.ordersCollection = this.db.collection('orders');
      
      return ok(undefined);
    } catch (error) {
      return err(`Failed to connect to MongoDB: ${error}`);
    }
  }

  async disconnect(): Promise<Result<void, string>> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.ordersCollection = null;
      }
      return ok(undefined);
    } catch (error) {
      return err(`Failed to disconnect from MongoDB: ${error}`);
    }
  }

  async getAllOrders(): Promise<Result<Order[], string>> {
    try {
      if (!this.ordersCollection) {
        return err('Database not connected');
      }

      // Fetch only uninitiated orders (where source_swap.initiate_tx_hash is null or empty)
      const allOrders = await this.ordersCollection.find({
        $or: [
          { 'source_swap.initiate_tx_hash': { $exists: false } },
          { 'source_swap.initiate_tx_hash': null },
          { 'source_swap.initiate_tx_hash': '' }
        ]
      }).toArray();

      return ok(allOrders as unknown as Order[]);
    } catch (error) {
      return err(`Failed to fetch all orders: ${error}`);
    }
  }

  async getOrdersByChain(chain: EvmChain): Promise<Result<Order[], string>> {
    try {
      if (!this.ordersCollection) {
        return err('Database not connected');
      }

      // Fetch orders for specific EVM chain
      const chainOrders = await this.ordersCollection.find({
        $or: [
          { 'source_swap.chain': chain },
          { 'destination_swap.chain': chain }
        ]
      }).toArray();

      // Filter out bitcoin orders
      const evmOrders = chainOrders.filter(order => {
        const sourceChain = order.source_swap?.chain;
        const destChain = order.destination_swap?.chain;
        
        return sourceChain !== 'bitcoin_testnet' && destChain !== 'bitcoin_testnet';
      });

      return ok(evmOrders as unknown as Order[]);
    } catch (error) {
      return err(`Failed to fetch orders for chain ${chain}: ${error}`);
    }
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Result<void, string>> {
    try {
      if (!this.ordersCollection) {
        return err('Database not connected');
      }

      await this.ordersCollection.updateOne(
        { 'create_order.create_id': orderId },
        { $set: updates }
      );

      return ok(undefined);
    } catch (error) {
      return err(`Failed to update order: ${error}`);
    }
  }

  async getOrderById(orderId: string): Promise<Result<Order | null, string>> {
    try {
      if (!this.ordersCollection) {
        return err('Database not connected');
      }

      const order = await this.ordersCollection.findOne({ 'create_order.create_id': orderId });
      
      // Check if order is for EVM chains only
      if (order) {
        const sourceChain = order.source_swap?.chain;
        const destChain = order.destination_swap?.chain;
        
        if (sourceChain === 'bitcoin_testnet' || destChain === 'bitcoin_testnet') {
          return ok(null); // Skip bitcoin orders
        }
      }
      
      return ok(order as Order | null);
    } catch (error) {
      return err(`Failed to get order by ID: ${error}`);
    }
  }
}
