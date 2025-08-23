use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::time::Duration;

use crate::htlc_handler::UTXO;

/// Statistics for address transactions on the blockchain
#[derive(Debug, Deserialize, Clone)]
pub struct ChainStats {
    pub funded_txo_count: u32,
    pub funded_txo_sum: u64,
    pub spent_txo_count: u32,
    pub spent_txo_sum: u64,
    pub tx_count: u32,
}

/// Statistics for address transactions in the mempool
#[derive(Debug, Deserialize, Clone)]
pub struct MempoolStats {
    pub funded_txo_count: u32,
    pub funded_txo_sum: u64,
    pub spent_txo_count: u32,
    pub spent_txo_sum: u64,
    pub tx_count: u32,
}

/// Complete address information from mempool.space API
#[derive(Debug, Deserialize, Clone)]
pub struct AddressInfo {
    pub address: String,
    pub chain_stats: ChainStats,
    pub mempool_stats: MempoolStats,
}

pub struct SimpleIndexer {
    client: reqwest::Client,
    url: String
}

impl SimpleIndexer {
    pub fn new(url: &str) -> Result<Self> {
        let client = reqwest::ClientBuilder::new()
            .timeout(Duration::from_secs(5))
            .build()?;

        Ok(
            Self { client, url: url.to_string() }
        )
    }

    pub async fn get_current_block_height(&self) -> Result<u64> {
        let url = format!("{}/blocks/tip/height", self.url);
        
        let response = self.client.get(&url).send().await?;
        if response.status().is_success() {
            let height: u64 = response.text().await?.parse()?;
            Ok(height)
        } else {
            Err(anyhow::anyhow!("Failed to get current block height: {}", response.status()))
        }
    }

    /// Gets address information including chain and mempool statistics
    pub async fn get_address_info(&self, address: &str) -> Result<AddressInfo> {
        let url = format!("{}/address/{}", &self.url, address);
        let response = self.client.get(&url).send().await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch address info: {}", response.status()));
        }
        
        let address_info = response.json::<AddressInfo>().await?;
        Ok(address_info)
    }

    /// Gets the total transaction count for an address (chain + mempool)
    pub async fn get_address_transaction_count(&self, address: &str) -> Result<u32> {
        let address_info = self.get_address_info(address).await?;
        let total_tx_count = address_info.chain_stats.tx_count + address_info.mempool_stats.tx_count;
        Ok(total_tx_count)
    }

    /// Gets the total funded amount for an address (chain + mempool)
    pub async fn get_address_funded_amount(&self, address: &str) -> Result<u64> {
        let address_info = self.get_address_info(address).await?;
        let total_funded = address_info.chain_stats.funded_txo_sum + address_info.mempool_stats.funded_txo_sum;
        Ok(total_funded)
    }

    /// Gets the total spent amount for an address (chain + mempool)
    pub async fn get_address_spent_amount(&self, address: &str) -> Result<u64> {
        let address_info = self.get_address_info(address).await?;
        let total_spent = address_info.chain_stats.spent_txo_sum + address_info.mempool_stats.spent_txo_sum;
        Ok(total_spent)
    }

    /// Gets the current balance for an address (funded - spent)
    pub async fn get_address_balance(&self, address: &str) -> Result<u64> {
        let funded = self.get_address_funded_amount(address).await?;
        let spent = self.get_address_spent_amount(address).await?;
        Ok(funded.saturating_sub(spent))
    }

    pub async fn get_utxos(&self, address: &str) -> Result<Vec<UTXO>> {
        let url = format!("{}/address/{}/utxo", &self.url, address);

        let response = self.client.get(url).send().await?;
        let resp = response.json::<Vec<UTXO>>().await?;

        Ok(resp)
    }

    pub async fn get_utxos_for_amount(&self, address:&str, amount: i64) -> Result<Vec<UTXO>> {
        let utxos = self.get_utxos(address).await?;
        let mut filtered_utxos: Vec<UTXO> = Vec::new();
        let mut total = 0;

        for utxo in utxos {
            total += utxo.value as i64;
            filtered_utxos.push(utxo);
            if total == amount {
                return Ok(filtered_utxos);
            }
        }

        if total < amount {
            return Err(anyhow!("Not enough funds in UTXOs"));
        }
        Ok(filtered_utxos)
    }

    pub async fn submit_tx(&self, tx: &bitcoin::Transaction) -> Result<String> {
        let endpoint = format!("{}/tx", self.url);
        let tx_bytes = bitcoin::consensus::serialize(tx);
        let hex_tx = hex::encode(tx_bytes);
        let str_buffer = hex_tx.as_bytes();

        const MAX_RETRIES: usize = 3;
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < MAX_RETRIES {
            match self.client
                .post(&endpoint)
                .header("Content-Type", "application/text")
                .body(str_buffer.to_vec())
                .send().await {
                    Ok(resp) => {
                        if resp.status().is_success() {
                            return Ok(resp.text().await?.to_string());
                        } else {
                            let err_msg = resp.text().await.map_err(|e| e)?;
                            last_error = Some(anyhow!("req failed : {:#?}", err_msg));
                        }
                    },
                    Err(e) => {
                        last_error = Some(anyhow!("request error: {}", e));
                    }
                }

            attempts += 1;
            if attempts < MAX_RETRIES {
                // Add a small delay before retrying
                tokio::time::sleep(tokio::time::Duration::from_millis(500 * attempts as u64)).await;
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow!("Failed to submit transaction after {} attempts", MAX_RETRIES)))
    }

}

