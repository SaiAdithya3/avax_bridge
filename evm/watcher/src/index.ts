import { EventHandlerService } from './services/eventHandler';
import { WatcherManager } from './services/watcherManager';
import { chainConfig, WATCHER_CONFIG, addContractToChain } from '../config';
import { logger } from './utils/logger';

export class EVMWatcher {
  private watcherManager: WatcherManager;
  private eventHandler: EventHandlerService;

  constructor() {
    this.eventHandler = new EventHandlerService();
    this.watcherManager = new WatcherManager(
      chainConfig,
      this.eventHandler,
      WATCHER_CONFIG
    );

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

// Run if this is the main module
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
