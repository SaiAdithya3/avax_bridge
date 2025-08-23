use crate::store::{BitcoinStore, BitcoinHtlcParams, HtlcStatus, BitcoinConfig, BitcoinNetwork, Order};
use crate::events::{BitcoinEvent, EventHandler, BitcoinEventHandler};
use bitcoin::Network;
use primitives::htlc::BitcoinHTLC;
use primitives::indexer::SimpleIndexer;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use tokio::time::{sleep, Duration};
use log::{info, error};
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

        // Get orders from database (similar to the Go code you provided)
        let orders = self.get_active_orders().await?;
        
        // Watch HTLC addresses for each order
        for order in orders {
            self.watch_order_htlc(&order).await?;
        }

        // Get all pending and funded HTLCs from local store
        let pending_htlcs = self.store.get_all_pending_htlcs().await?;
        let funded_htlcs = self.store.get_all_funded_htlcs().await?;

        // Watch addresses for pending HTLCs
        for (id, params) in pending_htlcs {
            self.watch_htlc_address(&id, &params).await?;
        }

        // Monitor funded HTLCs for claims/refunds
        for (id, params) in funded_htlcs {
            self.monitor_funded_htlc(&id, &params).await?;
        }

        Ok(())
    }

    async fn get_active_orders(&self) -> Result<Vec<Order>> {
        self.store.get_active_orders().await
    }

    async fn watch_order_htlc(&mut self, order: &Order) -> Result<()> {
        // Create HTLC address for the order
        let htlc_address = self.create_htlc_address(
            &order.recipient_pubkey,
            &order.refund_pubkey,
            &order.hashlock,
            order.timelock,
        ).await?;

        // Get UTXOs for this HTLC address using SimpleIndexer
        let utxos = self.indexer.get_utxos(&htlc_address).await?;
        info!("UTXOs for {}: {:?}", htlc_address, utxos);
        
        // Get transaction count for this address
        let tx_count = self.indexer.get_address_transaction_count(&htlc_address).await?;
        info!("Transaction count for {}: {}", htlc_address, tx_count);
        
        // Calculate total balance from UTXOs
        let current_balance: u64 = utxos.iter().map(|utxo| utxo.value).sum();
        
        // Check if we're already watching this address for init
        let is_watching_init = self.init_watched_addresses.get(&htlc_address).unwrap_or(&false);
        
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
                if let Some(spending_tx) = self.get_spending_transaction(&htlc_address).await? {
                    if let Some(preimage) = self.analyze_spending_transaction(&spending_tx, &order.hashlock).await? {
                        // This is a redeem - preimage was found and matches hashlock
                        let event = BitcoinEvent::HtlcClaimed {
                            id: order.id.clone(),
                            tx_hash: spending_tx,
                            preimage,
                        };
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC claimed: {} with preimage", order.id);
                    } else {
                        // This is a refund - no preimage found or doesn't match hashlock
                        let event = BitcoinEvent::HtlcRefunded {
                            id: order.id.clone(),
                            tx_hash: spending_tx,
                        };
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC refunded: {}", order.id);
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
            if let Some(previous_balance) = self.watched_addresses.get(&htlc_address) {
                if current_balance > *previous_balance {
                    // Balance increased - this is the init event
                    let increase = current_balance - *previous_balance;
                    
                    // Find the funding transaction
                    if let Some(funding_utxo) = utxos.iter().find(|utxo| utxo.value == increase) {
                        // Get transaction details for block information
                        let tx_details = self.get_transaction_details(&funding_utxo.txid).await?;
                        let confirmations = if funding_utxo.status.confirmed { 1 } else { 0 };
                        
                        let event = BitcoinEvent::HtlcFunded {
                            id: order.id.clone(),
                            tx_hash: funding_utxo.txid.clone(),
                            amount_sats: increase,
                            confirmations,
                        };
                        
                        self.event_handler.handle_event(event).await?;
                        info!("HTLC funded: {} with {} sats (tx: {})", order.id, increase, funding_utxo.txid);
                    }
                }
            } else {
                // First time seeing this address with UTXOs - this is the init event
                if let Some(funding_utxo) = utxos.first() {
                    // Get transaction details for block information
                    let tx_details = self.get_transaction_details(&funding_utxo.txid).await?;
                    let confirmations = if funding_utxo.status.confirmed { 1 } else { 0 };
                    
                    let event = BitcoinEvent::HtlcFunded {
                        id: order.id.clone(),
                        tx_hash: funding_utxo.txid.clone(),
                        amount_sats: funding_utxo.value,
                        confirmations,
                    };
                    
                    self.event_handler.handle_event(event).await?;
                    info!("HTLC funded: {} with {} sats (tx: {})", order.id, funding_utxo.value, funding_utxo.txid);
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

    async fn create_htlc_address(
        &self,
        recipient_pubkey: &str,
        refund_pubkey: &str,
        hashlock: &str,
        timelock: u32,
    ) -> Result<String> {
        let config = self.store.get_config();
        let network = match config.network {
            BitcoinNetwork::Mainnet => Network::Bitcoin,
            BitcoinNetwork::Testnet => Network::Testnet,
            BitcoinNetwork::Regtest => Network::Regtest,
        };

        // Create BitcoinHTLC using primitives
        let htlc = BitcoinHTLC::new(
            hashlock.to_string(),
            refund_pubkey.to_string(), // initiator (refund) pubkey
            recipient_pubkey.to_string(), // redeemer pubkey
            timelock as i64,
            network,
        )?;

        // Generate the address
        let address = htlc.address()?;
        
        info!("Created HTLC address: {} for timelock: {}", address, timelock);
        Ok(address.to_string())
    }

    async fn watch_htlc_address(&mut self, id: &str, params: &BitcoinHtlcParams) -> Result<()> {
        let address = &params.address;
        
        // Get current UTXOs from indexer
        let utxos = self.indexer.get_utxos(address).await?;
        let current_balance: u64 = utxos.iter().map(|utxo| utxo.value).sum();
        
        // Check if we have a previous balance for this address
        if let Some(previous_balance) = self.watched_addresses.get(address) {
            if current_balance > *previous_balance {
                // Balance increased - HTLC was funded
                let increase = current_balance - *previous_balance;
                
                // Find the funding transaction
                if let Some(funding_utxo) = utxos.iter().find(|utxo| utxo.value == increase) {
                    // Get transaction details for block information
                    let tx_details = self.get_transaction_details(&funding_utxo.txid).await?;
                    let confirmations = if funding_utxo.status.confirmed { 1 } else { 0 };
                    
                    let event = BitcoinEvent::HtlcFunded {
                        id: id.to_string(),
                        tx_hash: funding_utxo.txid.clone(),
                        amount_sats: increase,
                        confirmations,
                    };
                    
                    self.event_handler.handle_event(event).await?;
                    info!("HTLC funded: {} with {} sats (tx: {})", id, increase, funding_utxo.txid);
                }
            }
        }
        
        // Update watched balance
        self.watched_addresses.insert(address.clone(), current_balance);
        
        Ok(())
    }

    async fn monitor_funded_htlc(&mut self, id: &str, params: &BitcoinHtlcParams) -> Result<()> {
        let address = &params.address;
        
        // Get current UTXOs for this address
        let utxos = self.indexer.get_utxos(address).await?;
        
        // If there are no UTXOs, the HTLC has been spent
        if utxos.is_empty() {
            // Get the spending transaction to determine if it's claim or refund
            if let Some(spending_tx) = self.get_spending_transaction(address).await? {
                if let Some(preimage) = self.analyze_spending_transaction(&spending_tx, &params.hashlock).await? {
                    // This is a redeem - preimage was found and matches hashlock
                    let event = BitcoinEvent::HtlcClaimed {
                        id: id.to_string(),
                        tx_hash: spending_tx,
                        preimage,
                    };
                    self.event_handler.handle_event(event).await?;
                    info!("HTLC claimed: {} with preimage", id);
                } else {
                    // This is a refund - no preimage found or doesn't match hashlock
                    let event = BitcoinEvent::HtlcRefunded {
                        id: id.to_string(),
                        tx_hash: spending_tx,
                    };
                    self.event_handler.handle_event(event).await?;
                    info!("HTLC refunded: {}", id);
                }
            }
        }
        
        Ok(())
    }

    pub async fn add_htlc_to_watch(
        &self,
        id: String,
        recipient_pubkey: &str,
        refund_pubkey: &str,
        hashlock: &str,
        timelock: u32,
        amount_sats: u64,
        refund_address: &str,
    ) -> Result<String> {
        // Create HTLC address
        let htlc_address = self.create_htlc_address(
            recipient_pubkey,
            refund_pubkey,
            hashlock,
            timelock,
        ).await?;

        // Create HTLC parameters
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        
        let params = BitcoinHtlcParams {
            address: htlc_address.clone(),
            amount_sats,
            timelock,
            hashlock: hashlock.to_string(),
            refund_address: refund_address.to_string(),
            status: HtlcStatus::Pending,
            created_at: current_time,
            expires_at: current_time + timelock as u64,
        };

        // Add to store
        self.store.add_htlc_params(id.clone(), params.clone()).await?;

        // Emit event
        let event = BitcoinEvent::HtlcCreated {
            id,
            params,
        };
        self.event_handler.handle_event(event).await?;

        Ok(htlc_address)
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
        min_confirmations: 6,
        block_time: 600, // 10 minutes
    };
    
    let store = BitcoinStore::new(config);
    BitcoinWatcher::new(store)
}
