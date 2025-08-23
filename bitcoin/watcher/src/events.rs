use serde::{Deserialize, Serialize};
use crate::store::{BitcoinHtlcParams, HtlcStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BitcoinEvent {
    HtlcCreated {
        id: String,
        params: BitcoinHtlcParams,
    },
    HtlcFunded {
        id: String,
        tx_hash: String,
        amount_sats: u64,
        confirmations: u32,
    },
    HtlcClaimed {
        id: String,
        tx_hash: String,
        preimage: String,
    },
    HtlcRefunded {
        id: String,
        tx_hash: String,
    },
    HtlcExpired {
        id: String,
    },
    AddressBalanceChanged {
        address: String,
        old_balance: u64,
        new_balance: u64,
        tx_hash: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinTransaction {
    pub tx_hash: String,
    pub block_height: Option<u32>,
    pub confirmations: u32,
    pub inputs: Vec<TxInput>,
    pub outputs: Vec<TxOutput>,
    pub fee: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxInput {
    pub address: String,
    pub amount_sats: u64,
    pub tx_hash: String,
    pub vout: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxOutput {
    pub address: String,
    pub amount_sats: u64,
    pub script_pubkey: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressInfo {
    pub address: String,
    pub balance_sats: u64,
    pub total_received: u64,
    pub total_sent: u64,
    pub tx_count: u32,
    pub unconfirmed_balance: u64,
}

pub trait EventHandler {
    async fn handle_event(&self, event: BitcoinEvent) -> anyhow::Result<()>;
}

pub struct BitcoinEventHandler {
    store: crate::store::BitcoinStore,
}

impl BitcoinEventHandler {
    pub fn new(store: crate::store::BitcoinStore) -> Self {
        Self { store }
    }
}

impl EventHandler for BitcoinEventHandler {
    async fn handle_event(&self, event: BitcoinEvent) -> anyhow::Result<()> {
        match event {
            BitcoinEvent::HtlcCreated { id, params } => {
                self.store.add_htlc_params(id, params).await?;
            }
            BitcoinEvent::HtlcFunded { id, tx_hash, amount_sats, confirmations } => {
                self.store.update_htlc_status(&id, HtlcStatus::Funded).await?;
                
                // Get current block height for init event
                let current_block_height = self.store.get_current_block_height().await?;
                
                // Update database with init information
                self.store.update_swap_initiate(&id, &tx_hash, amount_sats, current_block_height).await?;
                
                log::info!("HTLC funded: {} with {} sats ({} confirmations) at block {}", 
                    id, amount_sats, confirmations, current_block_height);
            }
            BitcoinEvent::HtlcClaimed { id, tx_hash, preimage } => {
                self.store.update_htlc_status(&id, HtlcStatus::Claimed).await?;
                
                // Get current block height for redeem event
                let current_block_height = self.store.get_current_block_height().await?;
                
                // Update database with redeem information
                self.store.update_swap_redeem(&id, &tx_hash, current_block_height, &preimage).await?;
                
                log::info!("HTLC claimed: {} with preimage: {} (tx: {}) at block {}", 
                    id, preimage, tx_hash, current_block_height);
            }
            BitcoinEvent::HtlcRefunded { id, tx_hash } => {
                self.store.update_htlc_status(&id, HtlcStatus::Refunded).await?;
                
                // Get current block height for refund event
                let current_block_height = self.store.get_current_block_height().await?;
                
                // Update database with refund information
                self.store.update_swap_refund(&id, &tx_hash, current_block_height).await?;
                
                log::info!("HTLC refunded: {} with tx: {} at block {}", 
                    id, tx_hash, current_block_height);
            }
            BitcoinEvent::HtlcExpired { id } => {
                self.store.update_htlc_status(&id, HtlcStatus::Expired).await?;
                log::info!("HTLC expired: {}", id);
            }
            BitcoinEvent::AddressBalanceChanged { address, old_balance, new_balance, tx_hash } => {
                log::info!("Address {} balance changed: {} -> {} sats (tx: {})", 
                    address, old_balance, new_balance, tx_hash);
            }
        }
        Ok(())
    }
}
