use primitives::types::MatchedOrder;
use primitives::types::Swap;
use primitives::types::Chain;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;
use std::clone::Clone;
use mongodb::{Client, Collection, Database};
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
    pub async fn new(config: BitcoinConfig) -> Result<Self> {
        let client = Client::with_uri_str(&config.mongodb_uri).await?;
        let db = client.database(&config.database_name);
        
        Ok(Self {
            htlc_params: Arc::new(RwLock::new(HashMap::new())),
            config,
            db: Some(db),
        })
    }



    fn get_swaps_collection(&self) -> Result<Collection<MatchedOrder>> {
        if let Some(db) = &self.db {
            Ok(db.collection::<MatchedOrder>("orders"))
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
        match self.get_swaps_collection() {
            Ok(collection) => {
            // testing number of matched orders we receive
            let count = collection.count_documents(doc! {}).await?;
            tracing::info!("Number of matched orders: {}", count);

            // Query for MatchedOrder documents where either source_swap or destination_swap is Bitcoin
            // Pick up swaps that have no inits OR have inits but no redeems/refunds
            let filter = doc! {
                "$or": [
                    {
                        "source_swap.chain": "bitcoin_testnet",
                        "source_swap.asset": "btc",
                        "$and": [
                            {
                                "$or": [
                                    { "source_swap.redeem_block_number": { "$exists": false } },
                                    { "source_swap.redeem_block_number": null }
                                ]
                            },
                            {
                                "$or": [
                                    { "source_swap.refund_block_number": { "$exists": false } },
                                    { "source_swap.refund_block_number": null }
                                ]
                            }
                        ]
                    },
                    {
                        "destination_swap.chain": "bitcoin_testnet",
                        "destination_swap.asset": "btc",
                        "$and": [
                            {
                                "$or": [
                                    { "destination_swap.redeem_block_number": { "$exists": false } },
                                    { "destination_swap.redeem_block_number": null }
                                ]
                            },
                            {
                                "$or": [
                                    { "destination_swap.refund_block_number": { "$exists": false } },
                                    { "destination_swap.refund_block_number": null }
                                ]
                            }
                        ]
                    }
                ]
            };
            
            let mut cursor = collection.find(filter).await?;
            let mut swaps = Vec::new();
            
            while let Some(matched_order) = cursor.next().await {
                let matched_order = matched_order?;
                // Check if source_swap is Bitcoin
                if matches!(matched_order.source_swap.chain, Chain::BitcoinTestnet) {
                    swaps.push(matched_order.source_swap);
                }
                
                // Check if destination_swap is Bitcoin
                if matches!(matched_order.destination_swap.chain, Chain::BitcoinTestnet) {
                    swaps.push(matched_order.destination_swap);
                }
            }
            
            log::info!("Found {} active Bitcoin swaps from MongoDB", swaps.len());
            return Ok(swaps);
            }
            Err(e) => {
                log::warn!("Error getting active swaps: {}", e);
                return Err(e);
            }
        }
    }

    pub async fn update_swap_initiate(&self, swap_id: &str, initiate_tx_hash: &str, filled_amount: &str, initiate_block_number: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            // Find the MatchedOrder document that contains this swap_id
            let filter = doc! {
                "$or": [
                    { "source_swap.swap_id": swap_id },
                    { "destination_swap.swap_id": swap_id }
                ]
            };
            
            // First, find the document to determine which swap to update
            if let Some(matched_order) = collection.find_one(filter.clone()).await? {
                let update = if matched_order.source_swap.swap_id == swap_id {
                    doc! {
                        "$set": {
                            "source_swap.initiate_tx_hash": initiate_tx_hash,
                            "source_swap.filled_amount": filled_amount,
                            "source_swap.initiate_block_number": initiate_block_number
                        }
                    }
                } else {
                    doc! {
                        "$set": {
                            "destination_swap.initiate_tx_hash": initiate_tx_hash,
                            "destination_swap.filled_amount": filled_amount,
                            "destination_swap.initiate_block_number": initiate_block_number
                        }
                    }
                };
                
                let result = collection.update_one(filter, update).await?;
                log::info!("Updated swap {} initiate in MongoDB: {} documents modified", swap_id, result.modified_count);
            } else {
                log::warn!("No MatchedOrder found for swap_id: {}", swap_id);
            }
        } else {
            log::info!("Updated swap {} initiate: tx_hash={}, amount={}, block={}", 
                swap_id, initiate_tx_hash, filled_amount, initiate_block_number);
        }
        Ok(())
    }

    pub async fn update_swap_redeem(&self, swap_id: &str, redeem_tx_hash: &str, redeem_block_number: &str, secret: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            // Find the MatchedOrder document that contains this swap_id
            let filter = doc! {
                "$or": [
                    { "source_swap.swap_id": swap_id },
                    { "destination_swap.swap_id": swap_id }
                ]
            };
            
            // First, find the document to determine which swap to update
            if let Some(matched_order) = collection.find_one(filter.clone()).await? {
                let update = if matched_order.source_swap.swap_id == swap_id {
                    doc! {
                        "$set": {
                            "source_swap.redeem_tx_hash": redeem_tx_hash,
                            "source_swap.redeem_block_number": redeem_block_number,
                            "source_swap.secret": secret
                        }
                    }
                } else {
                    doc! {
                        "$set": {
                            "destination_swap.redeem_tx_hash": redeem_tx_hash,
                            "destination_swap.redeem_block_number": redeem_block_number,
                            "destination_swap.secret": secret
                        }
                    }
                };
                
                let result = collection.update_one(filter, update).await?;
                log::info!("Updated swap {} redeem in MongoDB: {} documents modified", swap_id, result.modified_count);
            } else {
                log::warn!("No MatchedOrder found for swap_id: {}", swap_id);
            }
        } else {
            log::info!("Updated swap {} redeem: tx_hash={}, block={}, secret={}", 
                swap_id, redeem_tx_hash, redeem_block_number, secret);
        }
        Ok(())
    }

    pub async fn update_swap_refund(&self, swap_id: &str, refund_tx_hash: &str, refund_block_number: &str) -> Result<()> {
        if let Ok(collection) = self.get_swaps_collection() {
            // Find the MatchedOrder document that contains this swap_id
            let filter = doc! {
                "$or": [
                    { "source_swap.swap_id": swap_id },
                    { "destination_swap.swap_id": swap_id }
                ]
            };
            
            // First, find the document to determine which swap to update
            if let Some(matched_order) = collection.find_one(filter.clone()).await? {
                let update = if matched_order.source_swap.swap_id == swap_id {
                    doc! {
                        "$set": {
                            "source_swap.refund_tx_hash": refund_tx_hash,
                            "source_swap.refund_block_number": refund_block_number
                        }
                    }
                } else {
                    doc! {
                        "$set": {
                            "destination_swap.refund_tx_hash": refund_tx_hash,
                            "destination_swap.refund_block_number": refund_block_number
                        }
                    }
                };
                
                let result = collection.update_one(filter, update).await?;
                log::info!("Updated swap {} refund in MongoDB: {} documents modified", swap_id, result.modified_count);
            } else {
                log::warn!("No MatchedOrder found for swap_id: {}", swap_id);
            }
        } else {
            log::info!("Updated swap {} refund: tx_hash={}, block={}", 
                swap_id, refund_tx_hash, refund_block_number);
        }
        Ok(())
    }
}
