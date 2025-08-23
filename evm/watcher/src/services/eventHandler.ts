import { logger } from '../utils/logger';
import { HTLCService } from './htlcService';
import { DatabaseService } from './database';

export class EventHandlerService {
  private databaseService: DatabaseService | null = null;
  private htlcService: HTLCService | null = null;

  constructor(databaseService?: DatabaseService) {
    this.databaseService = databaseService || null;
    
    if (this.databaseService) {
      this.htlcService = new HTLCService(this.databaseService);
      logger.info('HTLC Service initialized with database integration');
    } else {
      logger.info('HTLC Service not initialized - no database connection');
    }
  }

  /**
   * Handle incoming events
   */
  async handleEvent(event: any): Promise<void> {
    try {
      // Log event data for debugging
      this.logEventData(event);
      
      // Route to appropriate handler based on event name
      switch (event.eventName) {
        case 'Initiated':
          await this.handleInitiatedEvent(event);
          break;
        case 'Redeemed':
          await this.handleRedeemedEvent(event);
          break;
        case 'Refunded':
          await this.handleRefundedEvent(event);
          break;
      }
    } catch (error) {
      logger.error('Error handling event:', error);
    }
  }

  /**
   * Log event data for debugging purposes
   */
  private logEventData(event: any): void {
    logger.debug(`Processing event: ${event.eventName} from contract ${event.contractAddress} on chain ${event.chainId}`);
    
    try {
      // Custom JSON serializer to handle BigInt values
      const jsonReplacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      };
      
      logger.debug(`Event typed data: ${JSON.stringify(event.eventDataTyped, jsonReplacer, 2)}`);
      logger.debug(`Parsed args: ${JSON.stringify(event.parsedArgs, jsonReplacer, 2)}`);
    } catch (error) {
      logger.debug(`Could not serialize event data: ${error}`);
      logger.debug(`Event name: ${event.eventName}, Contract: ${event.contractAddress}`);
    }
  }

  /**
   * Handle Initiated events (Atomic Swap)
   */
  private async handleInitiatedEvent(event: any): Promise<void> {
    const initiatedData = event.eventDataTyped?.Initiated;
    if (!initiatedData) {
      logger.error('Initiated event data is missing or malformed:', event);
      return;
    }

    logger.info(`Initiated event: Block ${event.blockNumber}, OrderID ${initiatedData.orderID}, Amount: ${initiatedData.amount}`);
    
    if (this.htlcService) {
      try {
        await this.htlcService.updateSwapInitiated(
          initiatedData.orderID,
          event.transactionHash,
          event.blockNumber
        );
      } catch (error) {
        logger.error(`Failed to update HTLC for initiated swap ${initiatedData.orderID}:`, error);
      }
    }
  }

  /**
   * Handle Redeemed events (Atomic Swap)
   */
  private async handleRedeemedEvent(event: any): Promise<void> {
    const redeemedData = event.eventDataTyped?.Redeemed;
    if (!redeemedData) {
      logger.error('Redeemed event data is missing or malformed:', event);
      return;
    }

    logger.info(`Redeemed event: Block ${event.blockNumber}, OrderID ${redeemedData.orderID}`);
    
    if (this.htlcService) {
      try {
        await this.htlcService.updateSwapRedeemed(
          redeemedData.orderID,
          event.transactionHash,
          event.blockNumber
        );
      } catch (error) {
        logger.error(`Failed to update HTLC for redeemed swap ${redeemedData.orderID}:`, error);
      }
    }
  }

  /**
   * Handle Refunded events (Atomic Swap)
   */
  private async handleRefundedEvent(event: any): Promise<void> {
    const refundedData = event.eventDataTyped?.Refunded;
    if (!refundedData) {
      logger.error('Refunded event data is missing or malformed:', event);
      return;
    }

    logger.info(`Refunded event: Block ${event.blockNumber}, OrderID ${refundedData.orderID}`);
    
    if (this.htlcService) {
      try {
        await this.htlcService.updateSwapRefunded(
          refundedData.orderID,
          event.transactionHash,
          event.blockNumber
        );
      } catch (error) {
        logger.error(`Failed to update HTLC for refunded swap ${refundedData.orderID}:`, error);
      }
    }
  }
}
