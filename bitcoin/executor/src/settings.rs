use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub database: DatabaseSettings,
    pub bitcoin: BitcoinSettings,
    pub wallet: WalletSettings,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseSettings {
    pub connection_string: String,
    pub database_name: String,
}

#[derive(Debug, Deserialize)]
pub struct BitcoinSettings {
    pub network: String,
    pub indexer_url: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletSettings {
    pub private_key: String,
    pub user_addresses: Vec<String>,
}

impl Settings {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Path::new("Settings.toml");
        
        if !config_path.exists() {
            return Err("Settings.toml file not found".into());
        }

        let contents = fs::read_to_string(config_path)?;
        let settings: Settings = toml::from_str(&contents)?;
        
        Ok(settings)
    }

    pub fn get_network(&self) -> Result<bitcoin::Network, Box<dyn std::error::Error>> {
        match self.bitcoin.network.as_str() {
            "mainnet" => Ok(bitcoin::Network::Bitcoin),
            "testnet" => Ok(bitcoin::Network::Testnet),
            "regtest" => Ok(bitcoin::Network::Regtest),
            "signet" => Ok(bitcoin::Network::Signet),
            _ => Err(format!("Unknown network: {}", self.bitcoin.network).into()),
        }
    }
}
