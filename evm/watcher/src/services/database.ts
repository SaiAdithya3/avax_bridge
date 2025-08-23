import { MongoClient, Db } from 'mongodb';
import { DB_CONFIG } from '../../config';
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
   * Get a collection by name
   */
  getCollection(collectionName: string) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.collection(collectionName);
  }
}



