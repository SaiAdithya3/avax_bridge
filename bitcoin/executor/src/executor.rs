use crate::{orders::{Orderbook}, wallet::HTLCWallet};
use anyhow::Result;
use bitcoin::Network;
use primitives::{htlc::BitcoinHTLC, types::{MatchedOrder}};
use std::{time::Duration, str::FromStr};
use tokio::time;

pub struct OrderToActionMapper {
    wallet: HTLCWallet,
    network: Network,
}

impl OrderToActionMapper {
    pub fn new(wallet: HTLCWallet, network: Network) -> Self {
        Self { wallet, network }
    }

    pub async fn map(&self, order: &MatchedOrder) -> Result<HTLCAction> {
        match self.determine_action(order) {
            ActionType::Init => self.handle_init(order).await,
            ActionType::Redeem => self.handle_redeem(order).await,
            ActionType::Refund => self.handle_refund(order).await,
            ActionType::NoOp => Ok(HTLCAction::NoOp),
        }
    }

    fn determine_action(&self, order: &MatchedOrder) -> ActionType {
        if order.destination_swap.initiate_tx_hash.is_none() || order.destination_swap.initiate_tx_hash.as_ref().unwrap().is_empty() {
            ActionType::Init
        } else if (order.source_swap.redeem_tx_hash.is_none() || order.source_swap.redeem_tx_hash.as_ref().unwrap().is_empty()) && !order.destination_swap.secret.as_ref().unwrap_or(&"".to_string()).is_empty() {
            ActionType::Redeem
        } else if (order.destination_swap.refund_tx_hash.is_none() || order.destination_swap.refund_tx_hash.as_ref().unwrap().is_empty()) && order.destination_swap.initiate_tx_hash.is_some() && order.destination_swap.initiate_block_number.as_ref().unwrap_or(&"".to_string()).is_empty() {
            ActionType::Refund
        } else {
            ActionType::NoOp
        }
    }

    async fn handle_init(&self, order: &MatchedOrder) -> Result<HTLCAction> {
        println!("Handling INIT action for order: {:?}", order.create_order.create_id);
        
        // Create BitcoinHTLC from the order data
        let bitcoin_htlc = BitcoinHTLC::new(
            order.destination_swap.secret_hash.clone(),
            order.destination_swap.initiator.clone(),
            order.destination_swap.redeemer.clone(),
            order.destination_swap.timelock as i64, // Default timelock - you might want to get this from order data
            self.network,
        )?;

        // Get amount from create_order or use a default
        let amount = self.extract_amount_from_order(order).unwrap_or(50000);

        match self.wallet.initiate_htlc(&bitcoin_htlc, amount).await {
            Ok(tx) => {
                println!("✅ Init transaction created: {}", tx.compute_txid());
                Ok(HTLCAction::Init { 
                    order_id: order.create_order.create_id.clone().unwrap(),
                    transaction: tx,
                    htlc: bitcoin_htlc,
                })
            }
            Err(e) => {
                println!("❌ Failed to create init transaction: {}", e);
                Ok(HTLCAction::NoOp)
            }
        }
    }

    async fn handle_redeem(&self, order: &MatchedOrder) -> Result<HTLCAction> {
        println!("Handling REDEEM action for order: {:?}", order.create_order.create_id);
        
        // Create BitcoinHTLC from the order data
        let bitcoin_htlc = BitcoinHTLC::new(
            order.destination_swap.secret_hash.clone(),
            order.destination_swap.initiator.clone(),
            order.destination_swap.redeemer.clone(),
            12, // Default timelock
            self.network,
        )?;

        let secret = &order.destination_swap.secret;
        let recipient_address = self.wallet.get_address();

        match self.wallet.redeem_htlc(&bitcoin_htlc, &secret.clone().unwrap(), &recipient_address).await {
            Ok(tx) => {
                println!("✅ Redeem transaction created: {}", tx.compute_txid());
                Ok(HTLCAction::Redeem { 
                    order_id: order.create_order.create_id.clone().unwrap(),
                    transaction: tx,
                    secret: secret.clone().unwrap(),
                })
            }
            Err(e) => {
                println!("❌ Failed to create redeem transaction: {}", e);
                Ok(HTLCAction::NoOp)
            }
        }
    }

    async fn handle_refund(&self, order: &MatchedOrder) -> Result<HTLCAction> {
        println!("Handling REFUND action for order: {:?}", order.create_order.create_id);
        
        // Create BitcoinHTLC from the order data
        let bitcoin_htlc = BitcoinHTLC::new(
            order.destination_swap.secret_hash.clone(),
            order.destination_swap.initiator.clone(),
            order.destination_swap.redeemer.clone(),
            12, // Default timelock
            self.network,
        )?;

        // Use bitcoin_optional_recipient if available, otherwise use wallet address
        let refund_address_str = if let Some(recipient) = &order.create_order.bitcoin_optional_recipient {
            recipient.clone()
        } else {
            self.wallet.get_address().to_string()
        };

        // Parse the address string to bitcoin::Address with network checking
        let refund_address = bitcoin::Address::from_str(&refund_address_str)
            .map_err(|e| anyhow::anyhow!("Invalid refund address: {}", e))?
            .require_network(self.network)
            .map_err(|e| anyhow::anyhow!("Address network mismatch: {}", e))?;

        match self.wallet.refund_htlc(&bitcoin_htlc, &refund_address).await {
            Ok(tx) => {
                println!("✅ Refund transaction created: {}", tx.compute_txid());
                Ok(HTLCAction::Refund { 
                    order_id: order.create_order.create_id.clone().unwrap(),
                    transaction: tx,
                })
            }
            Err(e) => {
                println!("❌ Failed to create refund transaction: {}", e);
                Ok(HTLCAction::NoOp)
            }
        }
    }

    fn extract_amount_from_order(&self, order: &MatchedOrder) -> Option<u64> {
        // Try to extract amount from destination_amount in create_order
        if let Ok(amount) = order.create_order.destination_amount.parse::<u64>() {
            return Some(amount);
        }
        None
    }
}

#[derive(Debug)]
enum ActionType {
    Init,
    Redeem,
    Refund,
    NoOp,
}

pub enum HTLCAction {
    Init {
        order_id: String,
        transaction: bitcoin::Transaction,
        htlc: BitcoinHTLC,
    },
    Redeem {
        order_id: String,
        transaction: bitcoin::Transaction,
        secret: String,
    },
    Refund {
        order_id: String,
        transaction: bitcoin::Transaction,
    },
    NoOp,
}

pub struct Executor {
    orderbook: Box<dyn Orderbook + Send + Sync>,
    mapper: OrderToActionMapper,
    user_addresses: Vec<String>,
}

impl Executor {
    pub fn new(
        orderbook: Box<dyn Orderbook + Send + Sync>,
        mapper: OrderToActionMapper,
        user_addresses: Vec<String>,
    ) -> Self {
        Self {
            orderbook,
            mapper,
            user_addresses,
        }
    }

    pub async fn start_polling(&self) -> Result<()> {
        println!("Starting executor polling every 5 seconds...");
        
        let mut interval = time::interval(Duration::from_secs(5));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.process_pending_orders().await {
                println!("Error processing pending orders: {}", e);
            }
        }
    }

    async fn process_pending_orders(&self) -> Result<()> {
        println!("Polling for pending orders...");
        
        let orders = self.orderbook.get_pending_orders(self.user_addresses.clone()).await?;
        
        if orders.is_empty() {
            println!("No pending orders found");
            return Ok(());
        }

        println!("Found {} pending orders", orders.len());

        for order in &orders {
            match self.mapper.map(order).await {
                Ok(action) => {
                    match action {
                        HTLCAction::Init { order_id, transaction, htlc } => {
                            println!("Processing INIT for order: {}", order_id);
                            self.broadcast_transaction(&transaction).await?;
                        }
                        HTLCAction::Redeem { order_id, transaction, secret } => {
                            println!("Processing REDEEM for order: {}", order_id);
                            self.broadcast_transaction(&transaction).await?;
                        }
                        HTLCAction::Refund { order_id, transaction } => {
                            println!("Processing REFUND for order: {}", order_id);
                            self.broadcast_transaction(&transaction).await?;
                        }
                        HTLCAction::NoOp => {
                            println!("No action needed for order: {:?}", order.create_order.create_id);
                        }
                    }
                }
                Err(e) => {
                    println!("Error mapping order {:?}: {}", order.create_order.create_id, e);
                }
            }
        }

        Ok(())
    }

    async fn broadcast_transaction(&self, transaction: &bitcoin::Transaction) -> Result<()> {
        // Use the wallet's broadcast method
        match self.mapper.wallet.broadcast_transaction(transaction).await {
            Ok(tx_id) => {
                println!("✅ Transaction broadcasted successfully: {}", tx_id);
                Ok(())
            }
            Err(e) => {
                println!("❌ Failed to broadcast transaction: {}", e);
                Err(anyhow::anyhow!("Failed to broadcast transaction: {}", e))
            }
        }
    }
}
