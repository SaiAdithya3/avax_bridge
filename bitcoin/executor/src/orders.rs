use mongodb::{
    bson::{doc, Document},
    options::ClientOptions,
    Client, Collection, Database,
};
use primitives::types::MatchedOrder;
use anyhow::{anyhow, Result};
use futures::stream::TryStreamExt;


#[async_trait::async_trait]
pub trait Orderbook {
    /// Get all pending orders on which COBI can perform some action on.
    /// This returns all the orders where user initiated
    async fn get_pending_orders(&self, user_addresses: Vec<String>) -> Result<Vec<MatchedOrder>>;
    
    /// Get a specific matched order by create ID
    async fn get_matched_order(&self, create_id: &str) -> Result<MatchedOrder>;
}

pub struct OrderbookProvider {
    db: Database,
    matched_orders: Collection<Document>,
    create_orders: Collection<Document>,
    swaps: Collection<Document>,
}

impl OrderbookProvider {
    pub async fn new(db: Database) -> Self {
        let matched_orders = db.collection("matched_orders");
        let create_orders = db.collection("create_orders");
        let swaps = db.collection("swaps");
        
        Self {
            db,
            matched_orders,
            create_orders,
            swaps,
        }
    }

    pub async fn from_connection_string(connection_str: &str) -> Result<Self> {
        let client_options = ClientOptions::parse(connection_str).await?;
        let client = Client::with_options(client_options)?;
        let db = client.database("orderbook"); // You can change the database name
        
        Ok(Self::new(db).await)
    }
}

#[async_trait::async_trait]
impl Orderbook for OrderbookProvider {
    async fn get_matched_order(&self, create_id: &str) -> Result<MatchedOrder> {
        let pipeline = vec![
            doc! {
                "$match": {
                    "create_order_id": create_id
                }
            },
            doc! {
                "$lookup": {
                    "from": "create_orders",
                    "localField": "create_order_id",
                    "foreignField": "create_id",
                    "as": "create_order"
                }
            },
            doc! {
                "$lookup": {
                    "from": "swaps",
                    "localField": "source_swap_id",
                    "foreignField": "swap_id",
                    "as": "source_swap"
                }
            },
            doc! {
                "$lookup": {
                    "from": "swaps",
                    "localField": "destination_swap_id",
                    "foreignField": "swap_id",
                    "as": "destination_swap"
                }
            },
            doc! {
                "$project": {
                    "create_order_id": 1,
                    "source_swap": { "$arrayElemAt": ["$source_swap", 0] },
                    "destination_swap": { "$arrayElemAt": ["$destination_swap", 0] },
                    "additional_data": { "$arrayElemAt": ["$create_order.additional_data", 0] }
                }
            }
        ];

        let mut cursor = self.matched_orders.aggregate(pipeline).await?;
        
        if let Some(doc) = cursor.try_next().await? {
            let matched_order: MatchedOrder = mongodb::bson::from_document(doc)?;
            Ok(matched_order)
        } else {
            Err(anyhow!("Matched order not found"))
        }
    }

    /// Get all pending orders on which COBI can perform some action on.
    /// Note: This will only fetch 1000 oldest pending orders which cobi has to init or redeem
    async fn get_pending_orders(&self, user_addresses: Vec<String>) -> Result<Vec<MatchedOrder>> {
        let lowercase_addresses: Vec<String> = user_addresses
            .iter()
            .map(|addr| addr.to_lowercase())
            .collect();

        let pipeline = vec![
            doc! {
                "$lookup": {
                    "from": "create_orders",
                    "localField": "create_order_id",
                    "foreignField": "create_id",
                    "as": "create_order"
                }
            },
            doc! {
                "$lookup": {
                    "from": "swaps",
                    "localField": "source_swap_id",
                    "foreignField": "swap_id",
                    "as": "source_swap"
                }
            },
            doc! {
                "$lookup": {
                    "from": "swaps",
                    "localField": "destination_swap_id",
                    "foreignField": "swap_id",
                    "as": "destination_swap"
                }
            },
            doc! {
                "$addFields": {
                    "source_swap": { "$arrayElemAt": ["$source_swap", 0] },
                    "destination_swap": { "$arrayElemAt": ["$destination_swap", 0] },
                    "additional_data": { "$arrayElemAt": ["$create_order.additional_data", 0] }
                }
            },
            doc! {
                "$match": {
                    "$and": [
                        {
                            "$or": [
                                { "source_swap.initiator": { "$in": &lowercase_addresses } },
                                { "source_swap.redeemer": { "$in": &lowercase_addresses } },
                                { "destination_swap.initiator": { "$in": &lowercase_addresses } },
                                { "destination_swap.redeemer": { "$in": &lowercase_addresses } }
                            ]
                        },
                        {
                            "$or": [
                                // Source swap initiated but destination not initiated
                                {
                                    "$and": [
                                        { "source_swap.initiate_tx_hash": { "$ne": "" } },
                                        { "source_swap.refund_tx_hash": { "$eq": "" } },
                                        { "destination_swap.initiate_tx_hash": { "$eq": "" } }
                                    ]
                                },
                                // Destination has secret but source not redeemed
                                {
                                    "$and": [
                                        { "destination_swap.secret": { "$ne": "" } },
                                        { "source_swap.redeem_tx_hash": { "$eq": "" } },
                                        { "source_swap.refund_tx_hash": { "$eq": "" } }
                                    ]
                                },
                                // Destination initiated but not redeemed/refunded
                                {
                                    "$and": [
                                        { "destination_swap.initiate_tx_hash": { "$ne": "" } },
                                        { "destination_swap.refund_tx_hash": { "$eq": "" } },
                                        { "destination_swap.redeem_tx_hash": { "$eq": "" } }
                                    ]
                                },
                                // Source can be refunded
                                {
                                    "$and": [
                                        { "source_swap.refund_tx_hash": { "$eq": "" } },
                                        { "source_swap.redeem_tx_hash": { "$eq": "" } },
                                        { "destination_swap.refund_block_number": { "$gt": 0 } }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            },
            doc! {
                "$project": {
                    "create_order_id": 1,
                    "source_swap": 1,
                    "destination_swap": 1,
                    "additional_data": 1
                }
            },
            doc! {
                "$sort": {
                    "created_at": 1
                }
            },
            doc! {
                "$limit": 1000
            }
        ];

        let mut cursor = self.matched_orders.aggregate(pipeline).await?;
        let mut matched_orders = Vec::new();

        while let Some(doc) = cursor.try_next().await? {
            let matched_order: MatchedOrder = mongodb::bson::from_document(doc)?;
            matched_orders.push(matched_order);
        }

        Ok(matched_orders)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    #[tokio::test]
    async fn test_orderbook_provider() {
        // This is a basic test - you would need a test MongoDB instance
        // let provider = OrderbookProvider::from_connection_string("mongodb://localhost:27017").await.unwrap();
        // let orders = provider.get_pending_orders(vec!["test_address".to_string()]).await.unwrap();
        // assert!(orders.is_empty()); // Assuming no test data
    }
}
