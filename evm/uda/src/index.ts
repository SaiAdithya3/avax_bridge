import { UDAWatcher } from './services/udaWatcher';
import { CONFIG } from './config';

async function main() {
  const watcher = new UDAWatcher();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down...`);
    
    try {
      await watcher.stop();
      console.log('UDA Watcher stopped');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Listen for shutdown signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  try {
    // Start the watcher
    const startResult = await watcher.start();
    if (startResult.isErr()) {
      console.error('Failed to start UDA Watcher:', startResult.error);
      process.exit(1);
    }

    console.log('UDA Watcher started');
    // Keep the process alive
    setInterval(() => {
      watcher.getStatus();
    }, 60000); // Status update every minute

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});
