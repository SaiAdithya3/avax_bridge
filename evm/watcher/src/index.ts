import { DatabaseService } from './services/database';
import { EventHandlerService } from './services/eventHandler';
import { WatcherManager } from './services/watcherManager';
import { CHAIN_CONFIGS, WATCHER_CONFIG, addContractToChain } from '../config';
import { logger } from './utils/logger';

class EVMWatcher {
  private database: DatabaseService;
  private eventHandler: EventHandlerService;
  private watcherManager: WatcherManager;
  private isShuttingDown: boolean = false;

  constructor() {
    // Initialize services using centralized config
    this.database = new DatabaseService();
    this.eventHandler = new EventHandlerService();
    this.watcherManager = new WatcherManager(CHAIN_CONFIGS, this.database, this.eventHandler, WATCHER_CONFIG);

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.watcherManager.stop();
        await this.database.disconnect();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting EVM Watcher...');
      
      // Connect to database
      await this.database.connect();
      
      // Check database health
      const isHealthy = await this.database.isHealthy();
      if (!isHealthy) {
        throw new Error('Database health check failed');
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
        
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Public methods for external control
  async stop(): Promise<void> {
    await this.watcherManager.stop();
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
}

// Main execution
async function main() {
  const watcher = new EVMWatcher();
  
  try {
    await watcher.start();
    
    // Keep the process running
    process.on('beforeExit', async () => {
      await watcher.stop();
    });
    
  } catch (error) {
    logger.error('Failed to start watcher:', error);
    process.exit(1);
  }
}

// Export for use as module
export { EVMWatcher };

// Run if this is the main module
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
