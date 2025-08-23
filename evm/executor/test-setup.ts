import { WalletService } from './src/services/wallet';
import { DatabaseService } from './src/services/database';
import { Logger } from './src/utils/logger';
import { isOrderForSupportedChains } from './src/utils/networkUtils';

async function testSetup() {
  Logger.info('Testing EVM Executor setup...');

  try {
    // Test wallet service
    Logger.info('Testing wallet service...');
    const walletService = new WalletService();
    const address = walletService.getAddress();
    Logger.info(`Wallet address: ${address}`);

    // Test chain switching
    Logger.info('Testing chain switching...');
    const avalancheResult = await walletService.switchToChain('avalanche_testnet');
    if (avalancheResult.isOk()) {
      Logger.info('Successfully switched to Avalanche testnet');
    } else {
      Logger.error(`Failed to switch to Avalanche testnet: ${avalancheResult.error}`);
    }

    const arbitrumResult = await walletService.switchToChain('arbitrum_sepolia');
    if (arbitrumResult.isOk()) {
      Logger.info('Successfully switched to Arbitrum Sepolia');
    } else {
      Logger.error(`Failed to switch to Arbitrum Sepolia: ${arbitrumResult.error}`);
    }

    // Test database connection
    Logger.info('Testing database connection...');
    const dbService = new DatabaseService();
    const dbResult = await dbService.connect();
    
    if (dbResult.isOk()) {
      Logger.info('Database connection successful');
      
      // Test fetching orders
      const ordersResult = await dbService.fetchPendingOrders();
      if (ordersResult.isOk()) {
        const orders = ordersResult.value;
        Logger.info(`Found ${orders.length} total pending orders`);
        
        // Test chain filtering
        const supportedOrders = orders.filter(isOrderForSupportedChains);
        Logger.info(`Found ${supportedOrders.length} orders for supported chains`);
        
        if (supportedOrders.length > 0) {
          const sampleOrder = supportedOrders[0];
          Logger.info(`Sample order - Source: ${sampleOrder.source_swap.chain}, Destination: ${sampleOrder.destination_swap.chain}`);
        }
      } else {
        Logger.error(`Failed to fetch orders: ${ordersResult.error}`);
      }

      await dbService.disconnect();
    } else {
      Logger.error(`Database connection failed: ${dbResult.error}`);
    }

    Logger.info('Setup test completed');
  } catch (error) {
    Logger.error(`Setup test failed: ${error}`);
  }
}

testSetup().catch(console.error);
