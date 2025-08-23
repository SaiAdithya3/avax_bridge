use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use anyhow::{Result, anyhow};
use crate::store::{BitcoinNetwork, BitcoinConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub bitcoin: BitcoinSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinSettings {
    pub network: String,
    pub indexer_url: String,
    pub polling_interval: u32,
    pub log_level: String,
    pub mongodb_uri: String,
    pub database_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtlcSettings {
    pub default_timelock: u32,
    pub default_amount_sats: u64,
    pub example: ExampleHtlc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleHtlc {
    pub id: String,
    pub recipient_pubkey: String,
    pub refund_pubkey: String,
    pub hashlock: String,
    pub refund_address: String,
}

impl Settings {
    pub fn load() -> Result<Self> {
        let config_path = Path::new("Settings.toml");
        
        if !config_path.exists() {
            return Err(anyhow!("Settings.toml not found. Please create it with the required configuration."));
        }

        let config_content = fs::read_to_string(config_path)?;
        let settings: Settings = toml::from_str(&config_content)?;
        
        Ok(settings)
    }

    pub fn load_or_default() -> Self {
        Self::load().unwrap_or_else(|_| {
            log::warn!("Failed to load Settings.toml, using default configuration");
            Self::default()
        })
    }

    pub fn to_bitcoin_config(&self) -> BitcoinConfig {
        let network = match self.bitcoin.network.as_str() {
            "mainnet" => BitcoinNetwork::Mainnet,
            "testnet" => BitcoinNetwork::Testnet,
            "regtest" => BitcoinNetwork::Regtest,
            _ => {
                log::warn!("Unknown network '{}', defaulting to testnet", self.bitcoin.network);
                BitcoinNetwork::Testnet
            }
        };

        BitcoinConfig {
            network,
            indexer_url: self.bitcoin.indexer_url.clone(),
            mongodb_uri: self.bitcoin.mongodb_uri.clone(),
            database_name: self.bitcoin.database_name.clone(),
        }
    }

    pub fn get_polling_interval(&self) -> u32 {
        self.bitcoin.polling_interval
    }

    pub fn get_log_level(&self) -> &str {
        &self.bitcoin.log_level
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            bitcoin: BitcoinSettings {
                network: "testnet".to_string(),
                indexer_url: "https://blockstream.info/testnet/api".to_string(),
                polling_interval: 30,
                log_level: "info".to_string(),
                mongodb_uri: "mongodb://localhost:27017".to_string(),
                database_name: "bitcoin_watcher".to_string(),
            }
        }
    }
}
