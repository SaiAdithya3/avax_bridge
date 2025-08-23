import { EventHandlerService } from './services/eventHandler';
import { WatcherManager } from './services/watcherManager';
import { DatabaseService } from './services/database';
import { chainConfig, WATCHER_CONFIG, addContractToChain } from '../config';
import { logger } from './utils/logger';

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
      logger.info('Starting EVM Watcher...');
      
      // Initialize database if enabled
      if (this.useDatabase && this.databaseService) {
        try {
          await this.databaseService.connect();
          await this.databaseService.createIndexes();
          logger.info('Database connected and indexes created');
        } catch (error) {
          logger.warn('Failed to connect to database, continuing without database operations:', error);
          this.useDatabase = false;
        }
      }
      
      // Start watcher manager
      await this.watcherManager.start();
      
      logger.info('EVM Watcher started successfully');
      
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
        
        // Log status every 5 minutes
        const status = this.watcherManager.getStatus();
        logger.info('Watcher status:', status);
        
        // Check database health if enabled
        if (this.useDatabase && this.databaseService) {
          const dbConnected = this.databaseService.isDatabaseConnected();
          if (!dbConnected) {
            logger.warn('Database connection lost');
          }
        }
        
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Public methods for external control
  async stop(): Promise<void> {
    await this.watcherManager.stop();
    
    // Disconnect database if connected
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
      
      logger.info(`Successfully added contract ${contractConfig.name} to chain ${chainId}`);
    } catch (error) {
      logger.error(`Failed to add contract to chain ${chainId}:`, error);
      throw error;
    }
  }

  // Method to add a new chain
  async addChain(chainConfig: any): Promise<void> {
    try {
      await this.watcherManager.addChain(chainConfig);
      logger.info(`Successfully added chain: ${chainConfig.id}`);
    } catch (error) {
      logger.error(`Failed to add chain ${chainConfig.id}:`, error);
      throw error;
    }
  }

  // Method to enable database operations after initialization
  async enableDatabase(): Promise<void> {
    if (this.databaseService) {
      try {
        await this.databaseService.connect();
        await this.databaseService.createIndexes();
        this.useDatabase = true;
        logger.info('Database operations enabled');
      } catch (error) {
        logger.error('Failed to enable database operations:', error);
        throw error;
      }
    } else {
      this.databaseService = new DatabaseService();
      await this.enableDatabase();
    }
  }

  // Method to disable database operations
  disableDatabase(): void {
    this.useDatabase = false;
    logger.info('Database operations disabled');
  }

  // Getter for database service
  getDatabaseService(): DatabaseService | null {
    return this.databaseService;
  }

  // Check if database is enabled
  isDatabaseEnabled(): boolean {
    return this.useDatabase;
  }
}

// Main execution
async function main() {
  // Create watcher without database initially
  const watcher = new EVMWatcher(false);
  
  try {
    await watcher.start();
    
    // Keep the process running
    process.on('beforeExit', async () => {
      await watcher.stop();
    });
    
    // Example: Enable database later if needed
    // setTimeout(async () => {
    //   try {
    //     await watcher.enableDatabase();
    //     logger.info('Database operations now enabled');
    //   } catch (error) {
    //     logger.error('Failed to enable database:', error);
    //   }
    // }, 10000); // Enable after 10 seconds
    
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
