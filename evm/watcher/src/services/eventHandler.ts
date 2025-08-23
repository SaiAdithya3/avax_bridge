import { WatchedEvent, EventHandler } from '../types';
import { logger } from '../utils/logger';

export class EventHandlerService {
  private handlers: Map<string, EventHandler> = new Map();
  private eventStats: Map<string, number> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    // ERC20 event handlers
    this.registerHandler('Transfer', this.handleTransferEvent.bind(this));
    this.registerHandler('Approval', this.handleApprovalEvent.bind(this));
    
    // Atomic Swap specific event handlers
    this.registerHandler('Initiated', this.handleInitiatedEvent.bind(this));
    this.registerHandler('Redeemed', this.handleRedeemedEvent.bind(this));
    this.registerHandler('Refunded', this.handleRefundedEvent.bind(this));
    this.registerHandler('EIP712DomainChanged', this.handleEIP712DomainChangedEvent.bind(this));
    
    // Registry event handlers
    this.registerHandler('ATOMIC_SWAPAdded', this.handleATOMIC_SWAPAddedEvent.bind(this));
    this.registerHandler('NativeATOMIC_SWAPAdded', this.handleNativeATOMIC_SWAPAddedEvent.bind(this));
    this.registerHandler('NativeUDACreated', this.handleNativeUDACreatedEvent.bind(this));
    this.registerHandler('NativeUDAImplUpdated', this.handleNativeUDAImplUpdatedEvent.bind(this));
    this.registerHandler('OwnershipTransferred', this.handleOwnershipTransferredEvent.bind(this));
    this.registerHandler('UDACreated', this.handleUDACreatedEvent.bind(this));
    this.registerHandler('UDAImplUpdated', this.handleUDAImplUpdatedEvent.bind(this));
    
    // Generic handler for unknown events
    this.registerHandler('*', this.handleGenericEvent.bind(this));
  }

  registerHandler(eventName: string, handler: (event: WatchedEvent) => Promise<void>): void {
    this.handlers.set(eventName, { eventName, handler });
  }

  async handleEvent(event: WatchedEvent): Promise<void> {
    try {
      // Update event statistics
      this.updateEventStats(event.eventName, event.contractAddress);
      
      const handler = this.handlers.get(event.eventName);
      
      if (handler) {
        logger.info(`Processing ${event.eventName} event from ${event.contractType} contract ${event.contractAddress}`);
        
        // Log complete event data
        this.logEventData(event);
        
        await handler.handler(event);
        logger.info(`Successfully processed ${event.eventName} event`);
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

  /**
   * Log complete event data for debugging and monitoring
   */
  private logEventData(event: WatchedEvent): void {
    logger.info(`=== Event: ${event.eventName} ===`);
    logger.info(`Type: ${event.contractType}`);
    logger.info(`Contract: ${event.contractAddress}`);
    logger.info(`Block: ${event.blockNumber}`);
    logger.info(`Transaction: ${event.transactionHash}`);
    
    // Log parsed arguments
    if (event.parsedArgs) {
      logger.info(`Data:`, event.parsedArgs);
    }
  }

  /**
   * Update event processing statistics
   */
  private updateEventStats(eventName: string, contractAddress: string): void {
    const eventKey = `${eventName}:${contractAddress}`;
    const currentCount = this.eventStats.get(eventKey) || 0;
    this.eventStats.set(eventKey, currentCount + 1);
  }

  // ERC20 Event Handlers
  private async handleTransferEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.Transfer) {
      logger.info(`[TRANSFER] From: ${data.Transfer.from}, To: ${data.Transfer.to}, Value: ${data.Transfer.value}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your transfer event logic
    // Example: Update balances, notify users, etc.
  }

  private async handleApprovalEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.Approval) {
      logger.info(`[APPROVAL] Owner: ${data.Approval.owner}, Spender: ${data.Approval.spender}, Value: ${data.Approval.value}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your approval event logic
  }

  // Atomic Swap Event Handlers
  private async handleInitiatedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.Initiated) {
      logger.info(`[INITIATED] OrderID: ${data.Initiated.orderID}, SecretHash: ${data.Initiated.secretHash}, Amount: ${data.Initiated.amount}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your atomic swap initiated event logic
    // Example: Create new swap order, notify participants, etc.
  }

  private async handleRedeemedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.Redeemed) {
      logger.info(`[REDEEMED] OrderID: ${data.Redeemed.orderID}, SecretHash: ${data.Redeemed.secretHash}, Secret: ${data.Redeemed.secret}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your atomic swap redeemed event logic
    // Example: Complete swap, transfer tokens, notify participants, etc.
  }

  private async handleRefundedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.Refunded) {
      logger.info(`[REFUNDED] OrderID: ${data.Refunded.orderID}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your atomic swap refunded event logic
    // Example: Return tokens to initiator, notify participants, etc.
  }

  private async handleEIP712DomainChangedEvent(event: WatchedEvent): Promise<void> {
    logger.info(`[EIP712_DOMAIN_CHANGED] Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    // TODO: Implement your EIP712 domain changed event logic
  }

  // Registry Event Handlers
  private async handleATOMIC_SWAPAddedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.ATOMIC_SWAPAdded) {
      logger.info(`[ATOMIC_SWAP_ADDED] ATOMIC_SWAP: ${data.ATOMIC_SWAPAdded.ATOMIC_SWAP}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your ATOMIC_SWAP added event logic
  }

  private async handleNativeATOMIC_SWAPAddedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.NativeATOMIC_SWAPAdded) {
      logger.info(`[NATIVE_ATOMIC_SWAP_ADDED] NativeATOMIC_SWAP: ${data.NativeATOMIC_SWAPAdded.nativeATOMIC_SWAP}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your native ATOMIC_SWAP added event logic
  }

  private async handleNativeUDACreatedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.NativeUDACreated) {
      logger.info(`[NATIVE_UDA_CREATED] Address: ${data.NativeUDACreated.addressNativeUDA}, Refund: ${data.NativeUDACreated.refundAddress}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your native UDA created event logic
  }

  private async handleNativeUDAImplUpdatedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.NativeUDAImplUpdated) {
      logger.info(`[NATIVE_UDA_IMPL_UPDATED] Implementation: ${data.NativeUDAImplUpdated.impl}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your native UDA implementation updated event logic
  }

  private async handleOwnershipTransferredEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.OwnershipTransferred) {
      logger.info(`[OWNERSHIP_TRANSFERRED] From: ${data.OwnershipTransferred.previousOwner}, To: ${data.OwnershipTransferred.newOwner}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your ownership transferred event logic
  }

  private async handleUDACreatedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.UDACreated) {
      logger.info(`[UDA_CREATED] Address: ${data.UDACreated.addressUDA}, Refund: ${data.UDACreated.refundAddress}, Token: ${data.UDACreated.token}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your UDA created event logic
  }

  private async handleUDAImplUpdatedEvent(event: WatchedEvent): Promise<void> {
    const data = event.eventDataTyped as any;
    if (data?.UDAImplUpdated) {
      logger.info(`[UDA_IMPL_UPDATED] Implementation: ${data.UDAImplUpdated.impl}`);
      logger.info(`Contract: ${event.contractAddress}, Block: ${event.blockNumber}`);
    }
    // TODO: Implement your UDA implementation updated event logic
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

  // Method to get event statistics
  getEventStats(): Map<string, number> {
    return new Map(this.eventStats);
  }

  // Method to reset event statistics
  resetEventStats(): void {
    this.eventStats.clear();
    logger.info('Event statistics reset');
  }
}
