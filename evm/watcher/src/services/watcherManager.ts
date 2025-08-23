import { BlockWatcher } from './blockWatcher';
import { DatabaseService } from './database';
import { EventHandlerService } from './eventHandler';
import { ChainConfig, WatcherOptions } from '../types';
import { logger } from '../utils/logger';

export class WatcherManager {
  private watchers: Map<string, BlockWatcher> = new Map();
  private database: DatabaseService;
  private eventHandler: EventHandlerService;
  private isRunning: boolean = false;
  private options: WatcherOptions;

  constructor(
    private chainConfigs: ChainConfig[],
    database: DatabaseService,
    eventHandler: EventHandlerService,
    options: WatcherOptions = {}
  ) {
    this.database = database;
    this.eventHandler = eventHandler;
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Watcher manager is already running');
      return;
    }

    try {
      logger.info('Starting watcher manager...');
      
      // Initialize watchers for each chain
      for (const chainConfig of this.chainConfigs) {
        if (chainConfig.contracts.length === 0) {
          logger.warn(`No contracts configured for chain ${chainConfig.id}, skipping`);
          continue;
        }

        const watcher = new BlockWatcher(
          chainConfig,
          this.database,
          this.eventHandler,
          this.options
        );

        this.watchers.set(chainConfig.id, watcher);
        logger.info(`Initialized watcher for chain: ${chainConfig.id}`);
      }

      // Start all watchers
      const startPromises = Array.from(this.watchers.values()).map(watcher => 
        watcher.start().catch(error => {
          logger.error('Failed to start watcher:', error);
          return null;
        })
      );

      await Promise.allSettled(startPromises);
      
      this.isRunning = true;
      logger.info(`Started ${this.watchers.size} watchers`);
      
    } catch (error) {
      logger.error('Failed to start watcher manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Watcher manager is not running');
      return;
    }

    try {
      logger.info('Stopping watcher manager...');
      
      // Stop all watchers
      const stopPromises = Array.from(this.watchers.values()).map(watcher => 
        watcher.stop().catch(error => {
          logger.error('Failed to stop watcher:', error);
          return null;
        })
      );

      await Promise.allSettled(stopPromises);
      
      this.watchers.clear();
      this.isRunning = false;
      
      logger.info('Stopped all watchers');
      
    } catch (error) {
      logger.error('Failed to stop watcher manager:', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    logger.info('Restarting watcher manager...');
    await this.stop();
    await this.start();
  }

  async addChain(chainConfig: ChainConfig): Promise<void> {
    try {
      logger.info(`Adding new chain: ${chainConfig.id}`);
      
      // Stop existing watcher if it exists
      const existingWatcher = this.watchers.get(chainConfig.id);
      if (existingWatcher) {
        await existingWatcher.stop();
        this.watchers.delete(chainConfig.id);
      }

      // Create and start new watcher
      if (chainConfig.contracts.length > 0) {
        const watcher = new BlockWatcher(
          chainConfig,
          this.database,
          this.eventHandler,
          this.options
        );

        this.watchers.set(chainConfig.id, watcher);
        
        if (this.isRunning) {
          await watcher.start();
        }
        
        logger.info(`Successfully added chain: ${chainConfig.id}`);
      } else {
        logger.warn(`No contracts configured for chain ${chainConfig.id}`);
      }
      
    } catch (error) {
      logger.error(`Failed to add chain ${chainConfig.id}:`, error);
      throw error;
    }
  }

  async removeChain(chainId: string): Promise<void> {
    try {
      logger.info(`Removing chain: ${chainId}`);
      
      const watcher = this.watchers.get(chainId);
      if (watcher) {
        await watcher.stop();
        this.watchers.delete(chainId);
        logger.info(`Successfully removed chain: ${chainId}`);
      } else {
        logger.warn(`Chain ${chainId} not found`);
      }
      
    } catch (error) {
      logger.error(`Failed to remove chain ${chainId}:`, error);
      throw error;
    }
  }

  async addContractToChain(chainId: string, contractConfig: any): Promise<void> {
    try {
      logger.info(`Adding contract ${contractConfig.name} to chain ${chainId}`);
      
      const watcher = this.watchers.get(chainId);
      if (watcher) {
        // Stop the current watcher
        await watcher.stop();
        
        // Find the chain config and add the contract
        const chainConfig = this.chainConfigs.find(c => c.id === chainId);
        if (chainConfig) {
          chainConfig.contracts.push(contractConfig);
          
          // Create new watcher with updated config
          const newWatcher = new BlockWatcher(
            chainConfig,
            this.database,
            this.eventHandler,
            this.options
          );
          
          this.watchers.set(chainId, newWatcher);
          
          // Start if manager is running
          if (this.isRunning) {
            await newWatcher.start();
          }
          
          logger.info(`Successfully added contract ${contractConfig.name} to chain ${chainId}`);
        }
      } else {
        logger.warn(`Chain ${chainId} not found, cannot add contract`);
      }
      
    } catch (error) {
      logger.error(`Failed to add contract to chain ${chainId}:`, error);
      throw error;
    }
  }

  getStatus(): { isRunning: boolean; watchers: any[] } {
    const watcherStatuses = Array.from(this.watchers.entries()).map(([chainId, watcher]) => ({
      chainId,
      ...watcher.getStatus()
    }));

    return {
      isRunning: this.isRunning,
      watchers: watcherStatuses
    };
  }

  async getHealth(): Promise<{ healthy: boolean; details: any[] }> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.watchers.entries()).map(async ([chainId, watcher]) => {
        const healthy = await watcher.getHealth();
        return { chainId, healthy };
      })
    );

    const details = healthChecks.map((result, index) => {
      const chainId = Array.from(this.watchers.keys())[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { chainId, healthy: false, error: result.reason };
      }
    });

    const healthy = details.every(detail => detail.healthy);
    
    return { healthy, details };
  }

  getWatcher(chainId: string): BlockWatcher | undefined {
    return this.watchers.get(chainId);
  }

  getActiveChains(): string[] {
    return Array.from(this.watchers.keys());
  }

  isChainWatched(chainId: string): boolean {
    return this.watchers.has(chainId);
  }
}
