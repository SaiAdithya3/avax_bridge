import { Order, OrderWithAction, OrderAction } from '../types';
import { isOrderForSupportedChains } from '../utils/networkUtils';

export class OrderProcessor {
  static analyzeOrder(order: Order): OrderWithAction {
    console.log("secret", order.destination_swap.secret);
    // First check if the order is for supported chains
    if (!isOrderForSupportedChains(order)) {
      return {
        order,
        action: 'pending',
        reason: 'Order is not for supported chains (avalanche_testnet or arbitrum_sepolia)'
      };
    }
    console.log("checkpoint1");
    const { source_swap, destination_swap } = order;

    // Check if source swap is initiated
    const sourceInitiated = source_swap.initiate_tx_hash && source_swap.initiate_tx_hash !== '';
    console.log("checkpoint2");
    // Check if destination swap is initiated
    const destinationInitiated = destination_swap.initiate_tx_hash && destination_swap.initiate_tx_hash !== '';
    console.log("checkpoint3");
    // Check if destination swap is redeemed
    const destinationRedeemed = destination_swap.redeem_tx_hash && destination_swap.redeem_tx_hash !== '';
    console.log("checkpoint4");

    // Scenario 1: Source initiated but destination not initiated
    if (sourceInitiated && !destinationInitiated) {
      console.log("checkpoint5");
      return {
        order,
        action: 'counterPartyInitiated',
        reason: 'Source swap initiated, need to initiate destination swap'
      };
    }

    // Scenario 2: Both initiated but destination not redeemed
    // Only try to redeem if the source chain is EVM (not Bitcoin)
    if (sourceInitiated && destinationInitiated && destinationRedeemed) {
      console.log("checkpoint6");
      // Check if source chain is EVM (not Bitcoin)
      const isSourceEvm = source_swap.chain === 'avalanche_testnet' || source_swap.chain === 'arbitrum_sepolia';
      
      if (isSourceEvm) {
        console.log("checkpoint7");
        console.log('Source chain is EVM, checking if secret is available for redemption');
        console.log('Destination swap secret:', destination_swap.secret);
        // Check if the secret is available for redemption
        if (!destination_swap.secret) {
          return {
            order,
            action: 'pending',
            reason: 'Both swaps initiated, but secret is not available for redemption yet'
          };
        } else {
          return {
            order,
            action: 'counterPartyRedeemed',
            reason: 'Both swaps initiated, need to redeem destination swap (source is EVM)'
          };
        }
        
      } else {
        // Source is Bitcoin, so we can't redeem on Bitcoin side
        // The order is effectively completed after destination initiation
        return {
          order,
          action: 'completed',
          reason: 'Both swaps initiated, source is Bitcoin - no EVM redemption needed'
        };
      }
    }

    // Scenario 3: Order is completed
    if (sourceInitiated && destinationInitiated && destinationRedeemed) {
      return {
        order,
        action: 'completed',
        reason: 'Order fully completed'
      };
    }

    // Default case: pending
    return {
      order,
      action: 'pending',
      reason: 'Order is in pending state'
    };
  }

  static analyzeOrders(orders: Order[]): OrderWithAction[] {
    return orders.map(order => this.analyzeOrder(order));
  }

  static filterOrdersByAction(ordersWithActions: OrderWithAction[], action: OrderAction): OrderWithAction[] {
    return ordersWithActions.filter(orderWithAction => orderWithAction.action === action);
  }

  static getActionableOrders(orders: Order[]): OrderWithAction[] {
    const ordersWithActions = this.analyzeOrders(orders);
    return ordersWithActions.filter(orderWithAction => 
      orderWithAction.action === 'counterPartyInitiated' || 
      orderWithAction.action === 'counterPartyRedeemed'
    );
  }

  static getSupportedChainOrders(orders: Order[]): Order[] {
    return orders.filter(isOrderForSupportedChains);
  }
}
