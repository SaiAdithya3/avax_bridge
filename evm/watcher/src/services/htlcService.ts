import { logger } from '../utils/logger';
import { DatabaseService } from './database';

export interface MongoDBOrder {
  _id?: string;
  created_at: Date;
  source_swap: {
    swap_id: string;
    chain: string;
    asset: string;
    htlc_address: string;
    token_address: string;
    initiator: string;
    redeemer: string;
    filled_amount: string;
    amount: string;
    timelock: number;
    secret_hash: string;
    secret?: string;
    initiate_tx_hash?: string;
    redeem_tx_hash?: string;
    refund_tx_hash?: string;
    initiate_block_number?: string;
    redeem_block_number?: string;
    refund_block_number?: string;
    deposit_address?: string;
  };
  destination_swap: {
    swap_id: string;
    chain: string;
    asset: string;
    htlc_address: string;
    token_address: string;
    initiator: string;
    redeemer: string;
    filled_amount: string;
    amount: string;
    timelock: number;
    secret_hash: string;
    secret?: string;
    initiate_tx_hash?: string;
    redeem_tx_hash?: string;
    refund_tx_hash?: string;
    initiate_block_number?: string;
    redeem_block_number?: string;
    refund_block_number?: string;
    deposit_address?: string;
  };
  create_order: {
    from: string;
    to: string;
    source_amount: string;
    destination_amount: string;
    initiator_source_address: string;
    initiator_destination_address: string;
    secret_hash: string;
    nonce: string;
    bitcoin_optional_recipient?: string;
    create_id?: string;
  };
}

export class HTLCService {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    logger.info('HTLC Service initialized with MongoDB integration');
  }

  /**
   * Update swap record when Initiated event occurs
   */
  async updateSwapInitiated(orderID: string, txHash: string, blockNumber: number): Promise<boolean> {
    try {
      // Find and update the order in MongoDB
      const result = await this.updateOrderSwapField(
        orderID, 
        'initiate_tx_hash', 
        txHash, 
        'initiate_block_number', 
        blockNumber.toString()
      );
      
      return result;
    } catch (error) {
      logger.error(`[HTLC] Failed to update swap ${orderID} initiate details:`, error);
      throw error;
    }
  }

  /**
   * Update swap record when Redeemed event occurs
   */
  async updateSwapRedeemed(orderID: string, txHash: string, blockNumber: number): Promise<boolean> {
    try {
      // Find and update the order in MongoDB
      const result = await this.updateOrderSwapField(
        orderID, 
        'redeem_tx_hash', 
        txHash, 
        'redeem_block_number', 
        blockNumber.toString()
      );
      
      return result;
    } catch (error) {
      logger.error(`[HTLC] Failed to update swap ${orderID} redeem details:`, error);
      throw error;
    }
  }

  /**
   * Update swap record when Refunded event occurs
   */
  async updateSwapRefunded(orderID: string, txHash: string, blockNumber: number): Promise<boolean> {
    try {
      // Find and update the order in MongoDB
      const result = await this.updateOrderSwapField(
        orderID, 
        'refund_tx_hash', 
        txHash, 
        'refund_block_number', 
        blockNumber.toString()
      );
      
      return result;
    } catch (error) {
      logger.error(`[HTLC] Failed to update swap ${orderID} refund details:`, error);
      throw error;
    }
  }

  /**
   * Update order swap field in MongoDB
   * Searches for orders where either source_swap.swap_id or destination_swap.swap_id matches the orderID
   */
  private async updateOrderSwapField(
    orderID: string, 
    txHashField: string, 
    txHash: string, 
    blockNumberField: string, 
    blockNumber: string
  ): Promise<boolean> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot update order');
        return false;
      }

      const collection = this.databaseService.getCollection('orders');
      
      // Strip "0x" prefix from orderID for comparison
      const normalizedOrderID = orderID.startsWith('0x') ? orderID.slice(2) : orderID;
      
      // First, find the order to determine which swap matches
      const order = await collection.findOne({
        $or: [
          { 'source_swap.swap_id': normalizedOrderID },
          { 'destination_swap.swap_id': normalizedOrderID }
        ]
      });

      if (!order) {
        logger.warn(`[HTLC] No orders found for swap ID: ${normalizedOrderID}`);
        return false;
      }

      // Determine which swap matches and create targeted update
      let update: any = { updated_at: new Date() };
      
      if (order.source_swap?.swap_id === normalizedOrderID) {
        // Source swap matches - only update source
        update[`source_swap.${txHashField}`] = txHash;
        update[`source_swap.${blockNumberField}`] = blockNumber;
        logger.debug(`[HTLC] Updating source swap for order ${order._id}`);
      } else if (order.destination_swap?.swap_id === normalizedOrderID) {
        // Destination swap matches - only update destination
        update[`destination_swap.${txHashField}`] = txHash;
        update[`destination_swap.${blockNumberField}`] = blockNumber;
        logger.debug(`[HTLC] Updating destination swap for order ${order._id}`);
      }

      // Update the specific order
      const result = await collection.updateOne(
        { _id: order._id },
        { $set: update }
      );
      
      if (result.modifiedCount > 0) {
        logger.debug(`[HTLC] Successfully updated order ${order._id} for swap ID: ${normalizedOrderID}`);
      }
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`[HTLC] Failed to update order for swap ${orderID}:`, error);
      throw error;
    }
  }

  /**
   * Get order by swap ID
   */
  async getOrderBySwapId(swapId: string): Promise<MongoDBOrder | null> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot get order');
        return null;
      }

      const collection = this.databaseService.getCollection('orders');
      
      // Strip "0x" prefix from swapId for comparison
      const normalizedSwapId = swapId.startsWith('0x') ? swapId.slice(2) : swapId;
      
      const filter = {
        $or: [
          { 'source_swap.swap_id': normalizedSwapId },
          { 'destination_swap.swap_id': normalizedSwapId }
        ]
      };

      const order = await collection.findOne(filter);
      return order as MongoDBOrder | null;
    } catch (error) {
      logger.error(`[HTLC] Failed to get order for swap ${swapId}:`, error);
      return null;
    }
  }

  /**
   * Get all orders
   */
  async getAllOrders(): Promise<MongoDBOrder[]> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot get orders');
        return [];
      }

      const collection = this.databaseService.getCollection('orders');
      const orders = await collection.find({}).toArray();
      return orders as unknown as MongoDBOrder[];
    } catch (error) {
      logger.error('[HTLC] Failed to get all orders:', error);
      return [];
    }
  }

  /**
   * Get orders by status (based on transaction hashes)
   */
  async getOrdersByStatus(status: 'pending' | 'initiated' | 'redeemed' | 'refunded'): Promise<MongoDBOrder[]> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot get orders');
        return [];
      }

      const collection = this.databaseService.getCollection('orders');
      let filter = {};

      switch (status) {
        case 'pending':
          filter = {
            $and: [
              { 'source_swap.initiate_tx_hash': { $exists: false } },
              { 'destination_swap.initiate_tx_hash': { $exists: false } }
            ]
          };
          break;
        case 'initiated':
          filter = {
            $and: [
              { 'source_swap.initiate_tx_hash': { $exists: true } },
              { 'source_swap.redeem_tx_hash': { $exists: false } },
              { 'source_swap.refund_tx_hash': { $exists: false } }
            ]
          };
          break;
        case 'redeemed':
          filter = {
            'source_swap.redeem_tx_hash': { $exists: true }
          };
          break;
        case 'refunded':
          filter = {
            'source_swap.refund_tx_hash': { $exists: true }
          };
          break;
      }

      const orders = await collection.find(filter).toArray();
      return orders as unknown as MongoDBOrder[];
    } catch (error) {
      logger.error(`[HTLC] Failed to get orders by status ${status}:`, error);
      return [];
    }
  }

  /**
   * Get total count of orders in database
   */
  async getOrdersCount(): Promise<number> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot get orders count');
        return 0;
      }

      const collection = this.databaseService.getCollection('orders');
      const count = await collection.countDocuments({});
      logger.info(`[HTLC] Total orders in database: ${count}`);
      return count;
    } catch (error) {
      logger.error('[HTLC] Failed to get orders count:', error);
      return 0;
    }
  }

  /**
   * Validate if a swap ID exists in any order
   */
  async validateSwapExists(swapId: string): Promise<boolean> {
    try {
      if (!this.databaseService.isDatabaseConnected()) {
        logger.warn('[HTLC] Database not connected, cannot validate swap');
        return false;
      }

      const collection = this.databaseService.getCollection('orders');
      
      // Strip "0x" prefix from swapId for comparison
      const normalizedSwapId = swapId.startsWith('0x') ? swapId.slice(2) : swapId;
      
      logger.info(`[HTLC] Searching for swap ID: ${swapId} (normalized: ${normalizedSwapId})`);
      
      const filter = {
        $or: [
          { 'source_swap.swap_id': normalizedSwapId },
          { 'destination_swap.swap_id': normalizedSwapId }
        ]
      };

      // First, let's see what's actually in the database for debugging
      const sampleOrder = await collection.findOne({});
      if (sampleOrder) {
        logger.info(`[HTLC] Sample order source_swap.swap_id: ${sampleOrder.source_swap?.swap_id}`);
        logger.info(`[HTLC] Sample order destination_swap.swap_id: ${sampleOrder.destination_swap?.swap_id}`);
      }

      const count = await collection.countDocuments(filter);
      logger.info(`[HTLC] Found ${count} matching orders for swap ID: ${normalizedSwapId}`);
      
      // If no matches found, let's search more broadly to see what's there
      if (count === 0) {
        const partialMatch = await collection.findOne({
          $or: [
            { 'source_swap.swap_id': { $regex: normalizedSwapId.slice(-8) } },
            { 'destination_swap.swap_id': { $regex: normalizedSwapId.slice(-8) } }
          ]
        });
        if (partialMatch) {
          logger.info(`[HTLC] Partial match found - source: ${partialMatch.source_swap?.swap_id}, destination: ${partialMatch.destination_swap?.swap_id}`);
        }
      }
      
      return count > 0;
    } catch (error) {
      logger.error(`[HTLC] Failed to validate swap ${swapId}:`, error);
      return false;
    }
  }
}
