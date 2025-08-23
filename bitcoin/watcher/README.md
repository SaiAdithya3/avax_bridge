# Bitcoin HTLC Watcher

A Rust-based Bitcoin HTLC (Hashed Timelock Contract) watcher that monitors HTLC addresses for funding, claims, and refunds using the SimpleIndexer from the primitives crate.

## Features

- **SimpleIndexer Integration**: Uses the SimpleIndexer from the primitives crate to fetch UTXOs and transaction data
- **Database Integration**: Fetches active orders from the database with filtering similar to the Go implementation
- **HTLC Monitoring**: Monitors HTLC addresses for funding, claims, and refunds
- **Event-Driven Architecture**: Emits events for HTLC state changes
- **Configurable**: Supports different Bitcoin networks (mainnet, testnet, regtest)

## Architecture

### Components

1. **BitcoinWatcher**: Main watcher that orchestrates the monitoring process
2. **SimpleIndexer**: Fetches UTXOs and transaction data from Bitcoin indexers
3. **BitcoinStore**: Manages HTLC parameters and order data
4. **BitcoinEventHandler**: Handles HTLC events and updates state

### Database Integration

The watcher integrates with your database to fetch active orders with the following criteria:
- `chain = "bitcoin"`
- `asset = "BTC"`
- `amount > 0`
- `redeem_block_number = 0`
- `refund_block_number = 0`
- `created_at >= (current_time - 7 days)`

This matches the Go implementation pattern you provided.

## Usage

### Configuration

Create a `Settings.toml` file:

```toml
[bitcoin]
# Bitcoin network to use (mainnet, testnet, regtest)
network = "testnet"

# Bitcoin indexer URL
indexer_url = "https://blockstream.info/testnet/api"

# Minimum confirmations required
min_confirmations = 6

# Block time in seconds
block_time = 600

# Watcher polling interval in seconds
polling_interval = 30

# Log level (trace, debug, info, warn, error)
log_level = "info"
```

### Running

```bash
cargo run
```

## Database Integration

To integrate with your actual database, update the `get_active_orders()` method in `src/store.rs`:

```rust
pub async fn get_active_orders(&self) -> Result<Vec<Order>> {
    // Replace this with your actual database query
    // Example SQL:
    // SELECT * FROM orders 
    // WHERE chain = 'bitcoin' 
    //   AND asset = 'BTC' 
    //   AND amount > 0 
    //   AND redeem_block_number = 0 
    //   AND refund_block_number = 0 
    //   AND created_at >= ?
    
    // Your database implementation here
    Ok(Vec::new())
}
```

## Events

The watcher emits the following events:

- `HtlcCreated`: When a new HTLC is created
- `HtlcFunded`: When an HTLC receives funding
- `HtlcClaimed`: When an HTLC is claimed with a preimage
- `HtlcRefunded`: When an HTLC is refunded after timelock
- `HtlcExpired`: When an HTLC expires

## Dependencies

- `primitives`: Contains SimpleIndexer and BitcoinHTLC implementations
- `bitcoin`: Bitcoin protocol implementation
- `tokio`: Async runtime
- `anyhow`: Error handling
- `log`: Logging
- `serde`: Serialization

## Development

### Adding Database Support

1. Add your database driver dependency to `Cargo.toml`
2. Implement the database queries in `src/store.rs`
3. Update the `Order` struct to match your database schema

### Testing

The current implementation includes mock orders for testing. Replace these with actual database integration for production use.

## License

[Add your license here]
