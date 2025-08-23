import { EventHandlerService } from './services/eventHandler';
import { WatcherManager } from './services/watcherManager';
import { DatabaseService } from './services/database';
import { chainConfig, WATCHER_CONFIG, addContractToChain } from '../config';
import { logger } from './utils/logger';
import { HTLCService } from './services/htlcService';

export class EVMWatcher {
  private watcherManager: WatcherManager;
  private eventHandler: EventHandlerService;
  private databaseService: DatabaseService | null = null;
  private useDatabase: boolean = false;

  constructor(enableDatabase: boolean = false) {
    this.eventHandler = new EventHandlerService();
    this.watcherManager = new WatcherManager(
      chainConfig,
      this.eventHandler,
      WATCHER_CONFIG
    );
    
    this.useDatabase = enableDatabase;
    if (this.useDatabase) {
      this.databaseService = new DatabaseService();
      logger.info('Database service initialized (will be used when connected)');
    }

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
    
    // Also handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {      
      // Initialize database if enabled
      if (this.useDatabase && this.databaseService) {
        try {
          logger.info('🔌 Attempting to connect to database...');
          await this.databaseService.connect();
                    
          // Create new event handler with database service
          this.eventHandler = new EventHandlerService(this.databaseService);
          
          // Update the watcher manager with the new event handler
          await this.watcherManager.updateEventHandler(this.eventHandler);
          
          logger.info('✅ Database connected successfully - HTLC updates will work');
        } catch (error) {
          logger.error('❌ Failed to connect to database:', error);
          logger.warn('⚠️  Continuing without database operations - HTLC updates will be skipped');
          this.useDatabase = false;
          // Recreate event handler without database
          this.eventHandler = new EventHandlerService();
          // Update the watcher manager with the new event handler
          await this.watcherManager.updateEventHandler(this.eventHandler);
        }
      } else {
        logger.info('ℹ️  Database operations disabled - HTLC updates will be skipped');
      }
      
      // Start watcher manager
      await this.watcherManager.start();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      logger.error('Failed to start EVM Watcher:', error);
      throw error;
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        const health = await this.watcherManager.getHealth();
        if (!health.healthy) {
          logger.warn('Health check failed:', health.details);
        }
        
        // Check database connection status
        if (this.useDatabase && this.databaseService) {
          const dbConnected = this.databaseService.isDatabaseConnected();
          if (!dbConnected) {
            logger.warn('⚠️  Database connection lost - attempting to reconnect...');
            try {
              await this.databaseService.connect();
              logger.info('✅ Database reconnected successfully');
            } catch (error) {
              logger.error('❌ Failed to reconnect to database:', error);
            }
          } else {
            logger.debug('✅ Database connection healthy');
          }
        }
        
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async stop(): Promise<void> {
    await this.watcherManager.stop();
    
    if (this.databaseService && this.databaseService.isDatabaseConnected()) {
      await this.databaseService.disconnect();
    }
  }

  async restart(): Promise<void> {
    await this.watcherManager.restart();
  }

  getStatus() {
    return this.watcherManager.getStatus();
  }

  async getHealth() {
    return await this.watcherManager.getHealth();
  }

  // Method to add a contract to watch
  async addContract(chainId: string, contractConfig: any): Promise<void> {
    try {
      // Add to chain config
      addContractToChain(chainId, contractConfig);
      
      // Add to watcher manager
      await this.watcherManager.addContractToChain(chainId, contractConfig);
      } catch (error) {
      logger.error(`Failed to add contract to chain ${chainId}:`, error);
      throw error;
    }
  }

  // Method to add a new chain
  async addChain(chainConfig: any): Promise<void> {
    try {
      await this.watcherManager.addChain(chainConfig);
    } catch (error) {
      logger.error(`Failed to add chain ${chainConfig.id}:`, error);
      throw error;
    }
  }

  // Method to enable database operations after initialization
  async enableDatabase(): Promise<void> {
    try {
      if (!this.databaseService) {
        this.databaseService = new DatabaseService();
        logger.info('Database service created');
      }
      
      await this.databaseService.connect();
      this.useDatabase = true;
      
      // Update the event handler with the new database service
      this.eventHandler = new EventHandlerService(this.databaseService);
      logger.info('Event handler updated with database service');
      
    } catch (error) {
      logger.error('Failed to enable database operations:', error);
      this.useDatabase = false;
      throw error;
    }
  }

  // Method to disable database operations
  disableDatabase(): void {
    this.useDatabase = false;
  }

  // Getter for database service
  getDatabaseService(): DatabaseService | null {
    return this.databaseService;
  }

  // Check if database is enabled
  isDatabaseEnabled(): boolean {
    return this.useDatabase;
  }

  // Get current database status
  getDatabaseStatus(): { enabled: boolean; connected: boolean; serviceExists: boolean } {
    return {
      enabled: this.useDatabase,
      connected: this.databaseService?.isDatabaseConnected() || false,
      serviceExists: !!this.databaseService
    };
  }
}

// Main execution
async function main() {
  // Create watcher with database enabled from the start
  const watcher = new EVMWatcher(true);
  
  try {    
    await watcher.start();    
        
    // Keep the process alive
    const keepAlive = setInterval(() => {
      // This keeps the event loop running
    }, 1000);
    
    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      clearInterval(keepAlive);
      await watcher.stop();
      process.exit(0);
    };
    
    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
    
    // Also handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Failed to start watcher:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
