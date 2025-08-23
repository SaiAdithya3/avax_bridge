import { ethers } from 'ethers';
import { ChainConfig, ContractConfig, WatchedEvent, BlockInfo, WatcherStatus, WatcherOptions } from '../types';
import { DatabaseService } from './database';
import { EventHandlerService } from './eventHandler';
import { AbiLoader } from './abiLoader';
import { logger } from '../utils/logger';

export class BlockWatcher {
  private provider: ethers.Provider;
  private chainConfig: ChainConfig;
  private database: DatabaseService;
  private eventHandler: EventHandlerService;
  private isRunning: boolean = false;
  private currentBlock: number = 0;
  private lastProcessedBlock: number = 0;
  private options: WatcherOptions;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    chainConfig: ChainConfig,
    database: DatabaseService,
    eventHandler: EventHandlerService,
    options: WatcherOptions = {}
  ) {
    this.chainConfig = chainConfig;
    this.database = database;
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
      logger.info(`Starting watcher for chain: ${this.chainConfig.name} (${this.chainConfig.id})`);
      
      // Determine start block from contracts configuration
      const startBlocks = this.chainConfig.contracts
        .map(contract => contract.startBlock)
        .filter(block => block !== undefined) as number[];
      
      // Use the minimum start block from contracts, or current block if none specified
      if (startBlocks.length > 0) {
        this.lastProcessedBlock = Math.min(...startBlocks) - 1; // Start one block before
      } else {
        this.lastProcessedBlock = await this.provider.getBlockNumber() - 1; // Start from current block
      }
      
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
        // Get current block number
        this.currentBlock = await this.provider.getBlockNumber();
        
        // Process blocks from last processed + 1 to current
        if (this.currentBlock > this.lastProcessedBlock) {
          await this.processBlocks(this.lastProcessedBlock + 1, this.currentBlock);
        }
        
        // Update status
        await this.updateStatus();
        
        // Wait before next poll
        await this.sleep(this.options.pollInterval!);
        
      } catch (error) {
        logger.error(`Error in block watching loop for chain ${this.chainConfig.id}:`, error);
        await this.handleError(error);
      }
    }
  }

  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    logger.info(`Processing blocks ${fromBlock} to ${toBlock} for chain ${this.chainConfig.id}`);
    
    for (let blockNumber = fromBlock; blockNumber <= toBlock && this.isRunning; blockNumber++) {
      try {
        await this.processBlock(blockNumber);
        this.lastProcessedBlock = blockNumber;
        this.retryCount = 0; // Reset retry count on success
        
      } catch (error) {
        logger.error(`Failed to process block ${blockNumber} for chain ${this.chainConfig.id}:`, error);
        
        // Retry logic - don't move forward until block is processed
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.info(`Retrying block ${blockNumber} (attempt ${this.retryCount}/${this.maxRetries})`);
          await this.sleep(this.retryDelay);
          blockNumber--; // Retry the same block
        } else {
          logger.error(`Max retries exceeded for block ${blockNumber}, stopping watcher`);
          await this.stop();
          throw new Error(`Failed to process block ${blockNumber} after ${this.maxRetries} retries`);
        }
      }
    }
  }

  private async processBlock(blockNumber: number): Promise<void> {
    logger.debug(`Processing block ${blockNumber} for chain ${this.chainConfig.id}`);
    
    // Get block details
    const block = await this.provider.getBlock(blockNumber, true);
    if (!block) {
      throw new Error(`Block ${blockNumber} not found`);
    }

    // Process events from all contracts
    const allEvents: WatchedEvent[] = [];
    
    for (const contract of this.chainConfig.contracts) {
      try {
        const contractEvents = await this.processContractEvents(contract, block, blockNumber);
        allEvents.push(...contractEvents);
      } catch (error) {
        logger.error(`Failed to process contract ${contract.name} events for block ${blockNumber}:`, error);
        // Continue with other contracts
      }
    }

    // Save all events
    if (allEvents.length > 0) {
      await this.database.saveEvents(allEvents);
      logger.info(`Saved ${allEvents.length} events from block ${blockNumber}`);
    }
    
    logger.debug(`Successfully processed block ${blockNumber} with ${allEvents.length} events`);
  }

  private async processContractEvents(
    contract: ContractConfig, 
    block: ethers.Block, 
    blockNumber: number
  ): Promise<WatchedEvent[]> {
    const events: WatchedEvent[] = [];
    
    if (!block.transactions || block.transactions.length === 0) {
      return events;
    }

    // Load ABI for contract type and create interface
    const abi = AbiLoader.loadAbi(contract.type);
    const contractInterface = new ethers.Interface(abi);
    
    // Process each transaction in the block
    for (const tx of block.transactions) {
      if (typeof tx === 'string') continue; // Skip if just hash
      
      // Type assertion for transaction object
      const transaction = tx as ethers.TransactionResponse;
      const receipt = await this.provider.getTransactionReceipt(transaction.hash);
      if (!receipt || !receipt.logs) continue;

      // Filter logs for this contract
      const contractLogs = receipt.logs.filter(log => 
        log.address.toLowerCase() === contract.address.toLowerCase()
      );

      // Process each log
      for (let i = 0; i < contractLogs.length; i++) {
        const log = contractLogs[i];
        try {
          const event = await this.parseLogToEvent(log, contract, block, receipt, contractInterface, i);
          if (event) {
            events.push(event);
          }
        } catch (error) {
          logger.error(`Failed to parse log for contract ${contract.name}:`, error);
          // Continue with other logs
        }
      }
    }

    return events;
  }

  private async parseLogToEvent(
    log: ethers.Log,
    contract: ContractConfig,
    block: ethers.Block,
    receipt: ethers.TransactionReceipt,
    contractInterface: ethers.Interface,
    logIndex: number
  ): Promise<WatchedEvent | null> {
    try {
      // Parse the log
      const parsedLog = contractInterface.parseLog(log);
      if (!parsedLog) return null;

      // Create event object
      const event: WatchedEvent = {
        id: `${this.chainConfig.id}-${block.number}-${logIndex}`,
        chainId: this.chainConfig.id,
        contractAddress: contract.address,
        contractName: contract.name,
        blockNumber: block.number!,
        blockHash: block.hash!,
        transactionHash: receipt.hash,
        logIndex: logIndex,
        eventName: parsedLog.name,
        eventSignature: parsedLog.signature,
        eventData: log,
        parsedArgs: parsedLog.args,
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
    
    await this.database.updateWatcherStatus(status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
