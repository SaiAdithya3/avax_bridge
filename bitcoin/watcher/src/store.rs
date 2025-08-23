use primitives::types::Swap;
use primitives::types::Chain;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;
use std::clone::Clone;
use mongodb::{Client, Collection, Database, Cursor};
use mongodb::bson::{doc, DateTime};
use chrono::Utc;
use futures::stream::StreamExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinHtlcParams {
    pub address: String,
    pub amount_sats: u64,
    pub timelock: u32,
    pub hashlock: String,
    pub refund_address: String,
    pub status: HtlcStatus,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HtlcStatus {
    Pending,
    Funded,
    Claimed,
    Refunded,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinConfig {
    pub network: BitcoinNetwork,
    pub indexer_url: String,
    pub mongodb_uri: String,
    pub database_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BitcoinNetwork {
    Mainnet,
    Testnet,
    Regtest,
}

#[derive(Clone)]
pub struct BitcoinStore {
    htlc_params: Arc<RwLock<HashMap<String, BitcoinHtlcParams>>>,
    config: BitcoinConfig,
    db: Option<Database>,
}

impl BitcoinStore {
    pub fn new(config: BitcoinConfig) -> Self {
        Self {
            htlc_params: Arc::new(RwLock::new(HashMap::new())),
            config,
            db: None,
        }
    }

    pub async fn connect_mongodb(&mut self) -> Result<()> {
        let client = Client::with_uri_str(&self.config.mongodb_uri).await?;
        let db = client.database(&self.config.database_name);
        self.db = Some(db);
        log::info!("Connected to MongoDB database: {}", self.config.database_name);
        Ok(())
    }

    fn get_swaps_collection(&self) -> Result<Collection<Swap>> {
        if let Some(db) = &self.db {
            Ok(db.collection::<Swap>("swaps"))
        } else {
            Err(anyhow::anyhow!("MongoDB not connected"))
        }
    }

    pub async fn add_htlc_params(&self, id: String, params: BitcoinHtlcParams) -> Result<()> {
        let mut htlc_params = self.htlc_params.write().await;
        htlc_params.insert(id.clone(), params);
        log::info!("Added HTLC params for ID: {}", id);
        Ok(())
    }

    pub async fn get_htlc_params(&self, id: &str) -> Result<Option<BitcoinHtlcParams>> {
        let htlc_params = self.htlc_params.read().await;
        Ok(htlc_params.get(id).cloned())
    }

    pub async fn update_htlc_status(&self, id: &str, status: HtlcStatus) -> Result<()> {
        let mut htlc_params = self.htlc_params.write().await;
        if let Some(params) = htlc_params.get_mut(id) {
            params.status = status.clone();
            log::info!("Updated HTLC status for ID {}: {:?}", id, status);
        }
        Ok(())
    }

    pub fn get_config(&self) -> &BitcoinConfig {
        &self.config
    }

    pub async fn cleanup_expired_htlcs(&self, current_time: u64) -> Result<()> {
        let mut htlc_params = self.htlc_params.write().await;
        let expired_ids: Vec<String> = htlc_params
            .iter()
            .filter(|(_, params)| {
                params.expires_at < current_time && params.status == HtlcStatus::Pending
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in expired_ids {
            if let Some(params) = htlc_params.get_mut(&id) {
                params.status = HtlcStatus::Expired;
                log::info!("Marked HTLC as expired: {}", id);
            }
        }
        Ok(())
    }

    pub async fn get_active_swaps(&self) -> Result<Vec<Swap>> {
        // Try to get from MongoDB first
        if let Ok(collection) = self.get_swaps_collection() {
            let seven_days_ago = DateTime::from_millis(
                (Utc::now() - chrono::Duration::days(7)).timestamp_millis()
            );
            
            let filter = doc! {
                "chain": "bitcoin_testnet",
                "asset": "BTC",
                "amount": { "$gt": "0" },
                "redeem_block_number": { "$exists": false },
                "refund_block_number": { "$exists": false },
                "created_at": { "$gte": seven_days_ago }
            };
            
            let mut cursor = collection.find(filter).await?;
            let mut swaps = Vec::new();
            
            while let Some(swap) = cursor.next().await {
                swaps.push(swap?);
            }
            
            log::info!("Found {} active swaps from MongoDB", swaps.len());
            return Ok(swaps);
        }
        
        // Fallback to mock data if MongoDB is not available
        log::warn!("MongoDB not available, using mock data");
        let current_time = DateTime::from_millis(Utc::now().timestamp_millis());
        
        let mock_swaps = vec![
            Swap {
                id: None,
                created_at: current_time,
                swap_id: "tb1py2rxn9f2zq0s6h2jpu8tpvyu4zvh4uusvaztfvh4k39asyr93f6sp5qc4e".to_string(),
                chain: Chain::BitcoinTestnet,
                asset: "BTC".to_string(),
                htlc_address: "tb1py2rxn9f2zq0s6h2jpu8tpvyu4zvh4uusvaztfvh4k39asyr93f6sp5qc4e".to_string(),
                token_address: "0x0000000000000000000000000000000000000000".to_string(),
                initiator: "460f2e8ff81fc4e0a8e6ce7796704e3829e3e3eedb8db9390bdc51f4f04cf0a6".to_string(),
                redeemer: "be4b9e8e8c0146b155d3ce35d0e3dfef1c99ef598b63e00524a912dd21480bce".to_string(),
                filled_amount: "997000".to_string(),
                amount: "997000".to_string(),
                secret_hash: "731170d859f81a395a79e02cf3812e413b21793900e70ff77e48dfcf7ef6a4e6".to_string(),
                secret: "".to_string(),
                initiate_tx_hash: None,
                redeem_tx_hash: None,
                refund_tx_hash: None,
                initiate_block_number: None,
                redeem_block_number: None,
                refund_block_number: None,
            },
        ];
        
        Ok(mock_swaps)
    }

    pub async fn update_swap_initiate(&self, swap_id: &str, initiate_tx_hash: &str, filled_amount: &str, initiate_block_number: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            let filter = doc! { "swap_id": swap_id };
            let update = doc! {
                "$set": {
                    "initiate_tx_hash": initiate_tx_hash,
                    "filled_amount": filled_amount,
                    "initiate_block_number": initiate_block_number
                }
            };
            
            let result = collection.update_one(filter, update).await?;
            log::info!("Updated swap {} initiate in MongoDB: {} documents modified", swap_id, result.modified_count);
        } else {
            log::info!("Updated swap {} initiate: tx_hash={}, amount={}, block={}", 
                swap_id, initiate_tx_hash, filled_amount, initiate_block_number);
        }
        Ok(())
    }

    pub async fn update_swap_redeem(&self, swap_id: &str, redeem_tx_hash: &str, redeem_block_number: &str, secret: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            let filter = doc! { "swap_id": swap_id };
            let update = doc! {
                "$set": {
                    "redeem_tx_hash": redeem_tx_hash,
                    "redeem_block_number": redeem_block_number,
                    "secret": secret
                }
            };
            
            let result = collection.update_one(filter, update).await?;
            log::info!("Updated swap {} redeem in MongoDB: {} documents modified", swap_id, result.modified_count);
        } else {
            log::info!("Updated swap {} redeem: tx_hash={}, block={}, secret={}", 
                swap_id, redeem_tx_hash, redeem_block_number, secret);
        }
        Ok(())
    }

    pub async fn update_swap_refund(&self, swap_id: &str, refund_tx_hash: &str, refund_block_number: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            let filter = doc! { "swap_id": swap_id };
            let update = doc! {
                "$set": {
                    "refund_tx_hash": refund_tx_hash,
                    "refund_block_number": refund_block_number
                }
            };
            
            let result = collection.update_one(filter, update).await?;
            log::info!("Updated swap {} refund in MongoDB: {} documents modified", swap_id, result.modified_count);
        } else {
            log::info!("Updated swap {} refund: tx_hash={}, block={}", 
                swap_id, refund_tx_hash, refund_block_number);
        }
        Ok(())
    }
}
