import { MongoClient, Db } from 'mongodb';
import { DB_CONFIG } from '../../config';
import { WatchedEvent, WatcherStatus } from '../types';
import { logger } from '../utils/logger';

export class DatabaseService {
  private client: MongoClient;
  private db!: Db;
  private isConnected: boolean = false;

  constructor() {
    this.client = new MongoClient(DB_CONFIG.uri, DB_CONFIG.options);
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_CONFIG.name);
      this.isConnected = true;
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Failed to disconnect from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Check if connected to database
   */
  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Save event to database
   */
  async saveEvent(event: WatchedEvent): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Database not connected, skipping event save');
      return;
    }

    try {
      const collection = this.db.collection('events');
      await collection.insertOne(event);
      logger.debug(`Event saved to database: ${event.id}`);
    } catch (error) {
      logger.error('Failed to save event to database:', error);
      throw error;
    }
  }

  /**
   * Update watcher status in database
   */
  async updateWatcherStatus(status: WatcherStatus): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Database not connected, skipping status update');
      return;
    }

    try {
      const collection = this.db.collection('watcher_status');
      await collection.updateOne(
        { chainId: status.chainId },
        { $set: status },
        { upsert: true }
      );
      logger.debug(`Watcher status updated in database for chain: ${status.chainId}`);
    } catch (error) {
      logger.error('Failed to update watcher status in database:', error);
      throw error;
    }
  }

  /**
   * Get watcher status from database
   */
  async getWatcherStatus(chainId: string): Promise<WatcherStatus | null> {
    if (!this.isConnected) {
      logger.warn('Database not connected, cannot get status');
      return null;
    }

    try {
      const collection = this.db.collection('watcher_status');
      const status = await collection.findOne({ chainId });
      return status as unknown as WatcherStatus;
    } catch (error) {
      logger.error('Failed to get watcher status from database:', error);
      return null;
    }
  }

  /**
   * Get events from database with filters
   */
  async getEvents(filters: any = {}, limit: number = 100): Promise<WatchedEvent[]> {
    if (!this.isConnected) {
      logger.warn('Database not connected, cannot get events');
      return [];
    }

    try {
      const collection = this.db.collection('events');
      const events = await collection.find(filters).limit(limit).toArray();
      return events as unknown as WatchedEvent[];
    } catch (error) {
      logger.error('Failed to get events from database:', error);
      return [];
    }
  }

  /**
   * Get event statistics from database
   */
  async getEventStats(): Promise<{ total: number; byType: Record<string, number>; byContract: Record<string, number> }> {
    if (!this.isConnected) {
      logger.warn('Database not connected, cannot get statistics');
      return { total: 0, byType: {}, byContract: {} };
    }

    try {
      const collection = this.db.collection('events');
      
      const total = await collection.countDocuments();
      
      const byType = await collection.aggregate([
        { $group: { _id: '$eventName', count: { $sum: 1 } } }
      ]).toArray();
      
      const byContract = await collection.aggregate([
        { $group: { _id: '$contractAddress', count: { $sum: 1 } } }
      ]).toArray();
      
      const byTypeMap: Record<string, number> = {};
      const byContractMap: Record<string, number> = {};
      
      byType.forEach(item => {
        byTypeMap[item._id] = item.count;
      });
      
      byContract.forEach(item => {
        byContractMap[item._id] = item.count;
      });
      
      return { total, byType: byTypeMap, byContract: byContractMap };
    } catch (error) {
      logger.error('Failed to get event statistics from database:', error);
      return { total: 0, byType: {}, byContract: {} };
    }
  }

  /**
   * Create database indexes for better performance
   */
  async createIndexes(): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Database not connected, cannot create indexes');
      return;
    }

    try {
      const eventsCollection = this.db.collection('events');
      const statusCollection = this.db.collection('watcher_status');
      
      // Create indexes for events collection
      await eventsCollection.createIndex({ chainId: 1, blockNumber: 1 });
      await eventsCollection.createIndex({ contractAddress: 1 });
      await eventsCollection.createIndex({ eventName: 1 });
      await eventsCollection.createIndex({ timestamp: 1 });
      await eventsCollection.createIndex({ transactionHash: 1 });
      
      // Create indexes for watcher status collection
      await statusCollection.createIndex({ chainId: 1 }, { unique: true });
      
      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Failed to create database indexes:', error);
      throw error;
    }
  }
}



