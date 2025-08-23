import { MongoClient, Db, Collection } from 'mongodb';
import { DB_CONFIG } from '../../config';
import { Order } from '../types';
import { Result, err, ok } from 'neverthrow';
import { isOrderForSupportedChains } from '../utils/networkUtils';

export class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private ordersCollection: Collection | null = null;

  async connect(): Promise<Result<void, string>> {
    try {
      this.client = new MongoClient(DB_CONFIG.uri, DB_CONFIG.options);
      await this.client.connect();
      
      this.db = this.client.db(DB_CONFIG.name);
      this.ordersCollection = this.db.collection('orders');
      
      console.log('Connected to MongoDB');
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
        console.log('Disconnected from MongoDB');
      }
      return ok(undefined);
    } catch (error) {
      return err(`Failed to disconnect from MongoDB: ${error}`);
    }
  }

  async fetchPendingOrders(): Promise<Result<Order[], string>> {
    try {
      if (!this.ordersCollection) {
        return err('Database not connected');
      }

      // Fetch orders where either source_swap or destination_swap needs action
      const pendingOrders = await this.ordersCollection.find({
        $or: [
          // Source swap initiated but destination swap not initiated
          {
            'source_swap.initiate_tx_hash': { $ne: null},
            'destination_swap.initiate_tx_hash': { $in: [null] }
          },
          // Both swaps initiated but destination swap not redeemed
          {
            'source_swap.initiate_tx_hash': { $ne: null},
            'destination_swap.initiate_tx_hash': { $ne: null },
            'destination_swap.redeem_tx_hash': { $in: [null] }
          }
        ]
      }).toArray();

      // Filter orders for supported chains only
      const supportedOrders = pendingOrders.filter(isOrderForSupportedChains);

      return ok(supportedOrders as unknown as Order[]);
    } catch (error) {
      return err(`Failed to fetch pending orders: ${error}`);
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
      
      // Check if order is for supported chains
      if (order && !isOrderForSupportedChains(order)) {
        return ok(null);
      }
      
      return ok(order as Order | null);
    } catch (error) {
      return err(`Failed to get order by ID: ${error}`);
    }
  }
}
