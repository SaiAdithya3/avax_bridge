# Orderbook Server

A simple Rust server built with Axum that includes MongoDB integration.

## Features

- **Health Check**: `/health` endpoint returns "Online"
- **MongoDB Integration**: Automatic connection setup with handler state
- **Schema Migration**: Automatic collection and index creation on startup
- **Single Collection Design**: All orders stored in `orders` collection

## Prerequisites

- Rust (latest stable version)
- MongoDB running locally on port 27017

## Setup

1. **Install MongoDB** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install mongodb-community
   brew services start mongodb-community
   
   # Or use Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Install Rust dependencies**:
   ```bash
   cargo build
   ```

## Running the Server

```bash
cargo run
```

The server will start on `http://127.0.0.1:3000`

## API Endpoints

- `GET /health` - Returns "Online" status
- `POST /orders` - Creates a new order (accepts simplified CreateOrder JSON, automatically generates MatchedOrder)

## Create Order Format

The `/orders` endpoint accepts a simplified JSON format:

```json
{
  "from": "bitcoin_testnet:btc",
  "to": "avalanche_testnet:avax", 
  "source_amount": "0.001",
  "destination_amount": "0.1",
  "initiator_source_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "initiator_destination_address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "secret_hash": "a1b2c3d4e5f6789012345678901234567890abcdef",
  "bitcoin_optional_recipient": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

### Field Descriptions:
- `from`: Source chain and asset in format `"chain:asset"` (e.g., `"bitcoin_testnet:btc"`)
- `to`: Destination chain and asset in format `"chain:asset"` (e.g., `"avalanche_testnet:avax"`)
- `source_amount`: Amount to swap from source chain
- `destination_amount`: Amount to receive on destination chain
- `initiator_source_address`: User's address on source chain
- `initiator_destination_address`: User's address on destination chain
- `secret_hash`: Hash of the secret for the atomic swap
- `bitcoin_optional_recipient`: Optional Bitcoin recipient address

**Note:** The `create_id` is automatically generated as a random 32-byte hex string by the server and does not need to be provided by the user.

## API Response Format

All API endpoints (except `/health`) follow this standardized response format:

```typescript
interface Response<T> {
    status: "ok" | "error";
    result?: T;
    error?: string;
}
```

### Success Response Example:
```json
{
  "status": "ok",
  "result": {
    "create_id": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
  }
}
```

### Error Response Example:
```json
{
  "status": "error",
  "error": "Failed to get matched order: Invalid source chain"
}
```

## MongoDB Configuration

The server connects to MongoDB at `mongodb://localhost:27017` and uses the database named `avax_bridge`.

To change the MongoDB connection string or database name, modify the `setup_mongodb()` function in `src/main.rs`.

## Project Structure

- `src/main.rs` - Main server code with MongoDB setup
- `Cargo.toml` - Dependencies including Axum and MongoDB
- Handler state (`AppState`) provides MongoDB connection to all handlers