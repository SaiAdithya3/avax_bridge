mod wallet;
mod orders;
mod executor;
mod settings;

use crate::{
    executor::{Executor, OrderToActionMapper},
    orders::OrderbookProvider,
    wallet::HTLCWallet,
    settings::Settings,
};
use bitcoin::{key::Secp256k1, secp256k1::{PublicKey, SecretKey}};
use std::str::FromStr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load settings from Settings.toml
    let settings = Settings::load()?;
    let network = settings.get_network()?;
    tracing_subscriber::fmt::init();
    
    tracing::info!("Starting Bitcoin HTLC Executor...");
    tracing::info!("Indexer: {}", settings.bitcoin.indexer_url);
    tracing::info!("Network: {:?}", network);

    // Generate user addresses from private key if not provided
    let mut user_addresses = settings.wallet.user_addresses;
    if user_addresses.is_empty() {
        let secp = Secp256k1::new();
        let priv_key = SecretKey::from_str(&settings.wallet.private_key).expect("Invalid private key");
        let x_only_key = PublicKey::from_secret_key(&secp, &priv_key).x_only_public_key().0;
        user_addresses.push(x_only_key.to_string());
    }

    tracing::info!("Bitcoin filler public key : {:?}", user_addresses);
    // Initialize orderbook
    let orderbook = OrderbookProvider::from_connection_string(&settings.database.connection_string).await?;
    let orderbook_box = Box::new(orderbook);

    // Initialize wallet
    let wallet = HTLCWallet::new(&settings.wallet.private_key, network, &settings.bitcoin.indexer_url);
    
    // Initialize mapper
    let mapper = OrderToActionMapper::new(wallet, network);

    // Initialize executor
    let executor = Executor::new(orderbook_box, mapper, user_addresses);

    // Start polling
    executor.start_polling().await?;

    Ok(())
}