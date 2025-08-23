use crate::config::AppConfig;
use crate::primitives::{CreateOrder, MatchedOrder, Swap, Chain};
use crate::AlloyProvider;
use crate::HTLCRegistry::HTLCRegistryInstance;
use alloy::hex::FromHex;
use alloy::primitives::{Address, FixedBytes, U256};
// use crate::bitcoin_htlc::{get_htlc_address, HTLCParams};
// use bitcoin::{Network, XOnlyPublicKey};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use std::collections::HashMap;
use std::str::FromStr;
use mongodb::bson::DateTime;
use rand::Rng;
use num_bigint::BigUint;
use sha2::{Sha256, Digest};



#[derive(Clone)]
pub struct OrderService {
    config: AppConfig,
    evm_registries: HashMap<String, HTLCRegistryInstance<AlloyProvider>>
}

impl OrderService {
    pub fn new(config: AppConfig, evm_registries: HashMap<String, HTLCRegistryInstance<AlloyProvider>>) -> Self {
        Self { config, evm_registries }
    }
    
    pub async fn get_matched_order(&self, mut create_order: CreateOrder) -> Result<MatchedOrder> {
        // Generate create_id automatically
        let create_id = Self::generate_create_id();
        
        // Parse from and to fields to extract chain and asset
        let (source_chain, source_asset) = Self::parse_chain_asset(&create_order.from)?;
        let (dest_chain, dest_asset) = Self::parse_chain_asset(&create_order.to)?;
        
        // Validate chains exist in config
        let source_chain_config = self.config.chains.get(&source_chain)
            .ok_or_else(|| anyhow!("Source chain {} not found in config", source_chain))?;
        
        let dest_chain_config = self.config.chains.get(&dest_chain)
            .ok_or_else(|| anyhow!("Destination chain {} not found in config", dest_chain))?;
        
        // Validate assets exist for each chain
        let source_asset_config = source_chain_config.assets.iter()
            .find(|asset| asset.id.to_lowercase() == source_asset.to_lowercase())
            .ok_or_else(|| anyhow!("Asset {} not found for chain {}", source_asset, source_chain))?;
        
        let dest_asset_config = dest_chain_config.assets.iter()
            .find(|asset| asset.id.to_lowercase() == dest_asset.to_lowercase())
            .ok_or_else(|| anyhow!("Asset {} not found for chain {}", dest_asset, dest_chain))?;
        
        // Parse chain enum
        let source_chain_enum = Chain::from_str(&source_chain)
            .map_err(|_| anyhow!("Invalid source chain: {}", source_chain))?;
        
        let dest_chain_enum = Chain::from_str(&dest_chain)
            .map_err(|_| anyhow!("Invalid destination chain: {}", dest_chain))?;
        
        // Generate current timestamp
        let now = DateTime::now();
        
        // Set the generated create_id on the CreateOrder
        create_order.create_id = Some(create_id.clone());

        tracing::info!("Source chain: {}", source_chain);
        tracing::info!("Destination chain: {}", dest_chain);

        tracing::info!("Create id: {}", create_id);
        
        // Generate source swap ID based on chain type
        let source_swap_id = if Self::is_evm_chain(&source_chain_enum) {
            self.generate_evm_swap_id(
                Self::get_chain_id(&source_chain),
                &create_order.secret_hash,
                &create_order.initiator_source_address,
                &source_chain_config.executor_address,
                source_chain_config.source_timelock,
                &create_order.source_amount,
                &source_asset_config.atomic_swap_address,
            ).map_err(|e| anyhow!("Failed to generate source swap id: {}", e))?
        } else {
            format!("swap_src_{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("placeholder"))
        };

        tracing::info!("Source swap id: {}", source_swap_id);

        let source_deposit_address = if Self::is_evm_chain(&source_chain_enum) {
            self.generate_deposit_address(
                &source_asset_config.token_address,
                &source_chain,
                &create_order.secret_hash,
                &create_order.initiator_source_address,
                &source_chain_config.executor_address,
                source_chain_config.source_timelock,
                &create_order.source_amount,
                &source_asset_config.atomic_swap_address,
            ).await?
        } else {
            None
        };

        tracing::info!("Source deposit address: {:?}", &source_deposit_address);

        let source_swap = Swap {
            id: None, // Will be set by MongoDB
            created_at: now,
            swap_id: source_swap_id,
            chain: source_chain_enum,
            asset: source_asset.clone(),
            htlc_address: source_asset_config.atomic_swap_address.clone(),
            token_address: source_asset_config.token_address.clone(),
            initiator: create_order.initiator_source_address.clone(),
            redeemer: source_chain_config.executor_address.clone(),
            filled_amount: "0".to_string(),
            amount: create_order.source_amount.clone(),
            timelock: source_chain_config.source_timelock,
            secret_hash: create_order.secret_hash.clone(),
            secret: None, // Empty at beginning
            initiate_tx_hash: None, // Empty at beginning
            redeem_tx_hash: None, // Empty at beginning
            refund_tx_hash: None, // Empty at beginning
            initiate_block_number: None, // Empty at beginning
            redeem_block_number: None, // Empty at beginning
            refund_block_number: None, // Empty at beginning
            deposit_address : source_deposit_address
        };
        
        // Generate destination swap ID based on chain type
        let dest_swap_id = if Self::is_evm_chain(&dest_chain_enum) {
            self.generate_evm_swap_id(
                Self::get_chain_id(&dest_chain),
                &create_order.secret_hash,
                &create_order.initiator_destination_address,
                &dest_chain_config.executor_address,
                dest_chain_config.destination_timelock,
                &create_order.destination_amount,
                &dest_asset_config.atomic_swap_address,
            )?
        } else {
            format!("swap_dest_{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("placeholder"))
        };

        let destination_swap = Swap {
            id: None, // Will be set by MongoDB
            created_at: now,
            swap_id: dest_swap_id,
            chain: dest_chain_enum,
            asset: dest_asset.clone(),
            htlc_address: dest_asset_config.atomic_swap_address.clone(),
            token_address: dest_asset_config.token_address.clone(),
            initiator: create_order.initiator_destination_address.clone(),
            redeemer: dest_chain_config.executor_address.clone(),
            filled_amount: create_order.destination_amount.clone(),
            amount: create_order.destination_amount.clone(),
            timelock: dest_chain_config.destination_timelock,
            secret_hash: create_order.secret_hash.clone(),
            secret: None, // Empty at beginning
            initiate_tx_hash: None, // Empty at beginning
            redeem_tx_hash: None, // Empty at beginning
            refund_tx_hash: None, // Empty at beginning
            initiate_block_number: None, // Empty at beginning
            redeem_block_number: None, // Empty at beginning
            refund_block_number: None, // Empty at beginning
            deposit_address : None
        };
        
        // Create the complete MatchedOrder
        let matched_order = MatchedOrder {
            id: None, // Will be set by MongoDB
            created_at: now,
            source_swap,
            destination_swap,
            create_order,
        };
        
        Ok(matched_order)
    }
    
    fn parse_chain_asset(chain_asset: &str) -> Result<(String, String)> {
        let parts: Vec<&str> = chain_asset.split(':').collect();
        if parts.len() != 2 {
            return Err(anyhow!("Invalid format: expected 'chain:asset', got '{}'", chain_asset));
        }
        Ok((parts[0].to_string(), parts[1].to_string()))
    }
    
    fn generate_create_id() -> String {
        let mut rng = rand::thread_rng();
        let bytes: [u8; 32] = rng.gen();
        hex::encode(bytes)
    }
    
    fn generate_evm_swap_id(
        &self,
        chain_id: &str,
        secret_hash: &str,
        initiator: &str,
        redeemer: &str,
        timelock: i32,
        amount: &str,
        htlc_address: &str,
    ) -> Result<String> {
        let chain_id_num: u64 = chain_id.parse()?;
        let chain_id_big = BigUint::from(chain_id_num);
        let chain_id_bytes = chain_id_big.to_bytes_be();
        let chain_id_padded = Self::left_pad_bytes(&chain_id_bytes, 32);

        let secret_hash_padded = Self::decode_and_pad_hex(secret_hash, 32)?;
        let initiator_bytes = Self::hex_to_hash(initiator)?;
        let mut data = Vec::new();
        data.extend(chain_id_padded);
        data.extend(secret_hash_padded);
        data.extend(initiator_bytes);

        let redeemer_bytes = Self::hex_to_hash(redeemer)?;
        let timelock_bytes = Self::abi_encode_uint256(BigUint::from(timelock as u64));

        let amount_big = BigUint::from_str(amount)
            .map_err(|_| anyhow!("Invalid amount: {}", amount))?;

        let amount_bytes = Self::abi_encode_uint256(amount_big);

        data.extend(redeemer_bytes);
        data.extend(timelock_bytes);
        data.extend(amount_bytes);

        let htlc_address_bytes = Self::hex_to_hash(htlc_address)?;
        data.extend(htlc_address_bytes);

        let hash_result = Sha256::digest(&data);
        Ok(hex::encode(hash_result))
    }
    
    fn left_pad_bytes(bytes: &[u8], length: usize) -> Vec<u8> {
        let mut padded = vec![0u8; length];
        let start = length.saturating_sub(bytes.len());
        padded[start..].copy_from_slice(bytes);
        padded
    }
    
    fn decode_and_pad_hex(hex_str: &str, length: usize) -> Result<Vec<u8>> {
        let decoded = hex::decode(hex_str)?;
        Ok(Self::left_pad_bytes(&decoded, length))
    }
    
    fn hex_to_hash(hex_str: &str) -> Result<Vec<u8>> {
        // Strip 0x prefix if present
        let clean_hex = hex_str.strip_prefix("0x").unwrap_or(hex_str);
        let decoded = hex::decode(clean_hex)?;
        // For addresses (20 bytes), pad to 32 bytes
        if decoded.len() == 20 {
            Ok(Self::left_pad_bytes(&decoded, 32))
        } else if decoded.len() == 32 {
            Ok(decoded)
        } else {
            Err(anyhow!("Expected 20 or 32 bytes, got {}", decoded.len()))
        }
    }
    
    fn abi_encode_uint256(value: BigUint) -> Vec<u8> {
        let mut bytes = value.to_bytes_be();
        if bytes.len() > 32 {
            bytes = bytes[bytes.len() - 32..].to_vec();
        } else {
            bytes = Self::left_pad_bytes(&bytes, 32);
        }
        bytes
    }
    
    fn is_evm_chain(chain: &Chain) -> bool {
        matches!(chain, Chain::ArbitrumSepolia | Chain::AvalancheTestnet)
    }

    fn get_chain_id(chain_identifier: &str) -> &'static str {
        match chain_identifier {
            "arbitrum_sepolia" => "421614",
            "avalanche_testnet" => "43113",
            "bitcoin_testnet" => "18332",
            _ => "0", // Default fallback
        }
    }

    async fn generate_deposit_address(
        &self,
        token: &str,
        chain_identifier: &str,
        secret_hash: &str,
        initiator: &str,
        redeemer: &str,
        timelock: i32,
        amount: &str,
        _htlc_address: &str,
    ) -> Result<Option<String>> {
        // // Determine if this is a Bitcoin chain
        // let is_bitcoin = chain_id == "18332"; // Bitcoin testnet chain ID
        
        // if is_bitcoin {
        //     // Generate Bitcoin HTLC address
        //     let secret_hash_bytes = hex::decode(secret_hash.strip_prefix("0x").unwrap_or(secret_hash))?;
        //     if secret_hash_bytes.len() != 32 {
        //         return Err(anyhow!("Secret hash must be 32 bytes, got {}", secret_hash_bytes.len()));
        //     }
            
        //     let mut secret_hash_array = [0u8; 32];
        //     secret_hash_array.copy_from_slice(&secret_hash_bytes);
            
        //     // For Bitcoin, we need to derive public keys from addresses
        //     // This is a simplified approach - in production you'd need proper key derivation
        //     let initiator_pubkey = XOnlyPublicKey::from_str(initiator)
        //         .map_err(|_| anyhow!("Invalid initiator public key: {}", initiator))?;
        //     let redeemer_pubkey = XOnlyPublicKey::from_str(redeemer)
        //         .map_err(|_| anyhow!("Invalid redeemer public key: {}", redeemer))?;
            
        //     let htlc_params = HTLCParams {
        //         secret_hash: secret_hash_array,
        //         redeemer_pubkey,
        //         initiator_pubkey,
        //         timelock: timelock as u32,
        //     };
            
        //     let bitcoin_address = get_htlc_address(&htlc_params, Network::Testnet).map_err(|e| anyhow!("Failed to generate Bitcoin HTLC address: {}", e))?;
        //     Ok(Some(bitcoin_address.to_string()))
        // } else {
            // For EVM chains, generate a deterministic placeholder deposit address
            // In the real implementation, this would call the registry contract
            let token_address = Address::from_str(token).map_err(|e| anyhow!("Invalid token address: {}", e))?;
            let refund_address = Address::from_str(initiator).map_err(|e| anyhow!("Invalid redeemer address: {}", e))?;
            let redeemer_address = Address::from_str(redeemer).map_err(|e| anyhow!("Invalid redeemer address: {}", e))?;
            let registry = self.evm_registries.get(chain_identifier).ok_or_else(|| anyhow!("Registry not found for chain ID: {}", chain_identifier))?;
            let timelock = U256::from(timelock as u64);
            let amount = U256::from_str(amount).map_err(|e| anyhow!("Invalid amount: {}", e))?;
            let secret_hash_bytes = FixedBytes::from_hex(secret_hash)?;
            let deposit_address = registry.getERC20Address(token_address, refund_address, redeemer_address, timelock, amount, secret_hash_bytes).call().await?;
            // let call_data = registry.getERC20Address(token_address, refund_address, redeemer_address, timelock, amount, secret_hash_bytes).calldata().clone();
            // dbg!(&call_data);
            let res = deposit_address.to_string();
            dbg!(&res);
            Ok(Some(res))


        // }
    }
}

impl std::str::FromStr for Chain {
    type Err = anyhow::Error;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "bitcoin_testnet" => Ok(Chain::BitcoinTestnet),
            "arbitrum_sepolia" => Ok(Chain::ArbitrumSepolia),
            "avalanche_testnet" => Ok(Chain::AvalancheTestnet),
            _ => Err(anyhow!("Unknown chain: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evm_swap_id_generation() {
        let config = AppConfig::from_file("config.json").unwrap();
        let service = OrderService::new(config, HashMap::new());

        // Test case for arbitrum_v3 with 0x prefixes
        let chain_id = "421614";
        let initiator_address_with_prefix = "0x5A6A32dE366b917A594342B28530d53708f2881c";
        let redeemer_address_with_prefix = "0x29f72597ca8a21F9D925AE9527ec5639bAFD5075";
        let timelock = 432000;
        let secret_hash = "a201be6510790b5b1ebab36fc5e0ee5db382f1afb7850d1444e80952c58edcd8";
        let amount = "50000";
        let htlc_address_with_prefix = "0xb8cEf87D2E4521d24627322FBE773D4F7e91c95E";
        let expected_swap_id = "493b59eacab2cdbf02ea90a4c9b38cc1524d60ce4565627c8218f39f967f969a";

        // Test with 0x prefixes
        let generated_swap_id_with_prefix = service.generate_evm_swap_id(
            chain_id,
            secret_hash,
            initiator_address_with_prefix,
            redeemer_address_with_prefix,
            timelock,
            amount,
            htlc_address_with_prefix,
        ).unwrap();

        assert_eq!(generated_swap_id_with_prefix, expected_swap_id);
    }
}
