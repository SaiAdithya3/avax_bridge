# Atomic Swap Contract Support

The EVM watcher now supports monitoring `atomic_swap` contract types in addition to the existing `erc20` contracts.

## Overview

Atomic swap contracts implement cross-chain token swapping functionality using hash time-locked contracts (HTLC). The watcher can monitor these contracts for the following events:

- **Initiated**: When a new atomic swap is initiated
- **Redeemed**: When an atomic swap is successfully completed
- **Refunded**: When an atomic swap is refunded due to timeout

## Configuration

### 1. Add Atomic Swap Contract to Chain Config

```typescript
import { Chain } from './src/types';

const chainConfig: Chain[] = [
  {
    id: 'arbitrum_sepolia',
    startBlock: 184658726,
    rpcUrl: "https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
    maxBlockSpan: 2000,
    contracts: [
      {
        address: "0xC90Ad772eCc10a52a681ceDAE6EbBD3470A0c829", // USDC
        type: "erc20"
      },
      {
        address: "0xYourAtomicSwapContractAddress", // Atomic Swap Contract
        type: "atomic_swap"
      }
    ]
  }
];
```

### 2. Programmatically Add Contracts

```typescript
import { EVMWatcher } from './src/index';

const watcher = new EVMWatcher();

// Add atomic swap contract to existing chain
await watcher.addContract('arbitrum_sepolia', {
  address: '0xYourContractAddress',
  type: 'atomic_swap'
});
```

## Supported Events

### Initiated Event
```solidity
event Initiated(
    bytes32 indexed orderID,
    bytes32 indexed secretHash,
    uint256 indexed amount
);
```

**Handler**: `handleInitiatedEvent`
- **orderID**: Unique identifier for the swap
- **secretHash**: Hash of the secret used for redemption
- **amount**: Amount of tokens being swapped

### Redeemed Event
```solidity
event Redeemed(
    bytes32 indexed orderID,
    bytes32 indexed secretHash,
    bytes secret
);
```

**Handler**: `handleRedeemedEvent`
- **orderID**: Unique identifier for the swap
- **secretHash**: Hash of the secret used for redemption
- **secret**: The actual secret that was revealed

### Refunded Event
```solidity
event Refunded(
    bytes32 indexed orderID
);
```

**Handler**: `handleRefundedEvent`
- **orderID**: Unique identifier for the swap

## Event Handling

The watcher automatically registers handlers for atomic swap events. You can customize the event handling logic by modifying the handler methods in `src/services/eventHandler.ts`:

```typescript
private async handleInitiatedEvent(event: WatchedEvent): Promise<void> {
  const { orderID, secretHash, amount } = event.parsedArgs;
  
  // Your custom logic here:
  // - Create new swap order in database
  // - Notify participants
  // - Update internal state
  // - etc.
  
  logger.info(`[INITIATED] OrderID: ${orderID}, Amount: ${amount}`);
}

private async handleRedeemedEvent(event: WatchedEvent): Promise<void> {
  const { orderID, secretHash, secret } = event.parsedArgs;
  
  // Your custom logic here:
  // - Complete the swap
  // - Transfer tokens
  // - Notify participants
  // - etc.
  
  logger.info(`[REDEEMED] OrderID: ${orderID}`);
}

private async handleRefundedEvent(event: WatchedEvent): Promise<void> {
  const { orderID } = event.parsedArgs;
  
  // Your custom logic here:
  // - Return tokens to initiator
  // - Update swap status
  // - Notify participants
  // - etc.
  
  logger.info(`[REFUNDED] OrderID: ${orderID}`);
}
```

## ABI File

The watcher automatically loads the `atomic_swap.json` ABI file from the `abi/` directory. This ABI contains all the event definitions and function signatures for atomic swap contracts.

## Monitoring

The watcher will automatically:
1. Load the atomic swap ABI
2. Monitor the specified contract address
3. Parse and handle all atomic swap events
4. Log event details for debugging
5. Execute your custom event handling logic

## Example Use Cases

- **Cross-chain DEX**: Monitor atomic swaps for liquidity provision
- **Bridge Services**: Track cross-chain token transfers
- **Escrow Services**: Monitor time-locked transactions
- **Trading Platforms**: Track swap completions and failures

## Troubleshooting

### Common Issues

1. **ABI Not Found**: Ensure `atomic_swap.json` exists in the `abi/` directory
2. **Contract Address Invalid**: Verify the contract address is correct and deployed
3. **Events Not Detected**: Check if the contract is actually emitting events
4. **Handler Errors**: Review your custom event handling logic for errors

### Debug Logging

Enable debug logging to see detailed information about event processing:

```typescript
// In your logger configuration
logger.setLevel('debug');
```

The watcher will log:
- Contract monitoring status
- Event detection and parsing
- Handler execution results
- Error details and retry attempts
