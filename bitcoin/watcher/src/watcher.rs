use crate::store::{BitcoinStore, BitcoinHtlcParams, HtlcStatus, BitcoinConfig, BitcoinNetwork};
use primitives::types::Swap;
use crate::events::{BitcoinEvent, EventHandler, BitcoinEventHandler};
use primitives::indexer::SimpleIndexer;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use tokio::time::{sleep, Duration};
use log::{debug, error, info};
use sha2::{Sha256, Digest};
use hex;
use reqwest;

pub struct BitcoinWatcher {
    store: BitcoinStore,
    event_handler: BitcoinEventHandler,
    indexer: SimpleIndexer,
    watched_addresses: HashMap<String, u64>, // address -> last_balance
    init_watched_addresses: HashMap<String, bool>, // address -> whether we're watching for init
}

impl BitcoinWatcher {
    pub fn new(store: BitcoinStore) -> Result<Self> {
        let event_handler = BitcoinEventHandler::new(store.clone());
        let config = store.get_config();
        let indexer = SimpleIndexer::new(&config.indexer_url)?;
        
        Ok(Self {
            store,
            event_handler,
            indexer,
            watched_addresses: HashMap::new(),
            init_watched_addresses: HashMap::new(),
        })
    }

    pub async fn start(&mut self, polling_interval: u32) -> Result<()> {
        info!("Starting Bitcoin watcher with {} second polling interval...", polling_interval);
        
        loop {
            if let Err(e) = self.watch_cycle().await {
                error!("Error in watch cycle: {}", e);
            }
            
            // Wait before next cycle
            sleep(Duration::from_secs(polling_interval as u64)).await;
        }
    }

    async fn watch_cycle(&mut self) -> Result<()> {
        // Clean up expired HTLCs
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        self.store.cleanup_expired_htlcs(current_time).await?;

        // Get swaps from database (similar to the Go code you provided)
        let swaps = self.get_active_swaps().await?;
        debug!("Swaps: {:?}", swaps);
        // Watch HTLC addresses for each swap
        for swap in swaps {
            self.watch_swap_htlc(&swap).await?;
        }

        Ok(())
    }

    async fn get_active_swaps(&self) -> Result<Vec<Swap>> {
        self.store.get_active_swaps().await
    }

    async fn watch_swap_htlc(&mut self, swap: &Swap) -> Result<()> {
        // Use the swap_id as the taproot script address
        let htlc_address = &swap.swap_id;
        info!("HTLC address (swap_id): {}", htlc_address);
        // Get UTXOs for this HTLC address using SimpleIndexer
        let utxos = self.indexer.get_utxos(htlc_address).await.unwrap();
        info!("UTXOs for {}: {:?}", htlc_address, utxos);
        
        // Get transaction count for this address
        let tx_count = self.indexer.get_address_transaction_count(htlc_address).await?;
        info!("Transaction count for {}: {}", htlc_address, tx_count);
        
        // Calculate total balance from UTXOs
        let current_balance: u64 = utxos.iter().map(|utxo| utxo.value).sum();
        
        // Check if we're already watching this address for init
        let is_watching_init = self.init_watched_addresses.get(htlc_address).unwrap_or(&false);
        
        if utxos.is_empty() {
            if tx_count == 0 {
                // No UTXOs and no transactions - check if we need to start watching for init
                if !*is_watching_init {
                    info!("Starting to watch {} for init", htlc_address);
                    self.init_watched_addresses.insert(htlc_address.clone(), true);
                }
            } else if tx_count == 2 {
                // No UTXOs but 2 transactions - HTLC is fulfilled (funded + spent)
                info!("HTLC fulfilled: {} has no UTXOs but 2 transactions", htlc_address);
                
                // Get the spending transaction to determine if it's claim or refund
                if let Some(spending_tx) = self.get_spending_transaction(htlc_address).await? {
                    let tx_details = self.get_transaction_details(&spending_tx).await?;
                    if let Some(preimage) = self.analyze_spending_transaction(&spending_tx, &swap.secret_hash).await? {
                        // This is a redeem - preimage was found and matches hashlock
                        let event = BitcoinEvent::HtlcClaimed {
                            id: swap.swap_id.clone(),
                            tx_hash: spending_tx,
                            preimage,
                            block_height: tx_details.unwrap().block_height.unwrap(),
                        };
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC claimed: {} with preimage", swap.swap_id);
                    } else {
                        // This is a refund - no preimage found or doesn't match hashlock
                        let event = BitcoinEvent::HtlcRefunded {
                            id: swap.swap_id.clone(),
                            tx_hash: spending_tx,
                            block_height: tx_details.unwrap().block_height.unwrap(),
                        };
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC refunded: {}", swap.swap_id);
                    }
                }
                
                // Mark as no longer watching for init
                self.init_watched_addresses.insert(htlc_address.clone(), false);
            } else {
                // No UTXOs but some other transaction count - log for debugging
                info!("Address {} has no UTXOs but {} transactions", htlc_address, tx_count);
            }
        } else {
            // Has UTXOs - check if this is the first funding transaction
            if let Some(previous_balance) = self.watched_addresses.get(htlc_address) {
                if current_balance > *previous_balance {
                    // Balance increased - this is the init event
                    let increase = current_balance - *previous_balance;
                    
                    // Find the funding transaction
                    if let Some(funding_utxo) = utxos.iter().find(|utxo| utxo.value == increase) {
                        // Get transaction details for block information
                        let tx_details = self.get_transaction_details(&funding_utxo.txid).await?;
                        let confirmations = if funding_utxo.status.confirmed { 1 } else { 0 };
                        
                        let event = BitcoinEvent::HtlcFunded {
                            id: swap.swap_id.clone(),
                            tx_hash: funding_utxo.txid.clone(),
                            amount_sats: increase,
                            confirmations,
                            block_height: tx_details.unwrap().block_height.unwrap(),
                        };
                        
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC funded: {} with {} sats (tx: {})", swap.swap_id, increase, funding_utxo.txid);
                    }
                }
            } else {
                // First time seeing this address with UTXOs - this is the init event
                if let Some(funding_utxo) = utxos.first() {
                    // Get transaction details for block information
                    let tx_details = self.get_transaction_details(&funding_utxo.txid).await?;
                    let confirmations = if funding_utxo.status.confirmed { 1 } else { 0 };
                    
                    let event = BitcoinEvent::HtlcFunded {
                        id: swap.swap_id.clone(),
                        tx_hash: funding_utxo.txid.clone(),
                        amount_sats: funding_utxo.value,
                        confirmations,
                        block_height: tx_details.unwrap().block_height.unwrap(),
                    };
                    
                    self.event_handler.handle_event(event).await?;
                    info!("HTLC funded: {} with {} sats (tx: {})", swap.swap_id, funding_utxo.value, funding_utxo.txid);
                }
            }
            
            // Mark as no longer watching for init
            self.init_watched_addresses.insert(htlc_address.clone(), false);
        }
        
        // Update watched balance
        self.watched_addresses.insert(htlc_address.clone(), current_balance);
        
        Ok(())
    }



    async fn analyze_spending_transaction(&self, tx_hash: &str, hashlock: &str) -> Result<Option<String>> {
        // Get transaction details from the indexer
        let config = self.store.get_config();
        let url = format!("{}/tx/{}", config.indexer_url, tx_hash);
        
        // Use reqwest to get transaction data
        let client = reqwest::Client::new();
        let response = client.get(&url).send().await?;
        
        if !response.status().is_success() {
            error!("Failed to get transaction {}: {}", tx_hash, response.status());
            return Ok(None);
        }
        
        let tx_data: serde_json::Value = response.json().await?;
        
        // Extract witness data from the transaction
        if let Some(vin) = tx_data["vin"].as_array() {
            for input in vin {
                if let Some(witness) = input["witness"].as_array() {
                    // Witness stack should have at least 4 elements for HTLC:
                    // [signature, preimage, script, control_block]
                    if witness.len() >= 4 {
                        // The preimage should be in the second position (index 1)
                        if let Some(preimage_hex) = witness[1].as_str() {
                            // Decode the preimage from hex
                            if let Ok(preimage_bytes) = hex::decode(preimage_hex) {
                                // Hash the preimage and compare with hashlock
                                let hashed_preimage = self.hash_secret(&preimage_bytes);
                                
                                if hashed_preimage == hashlock {
                                    // This is a redeem - return the preimage
                                    info!("Found matching preimage for hashlock: {}", hashlock);
                                    return Ok(Some(preimage_hex.to_string()));
                                } else {
                                    info!("Preimage hash {} doesn't match hashlock {}", hashed_preimage, hashlock);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // No matching preimage found - this is likely a refund
        info!("No matching preimage found for hashlock: {}", hashlock);
        Ok(None)
    }

    fn hash_secret(&self, secret: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(secret);
        let result = hasher.finalize();
        hex::encode(result)
    }





    async fn get_spending_transaction(&self, address: &str) -> Result<Option<String>> {
        // Get recent transactions for this address to find the spending transaction
        let config = self.store.get_config();
        let url = format!("{}/address/{}/txs", config.indexer_url, address);
        
        let client = reqwest::Client::new();
        let response = client.get(&url).send().await?;
        
        if response.status().is_success() {
            let transactions: Vec<serde_json::Value> = response.json().await?;
            
            // Look for the most recent transaction (spending transaction)
            if let Some(latest_tx) = transactions.first() {
                if let Some(txid) = latest_tx["txid"].as_str() {
                    return Ok(Some(txid.to_string()));
                }
            }
        }
        
        Ok(None)
    }

    async fn get_transaction_details(&self, tx_hash: &str) -> Result<Option<TransactionDetails>> {
        // Get transaction details from the indexer
        let config = self.store.get_config();
        let url = format!("{}/tx/{}", config.indexer_url, tx_hash);
        
        let client = reqwest::Client::new();
        let response = client.get(&url).send().await?;
        
        if !response.status().is_success() {
            error!("Failed to get transaction {}: {}", tx_hash, response.status());
            return Ok(None);
        }
        
        let tx_data: serde_json::Value = response.json().await?;
        
        // Extract transaction details
        let block_height = tx_data["status"]["block_height"].as_u64();
        let confirmations = tx_data["status"]["confirmed"].as_bool().unwrap_or(false);
        
        Ok(Some(TransactionDetails {
            tx_hash: tx_hash.to_string(),
            block_height,
            confirmations,
        }))
    }
}

#[derive(Debug, Clone)]
struct TransactionDetails {
    tx_hash: String,
    block_height: Option<u64>,
    confirmations: bool,
}

// Helper function to create a Bitcoin watcher with default configuration
pub fn create_bitcoin_watcher(network: BitcoinNetwork, indexer_url: String) -> Result<BitcoinWatcher> {
    let config = BitcoinConfig {
        network,
        indexer_url,
        mongodb_uri: "mongodb://localhost:27017".to_string(),
        database_name: "bitcoin".to_string(),
    };
    
    let store = BitcoinStore::new(config);
    BitcoinWatcher::new(store)
}
