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
- `POST /orders` - Creates a new order (accepts MatchedOrder JSON)

## MongoDB Configuration

The server connects to MongoDB at `mongodb://localhost:27017` and uses the database named `avax_bridge`.

To change the MongoDB connection string or database name, modify the `setup_mongodb()` function in `src/main.rs`.

## Project Structure

- `src/main.rs` - Main server code with MongoDB setup
- `Cargo.toml` - Dependencies including Axum and MongoDB
- Handler state (`AppState`) provides MongoDB connection to all handlers