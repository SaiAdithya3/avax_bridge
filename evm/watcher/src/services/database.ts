import { MongoClient, Db, Collection } from 'mongodb';
import { WatchedEvent, WatcherStatus } from '../types';
import { logger } from '../utils/logger';
import { DB_CONFIG } from '../../config';

export class DatabaseService {
  private client!: MongoClient;
  private db!: Db;
  private eventsCollection!: Collection<WatchedEvent>;
  private statusCollection!: Collection<WatcherStatus>;

  constructor() {}

  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(DB_CONFIG.uri, DB_CONFIG.options);
      await this.client.connect();
      this.db = this.client.db(DB_CONFIG.name);
      
      this.eventsCollection = this.db.collection<WatchedEvent>('events');
      this.statusCollection = this.db.collection<WatcherStatus>('watcher_status');

      // Create indexes for better performance
      await this.eventsCollection.createIndex({ chainId: 1, blockNumber: 1 });
      await this.eventsCollection.createIndex({ contractAddress: 1, blockNumber: 1 });
      await this.eventsCollection.createIndex({ eventName: 1 });
      await this.eventsCollection.createIndex({ processed: 1 });
      
      await this.statusCollection.createIndex({ chainId: 1 });

      logger.info(`Connected to MongoDB database: ${DB_CONFIG.name}`);
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      logger.info('Disconnected from MongoDB');
    }
  }

  // Event operations
  async saveEvent(event: WatchedEvent): Promise<void> {
    try {
      await this.eventsCollection.insertOne(event);
      logger.debug(`Saved event: ${event.eventName} from block ${event.blockNumber}`);
    } catch (error) {
      logger.error('Failed to save event:', error);
      throw error;
    }
  }

  async saveEvents(events: WatchedEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    try {
      await this.eventsCollection.insertMany(events);
      logger.debug(`Saved ${events.length} events`);
    } catch (error) {
      logger.error('Failed to save events:', error);
      throw error;
    }
  }

  async getUnprocessedEvents(chainId: string, limit: number = 100): Promise<WatchedEvent[]> {
    try {
      return await this.eventsCollection
        .find({ chainId, processed: false })
        .sort({ blockNumber: 1, logIndex: 1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Failed to get unprocessed events:', error);
      throw error;
    }
  }

  async markEventProcessed(eventId: string): Promise<void> {
    try {
      await this.eventsCollection.updateOne(
        { id: eventId },
        { $set: { processed: true, updatedAt: new Date() } }
      );
    } catch (error) {
      logger.error('Failed to mark event as processed:', error);
      throw error;
    }
  }



  // Status operations
  async updateWatcherStatus(status: WatcherStatus): Promise<void> {
    try {
      await this.statusCollection.updateOne(
        { chainId: status.chainId },
        { $set: status },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Failed to update watcher status:', error);
      throw error;
    }
  }

  async getWatcherStatus(chainId: string): Promise<WatcherStatus | null> {
    try {
      return await this.statusCollection.findOne({ chainId });
    } catch (error) {
      logger.error('Failed to get watcher status:', error);
      throw error;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}
