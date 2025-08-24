# UDA Watcher

A TypeScript-based watcher service that monitors ERC20 token balances for atomic swap orders on EVM chains.

## Features

- **Database Connection**: Connects to MongoDB to fetch all orders
- **EVM Chain Support**: Supports Avalanche testnet and Arbitrum Sepolia
- **ERC20 Balance Checking**: Uses ABI-based contract instances to check token balances
- **Order Processing**: Processes all orders and checks if deposit addresses have sufficient balances
- **Bitcoin Exclusion**: Automatically filters out bitcoin-related orders
- **Real-time Monitoring**: Continuously monitors balances at configurable intervals

## What It Does

1. **Connects to Database**: Establishes connection to MongoDB
2. **Fetches All Orders**: Retrieves all orders from the database
3. **Filters EVM Orders**: Excludes bitcoin orders, keeps only EVM chain orders
4. **Checks Token Balances**: For each swap, checks the ERC20 token balance on the deposit address
5. **Validates Sufficient Balance**: Compares current balance with required amount (`order.swap.amount`)
6. **Reports Results**: Logs detailed information about each balance check
7. **Handles Amount Matches**: When sufficient balance is detected, triggers configurable actions

## Supported Chains

- `avalanche_testnet` - Avalanche C-Chain testnet
- `arbitrum_sepolia` - Arbitrum Sepolia testnet

## Configuration

Set the following environment variables:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=orderbook

# RPC URLs
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# UDA Watcher Settings
UDA_POLL_INTERVAL=10000
UDA_MAX_RETRIES=3
UDA_RETRY_DELAY=5000


```

## Installation

```bash
cd evm/uda
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Build and Run
```bash
npm run build
npm start
```

### Watch Mode
```bash
npm run watch
```

## Architecture

- **`DatabaseService`**: Handles MongoDB connection and order fetching
- **`BalanceService`**: Manages EVM providers and ERC20 balance checking
- **`UDAWatcher`**: Main orchestrator that coordinates the entire process
- **`index.ts`**: Entry point with graceful shutdown handling

## Key Components

### Database Service
- Connects to MongoDB
- Fetches all orders
- Filters out bitcoin orders
- Provides order management functions

### Balance Service
- Initializes EVM chain providers
- Creates ERC20 contract instances using ABI
- Checks token balances on deposit addresses
- Compares balances with required amounts

### UDA Watcher
- Orchestrates the entire process
- Runs continuous monitoring loop
- Processes balance check results
- Provides status monitoring
- **Amount Match Handler**: Triggers configurable actions when sufficient balance is detected

## Output Example

```
Order abc123:
  Chain: avalanche_testnet
  Token: 0x1234...5678
  Deposit Address: 0xabcd...efgh
  Required Amount: 1000000000000000000
  Current Balance: 1500000000000000000
  Has Enough Balance: true
  Timestamp: 2024-01-15T10:30:00.000Z
---

🎯 AMOUNT MATCH for order abc123
   Balance requirement met: 1500000000000000000 >= 1000000000000000000
🚀 Processing amount match for order abc123...
   Actions enabled: update_order_status,notify_system,initiate_swap
📝 [PLACEHOLDER] Updating order status for abc123
✅ Order status updated for abc123
🔔 [PLACEHOLDER] Notifying system about amount match for abc123
✅ System notified about amount match for abc123
🔄 [PLACEHOLDER] Initiating atomic swap for abc123
✅ Atomic swap initiated for abc123
✅ Amount match handler completed for order abc123
```

## Error Handling

- Graceful shutdown on SIGINT/SIGTERM
- Provider health checks
- Comprehensive error logging
- Retry mechanisms for failed operations



## Monitoring

The service provides:
- Real-time status updates
- Detailed balance check logs
- Warning messages for insufficient balances
- Health status for EVM providers
