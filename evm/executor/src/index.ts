import { ExecutorService } from './services/executor';

async function main() {
  const executor = new ExecutorService();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await executor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await executor.stop();
    process.exit(0);
  });

  try {
    console.log('Starting EVM Executor...');
    console.log('Supported chains: avalanche_testnet, arbitrum_sepolia');
    
    const result = await executor.start();
    
    if (result.isErr()) {
      console.error(`Failed to start executor: ${result.error}`);
      process.exit(1);
    }

    console.log('EVM Executor started successfully');
    
    // Keep the process running
    setInterval(async () => {
      const status = await executor.getStatus();
      console.log(`Status: Running=${status.isRunning}, Wallet=${status.walletAddress}, PollInterval=${status.pollInterval}ms, SupportedChains=[${status.supportedChains.join(', ')}]`);
    }, 30000); // Log status every 30 seconds

  } catch (error) {
    console.error(`Unexpected error: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Failed to start application: ${error}`);
  process.exit(1);
});
