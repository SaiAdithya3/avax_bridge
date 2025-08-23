import { WatchedEvent, EventHandler } from '../types';
import { logger } from '../utils/logger';

export class EventHandlerService {
  private handlers: Map<string, EventHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    // Register placeholder handlers for common event types
    this.registerHandler('Transfer', this.handleTransferEvent.bind(this));
    this.registerHandler('Approval', this.handleApprovalEvent.bind(this));
    this.registerHandler('Mint', this.handleMintEvent.bind(this));
    this.registerHandler('Burn', this.handleBurnEvent.bind(this));
    this.registerHandler('Swap', this.handleSwapEvent.bind(this));
    this.registerHandler('LiquidityAdded', this.handleLiquidityAddedEvent.bind(this));
    this.registerHandler('LiquidityRemoved', this.handleLiquidityRemovedEvent.bind(this));
    this.registerHandler('Deposit', this.handleDepositEvent.bind(this));
    this.registerHandler('Withdrawal', this.handleWithdrawalEvent.bind(this));
    this.registerHandler('Claim', this.handleClaimEvent.bind(this));
    
    // Atomic Swap specific event handlers
    this.registerHandler('Initiated', this.handleInitiatedEvent.bind(this));
    this.registerHandler('Redeemed', this.handleRedeemedEvent.bind(this));
    this.registerHandler('Refunded', this.handleRefundedEvent.bind(this));
    
    // Generic handler for unknown events
    this.registerHandler('*', this.handleGenericEvent.bind(this));
  }

  registerHandler(eventName: string, handler: (event: WatchedEvent) => Promise<void>): void {
    this.handlers.set(eventName, { eventName, handler });
  }

  async handleEvent(event: WatchedEvent): Promise<void> {
    try {
      const handler = this.handlers.get(event.eventName);
      
      if (handler) {
        logger.info(`Processing event: ${event.eventName} from contract ${event.contractAddress} (${event.contractType}) at block ${event.blockNumber}`);
        await handler.handler(event);
        logger.info(`Successfully processed event: ${event.eventName}`);
      } else {
        // Use generic handler for unknown events
        const genericHandler = this.handlers.get('*');
        if (genericHandler) {
          await genericHandler.handler(event);
        } else {
          logger.warn(`No handler found for event: ${event.eventName}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling event ${event.eventName}:`, error);
      throw error;
    }
  }

  // Placeholder handlers - you can implement your custom logic here
  private async handleTransferEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[TRANSFER] From: ${event.parsedArgs?.from}, To: ${event.parsedArgs?.to}, Value: ${event.parsedArgs?.value}`);
    // TODO: Implement your transfer event logic
    // Example: Update balances, notify users, etc.
  }

  private async handleApprovalEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[APPROVAL] Owner: ${event.parsedArgs?.owner}, Spender: ${event.parsedArgs?.spender}, Value: ${event.parsedArgs?.value}`);
    // TODO: Implement your approval event logic
  }

  private async handleMintEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[MINT] To: ${event.parsedArgs?.to}, Value: ${event.parsedArgs?.value}`);
    // TODO: Implement your mint event logic
  }

  private async handleBurnEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[BURN] From: ${event.parsedArgs?.from}, Value: ${event.parsedArgs?.value}`);
    // TODO: Implement your burn event logic
  }

  private async handleSwapEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[SWAP] Sender: ${event.parsedArgs?.sender}, Amount0In: ${event.parsedArgs?.amount0In}, Amount1In: ${event.parsedArgs?.amount1In}`);
    // TODO: Implement your swap event logic
  }

  private async handleLiquidityAddedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[LIQUIDITY_ADDED] Provider: ${event.parsedArgs?.provider}, Amount0: ${event.parsedArgs?.amount0}, Amount1: ${event.parsedArgs?.amount1}`);
    // TODO: Implement your liquidity added event logic
  }

  private async handleLiquidityRemovedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[LIQUIDITY_REMOVED] Provider: ${event.parsedArgs?.provider}, Amount0: ${event.parsedArgs?.amount0}, Amount1: ${event.parsedArgs?.amount1}`);
    // TODO: Implement your liquidity removed event logic
  }

  private async handleDepositEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[DEPOSIT] User: ${event.parsedArgs?.user}, Amount: ${event.parsedArgs?.amount}`);
    // TODO: Implement your deposit event logic
  }

  private async handleWithdrawalEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[WITHDRAWAL] User: ${event.parsedArgs?.user}, Amount: ${event.parsedArgs?.amount}`);
    // TODO: Implement your withdrawal event logic
  }

  private async handleClaimEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[CLAIM] User: ${event.parsedArgs?.user}, Amount: ${event.parsedArgs?.amount}`);
    // TODO: Implement your claim event logic
  }

  // Atomic Swap specific event handlers
  private async handleInitiatedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[INITIATED] OrderID: ${event.parsedArgs?.orderID}, SecretHash: ${event.parsedArgs?.secretHash}, Amount: ${event.parsedArgs?.amount}`);
    // TODO: Implement your atomic swap initiated event logic
    // Example: Create new swap order, notify participants, etc.
  }

  private async handleRedeemedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[REDEEMED] OrderID: ${event.parsedArgs?.orderID}, SecretHash: ${event.parsedArgs?.secretHash}, Secret: ${event.parsedArgs?.secret}`);
    // TODO: Implement your atomic swap redeemed event logic
    // Example: Complete swap, transfer tokens, notify participants, etc.
  }

  private async handleRefundedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[REFUNDED] OrderID: ${event.parsedArgs?.orderID}`);
    // TODO: Implement your atomic swap refunded event logic
    // Example: Return tokens to initiator, notify participants, etc.
  }

  private async handleGenericEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[GENERIC] Event: ${event.eventName}, Contract: ${event.contractAddress} (${event.contractType}), Block: ${event.blockNumber}`);
    logger.debug(`Event data:`, event.eventData);
    // TODO: Implement generic event handling logic
  }

  // Method to get all registered event types
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys()).filter(key => key !== '*');
  }

  // Method to check if a handler exists for an event
  hasHandler(eventName: string): boolean {
    return this.handlers.has(eventName) || this.handlers.has('*');
  }
}
