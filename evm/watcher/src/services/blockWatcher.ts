import { ethers } from 'ethers';
import { Chain, ContractConfig, WatchedEvent, WatcherStatus, WatcherOptions } from '../types';
import { EventHandlerService } from './eventHandler';
import { AbiLoader } from './abiLoader';
import { logger } from '../utils/logger';

export class BlockWatcher {
  private provider: ethers.Provider;
  private chainConfig: Chain;
  private eventHandler: EventHandlerService;
  private isRunning: boolean = false;
  private currentBlock: number = 0;
  private lastProcessedBlock: number = 0;
  private options: WatcherOptions;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    chainConfig: Chain,
    eventHandler: EventHandlerService,
    options: WatcherOptions = {}
  ) {
    this.chainConfig = chainConfig;
    this.eventHandler = eventHandler;
    
    this.options = {
      pollInterval: 1000, // 1 second
      maxRetries: 5,
      retryDelay: 5000, // 5 seconds
      batchSize: 10
    };

    this.maxRetries = this.options.maxRetries!;
    this.retryDelay = this.options.retryDelay!;

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Watcher for chain ${this.chainConfig.id} is already running`);
      return;
    }

    try {
      logger.info(`Starting watcher for chain: ${this.chainConfig.id}`);
      logger.info(`Chain ${this.chainConfig.id} has ${this.chainConfig.contracts.length} contracts to monitor`);
      
      // Log all contracts being monitored
      for (const contract of this.chainConfig.contracts) {
        logger.info(`Monitoring contract: ${contract.address} (${contract.type})`);
      }
      
      // Use the chain's start block
      this.lastProcessedBlock = this.chainConfig.startBlock - 1; // Start one block before
      
      // Get current block from blockchain
      this.currentBlock = await this.provider.getBlockNumber();
      
      logger.info(`Chain: ${this.chainConfig.id}, Starting from block: ${this.lastProcessedBlock + 1}, Current: ${this.currentBlock}`);
      
      // Start watching
      this.isRunning = true;
      await this.watchBlocks();
      
    } catch (error) {
      logger.error(`Failed to start watcher for chain ${this.chainConfig.id}:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info(`Stopped watcher for chain: ${this.chainConfig.id}`);
  }

  private async watchBlocks(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we should stop before each iteration
        if (!this.isRunning) break;
        
        // Get current block number
        this.currentBlock = await this.provider.getBlockNumber();
        
        // Process blocks from last processed + 1 to current
        if (this.currentBlock > this.lastProcessedBlock) {
          await this.processBlocks(this.lastProcessedBlock + 1, this.currentBlock);
        }
        
        // Update status
        await this.updateStatus();
        
        // Wait before next poll, but check isRunning periodically
        await this.sleepWithInterrupt(this.options.pollInterval!);
        
      } catch (error) {
        if (!this.isRunning) break; // Exit if we're stopping
        logger.error(`Error in block watching loop for chain ${this.chainConfig.id}:`, error);
        await this.handleError(error);
      }
    }
    logger.info(`Block watching loop stopped for chain: ${this.chainConfig.id}`);
  }

  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    logger.info(`Processing blocks ${fromBlock} to ${toBlock} for chain ${this.chainConfig.id}`);
    
    let totalEvents = 0;
    let processedBlocks = 0;
    
    // Process blocks in batches using maxBlockSpan
    for (let batchStart = fromBlock; batchStart <= toBlock && this.isRunning; batchStart += this.chainConfig.maxBlockSpan) {
      const batchEnd = Math.min(batchStart + this.chainConfig.maxBlockSpan - 1, toBlock);
      
      logger.info(`Processing batch: blocks ${batchStart} to ${batchEnd} for chain ${this.chainConfig.id}`);
      
      try {
        // Process the entire batch
        const batchEvents = await this.processBlockBatch(batchStart, batchEnd);
        totalEvents += batchEvents;
        
        // Update last processed block to the end of this batch
        this.lastProcessedBlock = batchEnd;
        this.retryCount = 0; // Reset retry count on success
        processedBlocks += (batchEnd - batchStart + 1);
        
        logger.info(`Successfully processed batch ${batchStart}-${batchEnd}, found ${batchEvents} events`);
        
      } catch (error) {
        logger.error(`Failed to process batch ${batchStart}-${batchEnd} for chain ${this.chainConfig.id}:`, error);
        
        // Retry logic - don't move forward until batch is processed
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.info(`Retrying batch ${batchStart}-${batchEnd} (attempt ${this.retryCount}/${this.maxRetries})`);
          await this.sleep(this.retryDelay);
          batchStart -= this.chainConfig.maxBlockSpan; // Retry the same batch
        } else {
          logger.error(`Max retries exceeded for batch ${batchStart}-${batchEnd}, stopping watcher`);
          await this.stop();
          throw new Error(`Failed to process batch ${batchStart}-${batchEnd} after ${this.maxRetries} retries`);
        }
      }
    }
    
    logger.info(`Completed processing ${processedBlocks} blocks for chain ${this.chainConfig.id}, total events: ${totalEvents}`);
  }

  private async processBlockBatch(fromBlock: number, toBlock: number): Promise<number> {
    let totalEvents = 0;
    
    // Process all blocks in the batch
    for (let blockNumber = fromBlock; blockNumber <= toBlock && this.isRunning; blockNumber++) {
      try {
        const blockEvents = await this.processBlock(blockNumber);
        totalEvents += blockEvents;
      } catch (error) {
        logger.error(`Failed to process block ${blockNumber} in batch:`, error);
        // Continue with other blocks in the batch, but log the error
      }
    }
    
    return totalEvents;
  }

  private async processBlock(blockNumber: number): Promise<number> {
    try {      
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        logger.warn(`Block ${blockNumber} not found`);
        return 0;
      }

      const allEvents: WatchedEvent[] = [];
      
      // Process each contract
      for (const contract of this.chainConfig.contracts) {
        const contractEvents = await this.processContractEvents(contract, block, blockNumber);
        allEvents.push(...contractEvents);
      }

      // Handle events instead of saving to database
      if (allEvents.length > 0) {
        logger.info(`Block ${blockNumber}: Found ${allEvents.length} events, processing them...`);
        for (const event of allEvents) {
          await this.handleEvent(event);
        }
      }

      this.lastProcessedBlock = blockNumber;
      
      return allEvents.length; // Return the number of events found
      
    } catch (error) {
      logger.error(`Failed to process block ${blockNumber}:`, error);
      throw error;
    }
  }

  private async handleEvent(event: WatchedEvent): Promise<void> {
    // Call the event handler service to process the event with full data
    await this.eventHandler.handleEvent(event);
  }

  private async processContractEvents(
    contract: ContractConfig, 
    block: ethers.Block, 
    blockNumber: number
  ): Promise<WatchedEvent[]> {
    const events: WatchedEvent[] = [];

    try {
      // Load ABI for contract type and create interface
      const abi = AbiLoader.loadAbi(contract.type);
      const contractInterface = new ethers.Interface(abi);
      
      // Log which events we're watching for this contract type
      const availableEvents = AbiLoader.getEventsFromAbi(contract.type);
      logger.debug(`Contract ${contract.address} (${contract.type}) - watching for events: ${availableEvents.join(', ')}`);

      // Query logs directly from the contract for this specific block
      const logs = await this.provider.getLogs({
        address: contract.address,
        fromBlock: blockNumber,
        toBlock: blockNumber
      });

      logger.debug(`Found ${logs.length} logs for contract ${contract.address} in block ${blockNumber}`);

      // Process each log
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        try {
          const event = await this.parseLogToEvent(log, contract, block, contractInterface, i);
          if (event) {
            events.push(event);
            logger.debug(`Successfully parsed event ${event.eventName} from log ${i} in block ${blockNumber}`);
          } else {
            logger.debug(`Failed to parse log ${i} in block ${blockNumber} - might be unknown event`);
          }
        } catch (error) {
          logger.error(`Failed to parse log for contract ${contract.address}:`, error);
          // Continue with other logs
        }
      }

      // Only log if there are events or if it's a significant block
      if (events.length > 0) {
        logger.info(`Contract ${contract.address} processed ${events.length} events in block ${blockNumber}`);
      } else if (logs.length > 0) {
        // Only log when there are logs but no events (for debugging)
        logger.debug(`Contract ${contract.address} processed ${events.length} events in block ${blockNumber} (${logs.length} logs found)`);
      }
      // Don't log anything when there are no logs and no events
      return events;

    } catch (error) {
      logger.error(`Failed to query logs for contract ${contract.address} in block ${blockNumber}:`, error);
      return events;
    }
  }

  private async parseLogToEvent(
    log: ethers.Log,
    contract: ContractConfig,
    block: ethers.Block,
    contractInterface: ethers.Interface,
    logIndex: number
  ): Promise<WatchedEvent | null> {
    try {
      // Parse the log
      const parsedLog = contractInterface.parseLog(log);
      if (!parsedLog) return null;

      // Get transaction receipt for additional gas information
      let gasInfo = {};
      try {
        const receipt = await this.provider.getTransactionReceipt(log.transactionHash!);
        if (receipt) {
          gasInfo = {
            gasUsed: receipt.gasUsed?.toString(),
            gasPrice: receipt.gasPrice?.toString(),
            // Note: effectiveGasPrice might not be available in all ethers versions
            // cumulativeGasUsed: receipt.cumulativeGasUsed?.toString()
          };
        }
      } catch (error) {
        logger.debug(`Could not fetch transaction receipt for ${log.transactionHash}:`, error);
      }

      // Create enhanced event object with complete data
      const event: WatchedEvent = {
        id: `${this.chainConfig.id}-${block.number}-${log.index}`,
        chainId: this.chainConfig.id,
        contractAddress: contract.address,
        contractType: contract.type,
        blockNumber: block.number!,
        blockHash: block.hash!,
        transactionHash: log.transactionHash!,
        logIndex: log.index,
        eventName: parsedLog.name,
        eventSignature: parsedLog.signature,
        eventData: log,
        parsedArgs: parsedLog.args,
        // Enhanced raw log data
        rawLog: {
          address: log.address,
          topics: [...log.topics], // Convert readonly to mutable
          data: log.data,
          blockNumber: log.blockNumber?.toString() || '',
          transactionHash: log.transactionHash || '',
          transactionIndex: log.transactionIndex?.toString() || '',
          blockHash: log.blockHash || '',
          logIndex: log.index?.toString() || '',
          removed: log.removed || false
        },
        // Typed event data based on contract type
        eventDataTyped: this.createTypedEventData(contract.type, parsedLog.name, parsedLog.args),
        // Gas information
        ...gasInfo,
        timestamp: new Date(block.timestamp! * 1000),
        processed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return event;
    } catch (error) {
      logger.debug(`Failed to parse log, might be an unknown event:`, error);
      return null;
    }
  }

  /**
   * Create typed event data based on contract type and event name
   */
  private createTypedEventData(contractType: string, eventName: string, args: any): any {
    try {
      switch (contractType) {
        case 'erc20':
          return this.createERC20TypedData(eventName, args);
        case 'atomic_swap':
          return this.createAtomicSwapTypedData(eventName, args);
        case 'registry':
          return this.createRegistryTypedData(eventName, args);
        default:
          return {};
      }
    } catch (error) {
      logger.debug(`Failed to create typed event data for ${contractType}:${eventName}:`, error);
      return {};
    }
  }

  private createERC20TypedData(eventName: string, args: any): any {
    switch (eventName) {
      case 'Transfer':
        return {
          Transfer: {
            from: args[0],
            to: args[1],
            value: args[2]?.toString()
          }
        };
      case 'Approval':
        return {
          Approval: {
            owner: args[0],
            spender: args[1],
            value: args[2]?.toString()
          }
        };
      default:
        return {};
    }
  }

  private createAtomicSwapTypedData(eventName: string, args: any): any {
    switch (eventName) {
      case 'Initiated':
        return {
          Initiated: {
            orderID: args[0],
            secretHash: args[1],
            amount: args[2]?.toString()
          }
        };
      case 'Redeemed':
        return {
          Redeemed: {
            orderID: args[0],
            secretHash: args[1],
            secret: args[2]
          }
        };
      case 'Refunded':
        return {
          Refunded: {
            orderID: args[0]
          }
        };
      case 'EIP712DomainChanged':
        return {
          EIP712DomainChanged: {}
        };
      default:
        return {};
    }
  }

  private createRegistryTypedData(eventName: string, args: any): any {
    switch (eventName) {
      case 'ATOMIC_SWAPAdded':
        return {
          ATOMIC_SWAPAdded: {
            ATOMIC_SWAP: args[0]
          }
        };
      case 'NativeATOMIC_SWAPAdded':
        return {
          NativeATOMIC_SWAPAdded: {
            nativeATOMIC_SWAP: args[0]
          }
        };
      case 'NativeUDACreated':
        return {
          NativeUDACreated: {
            addressNativeUDA: args[0],
            refundAddress: args[1]
          }
        };
      case 'NativeUDAImplUpdated':
        return {
          NativeUDAImplUpdated: {
            impl: args[0]
          }
        };
      case 'OwnershipTransferred':
        return {
          OwnershipTransferred: {
            previousOwner: args[0],
            newOwner: args[1]
          }
        };
      case 'UDACreated':
        return {
          UDACreated: {
            addressUDA: args[0],
            refundAddress: args[1],
            token: args[2]
          }
        };
      case 'UDAImplUpdated':
        return {
          UDAImplUpdated: {
            impl: args[0]
          }
        };
      default:
        return {};
    }
  }

  private async handleError(error: any): Promise<void> {
    this.retryCount++;
    
    if (this.retryCount >= this.maxRetries) {
      logger.error(`Max retries exceeded for chain ${this.chainConfig.id}, stopping watcher`);
      await this.stop();
      throw error;
    }
    
    logger.warn(`Error occurred, retrying in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
    await this.sleep(this.retryDelay);
  }

  private async updateStatus(): Promise<void> {
    const status: WatcherStatus = {
      chainId: this.chainConfig.id,
      lastProcessedBlock: this.lastProcessedBlock,
      currentBlock: this.currentBlock,
      isRunning: this.isRunning,
      lastActivity: new Date(),
      errorCount: this.retryCount,
      lastError: undefined
    };
    
    // Database connection is available but not updating automatically
    // Uncomment the following lines when you want to enable database updates:
    // try {
    //   await this.databaseService.updateWatcherStatus(status);
    //   logger.debug(`Status updated in database for chain ${this.chainConfig.id}`);
    // } catch (error) {
    //   logger.error(`Failed to update status in database for chain ${this.chainConfig.id}:`, error);
    // }
    
    logger.debug(`Status updated for chain ${this.chainConfig.id}: Last processed block ${this.lastProcessedBlock}, Current block ${this.currentBlock}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sleepWithInterrupt(ms: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < ms && this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }
  }

  // Public methods for monitoring
  getStatus(): { isRunning: boolean; currentBlock: number; lastProcessedBlock: number } {
    return {
      isRunning: this.isRunning,
      currentBlock: this.currentBlock,
      lastProcessedBlock: this.lastProcessedBlock
    };
  }

  async getHealth(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return this.isRunning;
    } catch (error) {
      return false;
    }
  }
}
