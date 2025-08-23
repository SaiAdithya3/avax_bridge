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
    
    // Initialize logging with configured level
    std::env::set_var("RUST_LOG", settings.get_log_level());
    env_logger::init();
    
    info!("Starting Bitcoin HTLC Watcher...");
    info!("Network: {}", settings.bitcoin.network);
    info!("Indexer: {}", settings.bitcoin.indexer_url);

    // Create Bitcoin configuration from settings
    let config = settings.to_bitcoin_config();

    // Create store and watcher
    let mut store = BitcoinStore::new(config);
    
    // Connect to MongoDB
    if let Err(e) = store.connect_mongodb().await {
        log::warn!("Failed to connect to MongoDB: {}. Will use mock data.", e);
    }
    
    let mut watcher = create_bitcoin_watcher(
        settings.to_bitcoin_config().network,
        settings.bitcoin.indexer_url.clone()
    )?;
    // Start the watcher with configured polling interval
    info!("Starting watcher loop...");
    watcher.start(settings.get_polling_interval()).await?;

    Ok(())
}
