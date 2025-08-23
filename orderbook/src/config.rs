use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub atomic_swap_address: String,
    pub token_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub executor_address: String,
    pub relay_private_key: String,
    pub rpc_url: String,
    pub registry_address: String,
    pub assets: Vec<Asset>,
    pub source_timelock: i32,
    pub destination_timelock: i32,
    pub chain_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub chains: HashMap<String, ChainConfig>,
}

impl AppConfig {
    pub fn from_file(path: &str) -> Result<Self> {
        let config_content = fs::read_to_string(path)?;
        let config: AppConfig = serde_json::from_str(&config_content)?;
        Ok(config)
    }
}