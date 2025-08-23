mod store;
mod events;
mod watcher;
mod settings;

use store::BitcoinStore;
use watcher::create_bitcoin_watcher;
use settings::Settings;
use anyhow::Result;
use log::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Load settings
    let settings = Settings::load_or_default();
    tracing_subscriber::fmt::init();
    
    // Initialize logging with configured level
    std::env::set_var("RUST_LOG", settings.get_log_level());
    
    info!("Starting Bitcoin HTLC Watcher...");
    info!("Network: {}", settings.bitcoin.network);
    info!("Indexer: {}", settings.bitcoin.indexer_url);

    // Create Bitcoin configuration from settings
    let config = settings.to_bitcoin_config();

    // Create store and watcher
    let store = match BitcoinStore::new(config).await {
        Ok(store) => {
            log::info!("Successfully connected to MongoDB database: {}", settings.bitcoin.database_name);
            store
        }
        Err(e) => {
            log::warn!("Failed to connect to MongoDB: {}. Will use mock data.", e);
            return Err(e);
        }
    };
    
    let mut watcher = create_bitcoin_watcher(store)?;
    // Start the watcher with configured polling interval
    info!("Starting watcher loop...");
    watcher.start(settings.get_polling_interval()).await?;

    Ok(())
}
