# EVM Executor

The EVM Executor is a TypeScript service that automatically processes cross-chain bridge orders by monitoring the database and executing the necessary blockchain transactions.

## Features

- **Automatic Order Processing**: Monitors the database every 2 seconds for pending orders
- **Smart Order Analysis**: Determines the appropriate action for each order based on its current state
- **Contract Interactions**: Handles both initiate and redeem operations for atomic swaps
- **ERC20 Support**: Supports ERC20 token operations (no native token support)
- **Error Handling**: Robust error handling with Result types using neverthrow
- **Graceful Shutdown**: Handles SIGINT and SIGTERM signals properly

## Prerequisites

- Node.js 18+ 
- MongoDB instance
- EVM private key
- Contract addresses for AtomicSwap and HTLC contracts

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=avax_bridge

# Executor Configuration
POLL_INTERVAL=2000
MAX_RETRIES=5
RETRY_DELAY=5000
GAS_LIMIT=500000
GAS_PRICE=auto

# Wallet Configuration
EVM_PRIVATE_KEY=your_private_key_here
CHAIN_ID=43113
EVM_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Contract Addresses
ATOMIC_SWAP_ADDRESS=your_atomic_swap_contract_address
HTLC_ADDRESS=your_htlc_contract_address
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Watch Mode
```bash
npm run watch
```

## Architecture

### Services

1. **DatabaseService**: Handles MongoDB connections and queries
2. **WalletService**: Manages EVM wallet operations
3. **ContractService**: Handles contract interactions (initiate/redeem)
4. **OrderProcessor**: Analyzes orders and determines actions
5. **ExecutorService**: Main orchestrator that coordinates all services

### Order Processing Flow

1. **Poll Database**: Every 2 seconds, fetch pending orders from MongoDB
2. **Analyze Orders**: Determine the current state and required action for each order
3. **Execute Actions**: 
   - If source swap is initiated but destination not initiated → Initiate destination swap
   - If both swaps initiated but destination not redeemed → Redeem destination swap
4. **Update Database**: Record transaction hashes for executed operations

### Order States

- **counterPartyInitiated**: Source swap initiated, need to initiate destination swap
- **counterPartyRedeemed**: Both swaps initiated, need to redeem destination swap
- **completed**: Order fully completed
- **pending**: Order is in pending state

## Contract ABIs

The executor uses three main contract ABIs:
- `atomicSwap.json`: For atomic swap operations
- `htlc.json`: For HTLC operations (native tokens)
- `erc20.json`: For ERC20 token operations

## Error Handling

The service uses the `neverthrow` library for robust error handling. All async operations return `Result<T, E>` types that can be safely handled without try-catch blocks.

## Monitoring

The service logs its status every 30 seconds, including:
- Running state
- Wallet address
- Poll interval

## Graceful Shutdown

The service handles SIGINT and SIGTERM signals to ensure proper cleanup of database connections and running processes.

## Configuration

All configuration is centralized in `config.ts` and can be customized via environment variables:

- `POLL_INTERVAL`: How often to check for new orders (default: 2000ms)
- `GAS_LIMIT`: Gas limit for transactions (default: 500000)
- `MAX_RETRIES`: Maximum retry attempts for failed operations
- `RETRY_DELAY`: Delay between retry attempts

## Security

- Private keys are stored in environment variables
- No sensitive data is logged
- All contract interactions are validated before execution
