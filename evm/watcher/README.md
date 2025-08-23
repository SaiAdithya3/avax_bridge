# EVM Watcher - Enhanced Event Processing System

A comprehensive blockchain event monitoring system that captures and processes all events from EVM-compatible chains with complete data preservation.

## Features

### 🎯 Complete Event Data Capture
- **Raw Log Data**: Captures all raw blockchain log data including topics, data, and metadata
- **Parsed Arguments**: Extracts and parses event arguments according to ABI definitions
- **Typed Event Data**: Provides strongly-typed event data structures for each contract type
- **Gas Information**: Captures transaction gas usage, price, and cumulative gas data
- **Transaction Details**: Includes block information, timestamps, and transaction hashes

### 🔍 Supported Contract Types
- **ERC20**: Transfer and Approval events
- **Atomic Swap**: Initiated, Redeemed, Refunded, and EIP712DomainChanged events
- **Registry**: Contract management events including ownership transfers and implementation updates

### ⚡ Multi-Chain Support
- Avalanche Fuji Testnet (43113)
- Arbitrum Sepolia Testnet (421614)
- Easily extensible to other EVM chains

## Event Data Structure

Every processed event contains the following complete information:

```typescript
interface WatchedEvent {
  // Basic identification
  id: string;
  chainId: string;
  contractAddress: string;
  contractType: string;
  
  // Blockchain metadata
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  
  // Event information
  eventName: string;
  eventSignature: string;
  
  // Complete data capture
  eventData: any;                    // Raw log data from blockchain
  parsedArgs: any;                   // Parsed arguments from ABI
  rawLog: {                          // Enhanced raw log data
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  };
  eventDataTyped: any;               // Strongly-typed event data
  
  // Gas information
  gasUsed?: string;
  gasPrice?: string;
  effectiveGasPrice?: string;
  cumulativeGasUsed?: string;
  
  // Timestamps
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Processing status
  processed: boolean;
}
```

## Supported Events

### ERC20 Events
```typescript
Transfer: {
  from: string;      // Sender address
  to: string;        // Recipient address
  value: string;     // Token amount
}

Approval: {
  owner: string;     // Token owner
  spender: string;   // Approved spender
  value: string;     // Approved amount
}
```

### Atomic Swap Events
```typescript
Initiated: {
  orderID: string;       // Unique order identifier
  secretHash: string;    // Hash of the secret
  amount: string;        // Swap amount
}

Redeemed: {
  orderID: string;       // Unique order identifier
  secretHash: string;    // Hash of the secret
  secret: string;        // The actual secret
}

Refunded: {
  orderID: string;       // Unique order identifier
}

EIP712DomainChanged: {}  // Domain configuration changed
```

### Registry Events
```typescript
ATOMIC_SWAPAdded: {
  ATOMIC_SWAP: string;   // Added atomic swap contract
}

NativeATOMIC_SWAPAdded: {
  nativeATOMIC_SWAP: string;  // Added native atomic swap contract
}

NativeUDACreated: {
  addressNativeUDA: string;   // Created native UDA address
  refundAddress: string;      // Refund address
}

OwnershipTransferred: {
  previousOwner: string;      // Previous owner
  newOwner: string;          // New owner
}

UDACreated: {
  addressUDA: string;        // Created UDA address
  refundAddress: string;     // Refund address
  token: string;             // Associated token
}
```

## Configuration

### Chain Configuration
```typescript
const chainConfig: Chain[] = [
  {
    id: '43113', // Avalanche Fuji
    startBlock: 0,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    maxBlockSpan: 100,
    contracts: [
      {
        address: '0x...', // Your contract address
        type: 'erc20'
      },
      {
        address: '0x...', // Your contract address
        type: 'atomic_swap'
      },
      {
        address: '0x...', // Your contract address
        type: 'registry'
      }
    ]
  }
];
```

### Watcher Options
```typescript
const WATCHER_CONFIG = {
  pollInterval: 1000,    // Poll every 1 second
  maxRetries: 5,         // Maximum retry attempts
  retryDelay: 5000,      // Delay between retries
  batchSize: 10          // Process 10 blocks at a time
};
```

## Usage

### Starting the Watcher
```typescript
import { EVMWatcher } from './src/index';

const watcher = new EVMWatcher();
await watcher.start();
```

### Adding Contracts Dynamically
```typescript
await watcher.addContract('43113', {
  address: '0x...',
  type: 'erc20'
});
```

### Getting Event Statistics
```typescript
const eventHandler = watcher.eventHandler;
const stats = eventHandler.getEventStats();
console.log('Event processing statistics:', stats);
```

## Event Processing Flow

1. **Block Monitoring**: Continuously monitors new blocks on configured chains
2. **Log Extraction**: Extracts all logs from monitored contracts in each block
3. **Event Parsing**: Parses logs using contract ABIs to extract event data
4. **Data Enhancement**: Adds gas information, timestamps, and typed data structures
5. **Handler Execution**: Routes events to appropriate handlers based on event type
6. **Complete Logging**: Logs all event data for monitoring and debugging

## Data Preservation

The system ensures **zero data loss** by:
- Capturing raw blockchain logs exactly as emitted
- Preserving all event topics and data
- Maintaining original transaction and block information
- Storing both parsed and raw representations
- Including gas usage and pricing information

## Monitoring and Debugging

### Event Data Logging
Every event is logged with complete information:
```
=== Event Data for Transfer ===
Contract: 0x... (erc20)
Block: 12345 (0x...)
Transaction: 0x...
Log Index: 0
Timestamp: 2024-01-01T00:00:00.000Z
Parsed Args: { from: '0x...', to: '0x...', value: '1000000000000000000' }
Typed Event Data: { Transfer: { from: '0x...', to: '0x...', value: '1000000000000000000' } }
Gas Info: { gasUsed: '21000', gasPrice: '20000000000' }
Raw Log Topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x...', '0x...']
Raw Log Data: 0x...
=== End Event Data ===
```

### Statistics Tracking
Track event processing statistics:
- Total events processed
- Events by type and contract
- Processing errors
- Last processed event timestamp

## Error Handling

- **Retry Logic**: Automatic retry with exponential backoff
- **Graceful Degradation**: Continues processing other events if one fails
- **Comprehensive Logging**: Detailed error information for debugging
- **Health Monitoring**: Continuous health checks and status reporting

## Performance

- **Batch Processing**: Processes multiple blocks simultaneously
- **Efficient Polling**: Configurable polling intervals
- **Memory Management**: Efficient data structures and caching
- **Scalable Architecture**: Easy to add new chains and contracts

## Extensibility

### Adding New Contract Types
1. Add new contract type to `ContractType` union
2. Create event data interfaces
3. Add event handlers
4. Update ABI loading logic

### Adding New Events
1. Define event structure in ABI
2. Add to supported events list
3. Create typed data mapping
4. Implement event handler

## Security Features

- **Input Validation**: Validates all contract addresses and configurations
- **Error Isolation**: Prevents single event failure from affecting others
- **Secure Logging**: No sensitive data exposure in logs
- **Access Control**: Configurable contract monitoring permissions

## Development

### Prerequisites
- Node.js 18+
- TypeScript 5+
- Access to EVM RPC endpoints

### Installation
```bash
npm install
npm run build
npm start
```

### Testing
```bash
npm test
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
