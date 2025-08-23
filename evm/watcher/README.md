# EVM Blockchain Event Watcher

A robust, multi-chain EVM blockchain event watcher that monitors new blocks and processes contract events in real-time. **Currently supports ERC20 tokens only.**

## 🏗️ **Architecture Overview**

```
evm/watcher/
├── config.ts                 # 🎯 CENTRALIZED CONFIGURATION
├── abi/                      # 📄 CONTRACT ABI FILES
│   └── erc20.json           # ERC20 token ABI
├── package.json
├── tsconfig.json
├── src/
│   ├── types/               # TypeScript interfaces
│   ├── services/            # Core services
│   │   ├── abiLoader.ts     # ABI management service
│   │   ├── database.ts      # MongoDB operations
│   │   ├── eventHandler.ts  # Event processing
│   │   ├── blockWatcher.ts  # Block monitoring
│   │   └── watcherManager.ts # Multi-chain coordination
│   ├── utils/               # Utilities
│   └── examples/            # Usage examples
└── dist/                    # Compiled JavaScript
```

## ⚙️ **Centralized Configuration**

**All configuration is centralized in `/config.ts`** - no scattered config files!

### **1. Database Configuration**
```typescript
export const DB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  name: process.env.MONGODB_DB || 'evm_watcher',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};
```

### **2. Watcher Configuration**
```typescript
export const WATCHER_CONFIG = {
  pollInterval: parseInt(process.env.POLL_INTERVAL || '1000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000'),
  batchSize: parseInt(process.env.BATCH_SIZE || '10')
};
```

### **3. Simplified Chain Configuration**
```typescript
export const chainConfig: Chain[] = [
  {
    id: 'ethereum',
    startBlock: 15000000,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    contracts: [
      {
        address: "0xA0b86a33E6441b8c4C1C1b8B4b2b8B4b2b8B4b2b", // USDC
        type: "erc20"
      }
    ]
  }
];
```

### **4. Contract Configuration**
```typescript
interface ContractConfig {
  address: string;    // Contract address
  type: 'erc20';      // Contract type (ABI loaded automatically)
}
```

**No more complex configuration!** Just specify:
- **Chain ID** and **start block**
- **RPC URL** for the chain
- **Contract address** and **type**
- **Events are automatically determined** based on contract type

### **5. Supported Contract Types**
- **`erc20`**: Standard ERC20 tokens
- *More types coming soon...*

### **6. ABI Management**
ABIs are stored in `/abi/` directory:
- `erc20.json` - Complete ERC20 token ABI
- ABIs are automatically loaded based on contract type
- No need to manually specify ABI in configuration

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
cd evm/watcher
npm install
```

### **2. Configure Your ERC20 Contracts**
Edit `config.ts` and add your ERC20 tokens:

```typescript
// Add your ERC20 contract to ethereum
chainConfig[0].contracts.push({
  address: "0xYourContractAddress",
  type: "erc20" // ABI loaded automatically, events determined by type
});
```

**That's it!** No need to specify:
- ❌ ABI arrays
- ❌ Event lists  
- ❌ Contract names
- ❌ Start blocks per contract

### **3. Set Environment Variables (Optional)**
```bash
export MONGODB_URI="mongodb://your-server:27017"
export ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export AVALANCHE_RPC_URL="https://api.avax.network/ext/bc/C/rpc"
```

### **4. Build and Run**
```bash
npm run build
npm start
```

## 🔧 **Contract Management**

### **Adding ERC20 Contracts Programmatically**
```typescript
import { addContractToChain } from './config';

const newERC20Contract = {
  address: "0x1234...",
  name: "New Token",
  type: "erc20", // ABI loaded automatically
  startBlock: 19000000,
  events: ["Transfer", "Approval"]
};

addContractToChain("ethereum", newERC20Contract);
```

### **Contract Configuration Interface**
```typescript
interface ContractConfig {
  address: string;    // Contract address (checksummed)
  name: string;       // Human-readable name
  type: 'erc20';      // Contract type (determines ABI)
  startBlock?: number; // Block to start watching from
  events: string[];   // Event names to monitor
}
```

## 📊 **ABI Loader System**

### **How It Works**
1. Contract type specified in configuration
2. ABI automatically loaded from `/abi/{type}.json`
3. Contract interface created using loaded ABI
4. Events parsed using the interface

### **ABI Loader Service**
```typescript
import { AbiLoader } from './src/services/abiLoader';

// Load ABI for contract type
const abi = AbiLoader.loadAbi('erc20');

// Get available contract types
const types = AbiLoader.getAvailableTypes();

// Get events from ABI
const events = AbiLoader.getEventsFromAbi('erc20');
```

## 🎯 **ERC20 Token Support**

### **Standard ERC20 Events**
- **Transfer**: Token transfers between addresses
- **Approval**: Token spending approvals

### **Example ERC20 Configuration**
```typescript
{
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
  name: "Tether USD",
  type: "erc20",
  startBlock: 15000000,
  events: ["Transfer", "Approval"]
}
```

### **Popular ERC20 Tokens Pre-configured**
- **Ethereum**: USDC, USDT examples
- **Avalanche**: USDC.e example
- **Polygon**: USDC example
- **BSC**: USDT example

## 📊 **System Flow**

```
1. Load Configuration from config.ts
    ↓
2. Initialize ABI Loader
    ↓
3. Load ABIs for contract types
    ↓
4. Initialize Database (MongoDB)
    ↓
5. Start Watcher Manager
    ↓
6. For each configured chain:
    ↓
7. Start Block Watcher
    ↓
8. Monitor new blocks
    ↓
9. Process ERC20 contract events
    ↓
10. Parse events using loaded ABIs
    ↓
11. Save events to database
    ↓
12. Trigger event handlers
```

## 🎯 **Key Features**

- **🎯 Centralized Config**: Everything in one `config.ts` file
- **📄 ABI Management**: Automatic ABI loading by contract type
- **🪙 ERC20 Focus**: Specialized for ERC20 token monitoring
- **🔗 Multi-Chain**: Support for Ethereum, Avalanche, Polygon, BSC, Arbitrum, Optimism
- **📦 Contract Management**: Easy add/remove contracts
- **🔄 Memory Tracking**: Block progress kept in memory for fast restarts
- **📊 Event Persistence**: All events saved to MongoDB
- **🛡️ Error Handling**: Retry mechanism with configurable limits
- **📝 Logging**: Comprehensive logging with Winston

## 🔄 **Event Handling**

### **ERC20 Event Handlers**
```typescript
import { EventHandlerService } from './src/services/eventHandler';

const eventHandler = new EventHandlerService();

// Transfer event handler
eventHandler.registerHandler("Transfer", async (event) => {
  const { from, to, value } = event.parsedArgs;
  console.log(`Transfer: ${from} → ${to}: ${value}`);
  // Your custom logic here
});

// Approval event handler
eventHandler.registerHandler("Approval", async (event) => {
  const { owner, spender, value } = event.parsedArgs;
  console.log(`Approval: ${owner} approved ${spender} for ${value}`);
  // Your custom logic here
});
```

## 📊 **Database Schema**

### **Events Collection**
```typescript
interface WatchedEvent {
  id: string;              // Unique event ID
  chainId: string;         // Chain identifier
  contractAddress: string; // ERC20 contract address
  contractName: string;    // Token name
  blockNumber: number;     // Block number
  blockHash: string;       // Block hash
  transactionHash: string; // Transaction hash
  logIndex: number;        // Log index in block
  eventName: string;       // "Transfer" or "Approval"
  eventSignature: string;  // Event signature
  eventData: any;          // Raw event data
  parsedArgs: any;         // Parsed event arguments
  timestamp: Date;         // Block timestamp
  processed: boolean;      // Processing status
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update timestamp
}
```

## 🚀 **Usage Examples**

### **Basic Usage**
```typescript
import { EVMWatcher } from './src/index';

const watcher = new EVMWatcher();
await watcher.start();

// Check status
const status = watcher.getStatus();
console.log(status);

// Check health
const health = await watcher.getHealth();
console.log(health);
```

### **Adding ERC20 Contracts at Runtime**
```typescript
const erc20Contract = {
  address: "0x1234...",
  name: "Runtime Token",
  type: "erc20", // ABI loaded automatically
  startBlock: undefined, // Start from current
  events: ["Transfer", "Approval"]
};

await watcher.addContract("ethereum", erc20Contract);
```

## 📝 **Environment Variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `evm_watcher` | Database name |
| `POLL_INTERVAL` | `1000` | Block polling interval (ms) |
| `MAX_RETRIES` | `5` | Max retries per block |
| `RETRY_DELAY` | `5000` | Delay between retries (ms) |
| `BATCH_SIZE` | `10` | Events per batch |
| `ETHEREUM_RPC_URL` | `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY` | Ethereum RPC endpoint |
| `AVALANCHE_RPC_URL` | `https://api.avax.network/ext/bc/C/rpc` | Avalanche RPC endpoint |

## 🔧 **Development**

### **Build**
```bash
npm run build
```

### **Development Mode**
```bash
npm run dev
```

### **Production**
```bash
npm start
```

## 📚 **File Structure**

```
evm/watcher/
├── config.ts                    # 🎯 ALL CONFIGURATION HERE
├── abi/                         # 📄 CONTRACT ABI FILES
│   └── erc20.json              # ERC20 token ABI
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
├── src/
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── services/
│   │   ├── abiLoader.ts        # ABI management service
│   │   ├── database.ts         # MongoDB operations
│   │   ├── eventHandler.ts     # Event processing
│   │   ├── blockWatcher.ts     # Block monitoring
│   │   └── watcherManager.ts   # Multi-chain coordination
│   ├── utils/
│   │   └── logger.ts           # Logging utility
│   ├── examples/
│   │   └── addContract.ts      # Usage examples
│   └── index.ts                # Main entry point
└── dist/                        # Compiled output
```

## 🎯 **Configuration Philosophy**

**Everything in one place!** The `config.ts` file is your single source of truth for:

- ✅ Database settings
- ✅ Watcher behavior
- ✅ RPC endpoints
- ✅ ERC20 contract definitions
- ✅ Chain configurations
- ✅ Helper functions

**ABI management is automatic** - just specify the contract type!

## 🚀 **Ready to Use!**

The system is now fully centralized and ready to monitor ERC20 tokens. Just:

1. **Edit `config.ts`** with your ERC20 contracts
2. **Set environment variables** (optional)
3. **Run `npm start`**

Your watcher will automatically monitor all configured ERC20 tokens across multiple chains! 🎉

## 🔮 **Future Enhancements**

- Support for more contract types (ERC721, DEX, Bridge, etc.)
- Dynamic ABI loading from blockchain
- Event filtering and aggregation
- Real-time notifications
- Dashboard UI
