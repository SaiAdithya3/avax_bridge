use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;
use std::clone::Clone;
use reqwest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub chain: String,
    pub asset: String,
    pub amount: u64,
    pub recipient_pubkey: String,
    pub refund_pubkey: String,
    pub hashlock: String,
    pub timelock: u32,
    pub refund_address: String,
    pub redeem_block_number: u64,
    pub refund_block_number: u64,
    pub created_at: u64,
    // New fields for database updates
    pub init_tx_hash: Option<String>,
    pub filled_amount: Option<u64>,
    pub init_block_number: Option<u64>,
    pub redeem_tx_hash: Option<String>,
    pub secret: Option<String>,
    pub refund_tx_hash: Option<String>,
}

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
    pub min_confirmations: u32,
    pub block_time: u32, // seconds
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
}

impl BitcoinStore {
    pub fn new(config: BitcoinConfig) -> Self {
        Self {
            htlc_params: Arc::new(RwLock::new(HashMap::new())),
            config,
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

    pub async fn get_all_pending_htlcs(&self) -> Result<Vec<(String, BitcoinHtlcParams)>> {
        let htlc_params = self.htlc_params.read().await;
        let pending: Vec<_> = htlc_params
            .iter()
            .filter(|(_, params)| params.status == HtlcStatus::Pending)
            .map(|(id, params)| (id.clone(), params.clone()))
            .collect();
        Ok(pending)
    }

    pub async fn get_all_funded_htlcs(&self) -> Result<Vec<(String, BitcoinHtlcParams)>> {
        let htlc_params = self.htlc_params.read().await;
        let funded: Vec<_> = htlc_params
            .iter()
            .filter(|(_, params)| params.status == HtlcStatus::Funded)
            .map(|(id, params)| (id.clone(), params.clone()))
            .collect();
        Ok(funded)
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

    pub async fn get_active_orders(&self) -> Result<Vec<Order>> {
        // This would integrate with your actual database
        // Similar to the Go code:
        // sevenDays := time.Now().Add(-168 * time.Hour)
        // result := s.db.
        //     Where("chain = ? AND asset = ?", s.chain, s.asset).
        //     Where("amount > 0").
        //     Where(`redeem_block_number = 0`).
        //     Where(`refund_block_number = 0`).
        //     Where("created_at >= ?", sevenDays).
        //     Find(&swaps)
        
        // For now, return empty vector - you'll need to implement actual database integration
        // This should query your database for active Bitcoin orders with the following conditions:
        // - chain = "bitcoin" 
        // - asset = "BTC"
        // - amount > 0
        // - redeem_block_number = 0
        // - refund_block_number = 0
        // - created_at >= (current_time - 7 days)
        
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let _seven_days_ago = current_time - (7 * 24 * 60 * 60); // 7 days in seconds
        
        // TODO: Implement actual database query here
        // Example SQL equivalent:
        // SELECT * FROM orders 
        // WHERE chain = 'bitcoin' 
        //   AND asset = 'BTC' 
        //   AND amount > 0 
        //   AND redeem_block_number = 0 
        //   AND refund_block_number = 0 
        //   AND created_at >= ?
        
        // For testing, return some mock orders
        let mock_orders = vec![
            Order {
                id: "order_1".to_string(),
                chain: "bitcoin".to_string(),
                asset: "BTC".to_string(),
                amount: 997000, // 0.001 BTC
                recipient_pubkey: "be4b9e8e8c0146b155d3ce35d0e3dfef1c99ef598b63e00524a912dd21480bce".to_string(),
                refund_pubkey: "460f2e8ff81fc4e0a8e6ce7796704e3829e3e3eedb8db9390bdc51f4f04cf0a6".to_string(),
                hashlock: "731170d859f81a395a79e02cf3812e413b21793900e70ff77e48dfcf7ef6a4e6".to_string(),
                timelock: 12, // 24 hours in blocks
                refund_address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4".to_string(),
                redeem_block_number: 0,
                refund_block_number: 0,
                created_at: current_time - 3600, // 1 hour ago
                // New fields initialized as None
                init_tx_hash: None,
                filled_amount: None,
                init_block_number: None,
                redeem_tx_hash: None,
                secret: None,
                refund_tx_hash: None,
            },
        ];
        
        Ok(mock_orders)
    }

    pub async fn update_order_redeem_block(&self, order_id: &str, block_number: u64) -> Result<()> {
        // TODO: Implement database update
        // UPDATE orders SET redeem_block_number = ? WHERE id = ?
        log::info!("Updated order {} redeem block to {}", order_id, block_number);
        Ok(())
    }

    pub async fn update_order_refund_block(&self, order_id: &str, block_number: u64) -> Result<()> {
        // TODO: Implement database update
        // UPDATE orders SET refund_block_number = ? WHERE id = ?
        log::info!("Updated order {} refund block to {}", order_id, block_number);
        Ok(())
    }

    // New methods for database updates
    pub async fn update_swap_initiate(&self, order_id: &str, init_tx_hash: &str, filled_amount: u64, init_block_number: u64) -> Result<()> {
        // TODO: Implement database update
        // UPDATE orders SET init_tx_hash = ?, filled_amount = ?, init_block_number = ? WHERE id = ?
        log::info!("Updated order {} init: tx_hash={}, amount={}, block={}", 
            order_id, init_tx_hash, filled_amount, init_block_number);
        Ok(())
    }

    pub async fn update_swap_redeem(&self, order_id: &str, redeem_tx_hash: &str, redeem_block_number: u64, secret: &str) -> Result<()> {
        // TODO: Implement database update
        // UPDATE orders SET redeem_tx_hash = ?, redeem_block_number = ?, secret = ? WHERE id = ?
        log::info!("Updated order {} redeem: tx_hash={}, block={}, secret={}", 
            order_id, redeem_tx_hash, redeem_block_number, secret);
        Ok(())
    }

    pub async fn update_swap_refund(&self, order_id: &str, refund_tx_hash: &str, refund_block_number: u64) -> Result<()> {
        // TODO: Implement database update
        // UPDATE orders SET refund_tx_hash = ?, refund_block_number = ? WHERE id = ?
        log::info!("Updated order {} refund: tx_hash={}, block={}", 
            order_id, refund_tx_hash, refund_block_number);
        Ok(())
    }

    pub async fn get_current_block_height(&self) -> Result<u64> {
        // Get current block height from the indexer
        let client = reqwest::Client::new();
        let url = format!("{}/blocks/tip/height", self.config.indexer_url);
        
        let response = client.get(&url).send().await?;
        if response.status().is_success() {
            let height: u64 = response.text().await?.parse()?;
            Ok(height)
        } else {
            Err(anyhow::anyhow!("Failed to get current block height: {}", response.status()))
        }
    }
}
