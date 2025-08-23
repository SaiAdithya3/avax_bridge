use serde::{Deserialize, Serialize, Deserializer};
use mongodb::bson::{DateTime, oid::ObjectId};

fn deserialize_datetime<'de, D>(deserializer: D) -> Result<DateTime, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::{Error, Visitor};
    use std::fmt;
    
    struct DateTimeVisitor;
    
    impl<'de> Visitor<'de> for DateTimeVisitor {
        type Value = DateTime;
        
        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a string or BSON DateTime")
        }
        
        fn visit_str<E>(self, value: &str) -> Result<DateTime, E>
        where
            E: Error,
        {
            // Try to parse ISO 8601 format
            if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(value) {
                return Ok(DateTime::from_millis(datetime.timestamp_millis()));
            }
            // Try to parse ISO format without timezone
            if let Ok(datetime) = chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.fZ") {
                return Ok(DateTime::from_millis(datetime.and_utc().timestamp_millis()));
            }
            // Try to parse just date
            if let Ok(datetime) = chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S") {
                return Ok(DateTime::from_millis(datetime.and_utc().timestamp_millis()));
            }
            Err(Error::custom(format!("Failed to parse date: {}", value)))
        }
        
        fn visit_string<E>(self, value: String) -> Result<DateTime, E>
        where
            E: Error,
        {
            self.visit_str(&value)
        }
    }
    
    deserializer.deserialize_any(DateTimeVisitor)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub source_chain: String,
    pub destination_chain: String,
    pub source_asset: String,
    pub destination_asset: String,
    pub source_amount: String,
    pub destination_amount: String,
    pub initiator_source_address: String,
    pub initiator_destination_address: String,
    pub secret_hash: String,
    #[serde(deserialize_with = "deserialize_datetime")]
    pub created_at: DateTime,
    pub create_id: String,
    pub input_token_price: f64,
    pub output_token_price: f64,
    pub bitcoin_optional_recipient: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedOrder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(deserialize_with = "deserialize_datetime")]
    pub created_at: DateTime,
    pub source_swap: Swap,
    pub destination_swap: Swap,
    pub create_order: CreateOrder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Swap {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(deserialize_with = "deserialize_datetime")]
    pub created_at: DateTime,
    pub swap_id: String,
    pub chain: Chain,
    pub asset: String,
    pub htlc_address: String,
    pub token_address: String,
    pub initiator: String,
    pub redeemer: String,
    pub filled_amount: String,
    pub amount: String,
    pub secret_hash: String,
    pub secret: String,
    pub initiate_tx_hash: Option<String>,
    pub redeem_tx_hash: Option<String>,
    pub refund_tx_hash: Option<String>,
    pub initiate_block_number: Option<String>,
    pub redeem_block_number: Option<String>,
    pub refund_block_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Chain {
    #[serde(rename = "bitcoin_testnet")]
    BitcoinTestnet,
    #[serde(rename = "arbitrum_sepolia")]
    ArbitrumSepolia,
    #[serde(rename = "avalanche_testnet")]
    AvalancheTestnet,
}

impl std::fmt::Display for Chain {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Chain::BitcoinTestnet => write!(f, "bitcoin_testnet"),
            Chain::ArbitrumSepolia => write!(f, "arbitrum_sepolia"),
            Chain::AvalancheTestnet => write!(f, "avalanche_testnet"),
        }
    }
}
