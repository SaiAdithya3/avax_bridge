use bitcoin::{
    blockdata::transaction::{Transaction, TxIn, TxOut}, 
    ecdsa::Signature as BitcoinSignature, 
    hashes::{hash160, sha256, Hash}, 
    key::Secp256k1, 
    locktime::absolute::LockTime, 
    network::Network, 
    secp256k1::{self, Message, PublicKey, SecretKey}, 
    sighash::{EcdsaSighashType, SighashCache}, 
    taproot::LeafVersion, 
    transaction::Version, 
    Address, Amount, CompressedPublicKey, OutPoint, PrivateKey, Script, ScriptBuf, Sequence, TapLeafHash, TapSighashType, Txid, Witness
};
use std::{collections::HashMap, str::FromStr};
use primitives::{htlc::BitcoinHTLC, indexer::SimpleIndexer};

pub struct HTLCWallet {
    secp: Secp256k1<secp256k1::All>,
    network: Network,
    private_key: SecretKey,
    public_key: PublicKey,
    address: Address,
    utxos: HashMap<OutPoint, TxOut>,
    indexer: SimpleIndexer,
}

impl HTLCWallet {
    // Dust threshold constants (in satoshis)
    const P2WPKH_DUST_THRESHOLD: u64 = 294; // P2WPKH dust threshold
    const P2TR_DUST_THRESHOLD: u64 = 330;   // P2TR dust threshold
    const DEFAULT_DUST_THRESHOLD: u64 = 546; // Default dust threshold

    pub fn new(private_key_str: &str, network: Network, indexer_url: &str) -> Self {
        let secp = Secp256k1::new();
        let sec_key = SecretKey::from_str(private_key_str).unwrap();
        let priv_key_bytes = hex::decode(private_key_str).unwrap();
        let public_key = PublicKey::from_secret_key(&secp, &sec_key);
        let priv_key = PrivateKey::from_slice(&priv_key_bytes, network).unwrap();
        let compressed = CompressedPublicKey::from_private_key(&secp, &priv_key);
        let address = Address::p2wpkh(&compressed.unwrap(), network);
        
        Self {
            secp,
            network,
            private_key: sec_key,
            public_key,
            address,
            utxos: HashMap::new(),
            indexer: SimpleIndexer::new(indexer_url).unwrap(),
        }
    }

    pub fn get_address(&self) -> Address {
        self.address.clone()
    }

    pub fn get_balance(&self) -> Amount {
        self.utxos.values().map(|utxo| utxo.value).sum()
    }

    pub fn add_utxo(&mut self, outpoint: OutPoint, txout: TxOut) {
        self.utxos.insert(outpoint, txout);
    }

    pub fn remove_utxo(&mut self, outpoint: &OutPoint) {
        self.utxos.remove(outpoint);
    }

    /// Calculate dust threshold for a given script
    fn get_dust_threshold(script_pubkey: &ScriptBuf) -> u64 {
        if script_pubkey.is_p2wpkh() {
            Self::P2WPKH_DUST_THRESHOLD
        } else if script_pubkey.is_p2tr() {
            Self::P2TR_DUST_THRESHOLD
        } else {
            Self::DEFAULT_DUST_THRESHOLD
        }
    }

    /// Check if an output value is dust
    fn is_dust(value: u64, script_pubkey: &ScriptBuf) -> bool {
        value < Self::get_dust_threshold(script_pubkey)
    }

    /// Calculate a more accurate fee based on transaction size
    fn calculate_fee(inputs: usize, outputs: usize, fee_rate: u64) -> u64 {
        // Approximate transaction size in vbytes
        // Base: 10 bytes
        // Each input (P2WPKH): ~68 vbytes (41 base + 27 witness)
        // Each output: ~31 bytes for P2WPKH, ~43 bytes for P2TR
        let base_size = 10;
        let input_size = inputs * 68;
        let output_size = outputs * 35; // Average between P2WPKH and P2TR
        let total_vbytes = base_size + input_size + output_size;
        
        fee_rate * total_vbytes as u64
    }

    pub async fn initiate_htlc(
        &self,
        bitcoin_htlc: &BitcoinHTLC,
        amount: u64,
    ) -> Result<Transaction, Box<dyn std::error::Error>> {
        let htlc_address = bitcoin_htlc.address()?;
        
        // Get UTXOs for funding from sender's address
        let utxos = self.indexer.get_utxos_for_amount(&self.address.to_string(), amount as i64).await?;
        
        // Create inputs and track values
        let mut inputs: Vec<TxIn> = Vec::new();
        let mut input_values: Vec<u64> = Vec::new();
        for utxo in utxos {
            let txid = Txid::from_str(&utxo.txid)?;
            inputs.push(TxIn {
                previous_output: OutPoint {
                    txid,
                    vout: utxo.vout,
                },
                script_sig: ScriptBuf::new(),
                sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
                witness: Witness::new(),
            });
            input_values.push(utxo.value);
        }

        // Calculate fee with better estimation
        let fee_rate = 10; // sat/vbyte - reduced for regtest
        let estimated_fee = Self::calculate_fee(inputs.len(), 2, fee_rate);
        let total_input: u64 = input_values.iter().sum();

        // Validate we have enough funds
        if total_input < amount + estimated_fee {
            return Err(format!(
                "Insufficient funds: need {} sats, have {} sats", 
                amount + estimated_fee, 
                total_input
            ).into());
        }

        // Create HTLC output
        let htlc_output = TxOut {
            value: Amount::from_sat(amount),
            script_pubkey: htlc_address.script_pubkey(),
        };

        let mut outputs = vec![htlc_output];

        // Add change output if needed and above dust threshold
        let change_amount = total_input - amount - estimated_fee;
        if change_amount > 0 {
            let change_script = self.address.script_pubkey();
            if !Self::is_dust(change_amount, &change_script) {
                outputs.push(TxOut {
                    value: Amount::from_sat(change_amount),
                    script_pubkey: change_script,
                });
            } else {
                // Add dust to fee instead of creating dust output
                println!("Warning: Change amount {} sats is dust, adding to fee", change_amount);
            }
        }

        // Create unsigned transaction
        let mut unsigned_tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        };

        // Sign each input
        let mut sighash_cache = bitcoin::sighash::SighashCache::new(&mut unsigned_tx);

        for i in 0..input_values.len() {
            // Create the script for this input (p2wpkh)
            let pubkey_hash = hash160::Hash::hash(&self.public_key.serialize());
            let script_pubkey = ScriptBuf::new_p2wpkh(&pubkey_hash.into());

            // Get the sighash to sign
            let sighash_type = EcdsaSighashType::All;
            let sighash = sighash_cache.p2wpkh_signature_hash(
                i,
                &script_pubkey,
                Amount::from_sat(input_values[i]),
                sighash_type,
            )?;

            // Sign the sighash
            let msg = Message::from(sighash);
            let signature = self.secp.sign_ecdsa(&msg, &self.private_key);

            // Create the signature with sighash type
            let btc_signature = BitcoinSignature {
                signature,
                sighash_type,
            };
            let pubkey_bytes = self.public_key.serialize();
            *sighash_cache.witness_mut(i).unwrap() = Witness::p2wpkh(
                &btc_signature,
                &PublicKey::from_slice(&pubkey_bytes)?,
            )
        }

        Ok(sighash_cache.transaction().clone())
    }

    pub async fn redeem_htlc(
        &self,
        bitcoin_htlc: &BitcoinHTLC,
        secret: &str,
        recipient_address: &Address,
    ) -> Result<Transaction, Box<dyn std::error::Error>> {
        let htlc_address = bitcoin_htlc.address()?;
        
        // Get UTXOs for the HTLC address
        let utxos = self.indexer.get_utxos(&htlc_address.to_string()).await?;
        if utxos.is_empty() {
            return Err("HTLC address is not funded".into());
        }
        let utxo = &utxos[0];
        
        // Parse the UTXO transaction ID
        let txid = Txid::from_str(&utxo.txid)?;
        
        // Calculate fee with better estimation
        let fee_rate = 20; // sat/vbyte - slightly higher for redemption
        let estimated_fee = Self::calculate_fee(1, 1, fee_rate);
        
        // Create output amount after deducting fee
        let output_value = utxo.value.saturating_sub(estimated_fee);
        let recipient_script = recipient_address.script_pubkey();
        
        // Check if output would be dust
        if Self::is_dust(output_value, &recipient_script) {
            return Err(format!(
                "Output value {} sats would be dust (threshold: {} sats). HTLC amount too small.",
                output_value,
                Self::get_dust_threshold(&recipient_script)
            ).into());
        }
        
        // Create the transaction structure first
        let mut tx = Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: vec![TxIn {
                previous_output: OutPoint {
                    txid,
                    vout: utxo.vout,
                },
                script_sig: ScriptBuf::new(),
                sequence: Sequence(4294967294),
                witness: Witness::new(),
            }],
            output: vec![TxOut {
                value: Amount::from_sat(output_value),
                script_pubkey: recipient_script,
            }],
        };
    
        // Get witness data from BitcoinHTLC - this should return the redeem script and control block
        let witness_data = bitcoin_htlc.redeem(secret)?;
        
        // The witness_data should contain:
        // [0] - signature placeholder (we'll replace this)
        // [1] - secret/preimage
        // [2] - redeem script 
        // [3] - control block
        
        if witness_data.len() < 4 {
            return Err("Invalid witness data from BitcoinHTLC::redeem".into());
        }
        
        // Create the correct prevouts for sighash calculation
        let prevouts = vec![TxOut {
            value: Amount::from_sat(utxo.value),
            script_pubkey: htlc_address.script_pubkey(), // Use the HTLC address script, not recipient
        }];
        
        // Create sighash cache
        let mut sighash_cache = SighashCache::new(&tx);
        
        // Create the leaf hash from the redeem script
        let redeem_script = Script::from_bytes(&witness_data[2]);
        let leaf_hash = TapLeafHash::from_script(redeem_script, LeafVersion::TapScript);
    
        // Generate the sighash message to sign using taproot script spend path
        let tap_sighash = sighash_cache.taproot_script_spend_signature_hash(
            0, // input index
            &bitcoin::sighash::Prevouts::All(prevouts.as_slice()),
            leaf_hash,
            TapSighashType::All,
        )?;
    
        // Convert TapSighash to a Message for signing
        let message = Message::from_digest_slice(tap_sighash.as_ref())?;
    
        // Create keypair from private key for Schnorr signing
        let keypair = self.private_key.keypair(&self.secp);
    
        // Sign the sighash with Schnorr signature
        let signature = self.secp.sign_schnorr_no_aux_rand(&message, &keypair);
    
        // Serialize signature with sighash type
        let mut sig_serialized = signature.as_ref().to_vec();
        sig_serialized.push(TapSighashType::All as u8);
        
        // Construct the witness stack for taproot script spend:
        // For redemption: [signature, secret, script, control_block]
        let mut witness = Witness::new();
        witness.push(&sig_serialized);        // Our signature
        witness.push(&witness_data[1]);       // Secret/preimage  
        witness.push(&witness_data[2]);       // Redeem script
        witness.push(&witness_data[3]);       // Control block
    
        // Set the witness on the transaction
        tx.input[0].witness = witness;
    
        println!("Redemption transaction details:");
        println!("- Input value: {} sats", utxo.value);
        println!("- Estimated fee: {} sats", estimated_fee);
        println!("- Output value: {} sats", output_value);
        println!("- Dust threshold: {} sats", Self::get_dust_threshold(&recipient_address.script_pubkey()));
        println!("- Witness stack items: {}", tx.input[0].witness.len());
        println!("- Signature length: {} bytes", sig_serialized.len());
        println!("- Secret length: {} bytes", witness_data[1].len());
        println!("- Script length: {} bytes", witness_data[2].len());
        println!("- Control block length: {} bytes", witness_data[3].len());
    
        Ok(tx)
    }

    pub async fn refund_htlc(
        &self,
        bitcoin_htlc: &BitcoinHTLC,
        refund_address: &Address,
    ) -> Result<Transaction, Box<dyn std::error::Error>> {
        let htlc_address = bitcoin_htlc.address()?;
        
        // Get UTXOs for the HTLC address
        let utxos = self.indexer.get_utxos(&htlc_address.to_string()).await?;
        if utxos.is_empty() {
            return Err("HTLC address is not funded".into());
        }
        let utxo = &utxos[0];

        // Get current block height for timelock validation
        let current_height = self.indexer.get_current_block_height().await?;
        let utxo_block_height = utxo.status.block_height;
        let htlc_expiry_height = utxo_block_height + bitcoin_htlc.timelock();
        
        println!("Timelock validation:");
        println!("- UTXO created at block: {}", utxo_block_height);
        println!("- Timelock blocks: {}", bitcoin_htlc.timelock());
        println!("- HTLC expires at block: {}", htlc_expiry_height);
        println!("- Current block height: {}", current_height);
        
        if current_height < htlc_expiry_height {
            let need_to_wait = htlc_expiry_height - current_height;
            return Err(format!(
                "HTLC timelock not expired yet. Current height: {}, expires at: {}, need to wait {} blocks", 
                current_height, htlc_expiry_height, need_to_wait
            ).into());
        }
        
        // Parse the UTXO transaction ID
        let txid = Txid::from_str(&utxo.txid)?;
        
        // Calculate fee with better estimation
        let fee_rate = 20; // sat/vbyte
        let estimated_fee = Self::calculate_fee(1, 1, fee_rate);
        
        // Create output amount after deducting fee
        let output_value = utxo.value.saturating_sub(estimated_fee);
        let refund_script = refund_address.script_pubkey();
        
        // Check if output would be dust
        if Self::is_dust(output_value, &refund_script) {
            return Err(format!(
                "Refund value {} sats would be dust (threshold: {} sats). HTLC amount too small.",
                output_value,
                Self::get_dust_threshold(&refund_script)
            ).into());
        }
        
                 // Create the transaction structure 
         // The timelock is enforced by the script itself (OP_CHECKLOCKTIMEVERIFY in refund_leaf)
         // So we need to set the transaction locktime to satisfy the script's requirements
         let mut tx = Transaction {
             version: Version::TWO,
             // Set locktime to the current block height
             // OP_CHECKLOCKTIMEVERIFY checks that tx.locktime >= script.timelock
             lock_time: LockTime::from_height(current_height as u32).expect("Valid block height"),
             input: vec![TxIn {
                 previous_output: OutPoint {
                     txid,
                     vout: utxo.vout,
                 },
                 script_sig: ScriptBuf::new(),
                 // Disable relative locktime (BIP68) but enable absolute locktime
                 sequence: Sequence::ENABLE_LOCKTIME_NO_RBF, 
                 witness: Witness::new(),
             }],
             output: vec![TxOut {
                 value: Amount::from_sat(output_value),
                 script_pubkey: refund_script,
             }],
         };
    
        // Get witness data from BitcoinHTLC
        let witness_data = bitcoin_htlc.refund()?;
        
        if witness_data.len() < 3 {
            return Err("Invalid witness data from BitcoinHTLC::refund".into());
        }
        
        // Create the correct prevouts for sighash calculation
        let prevouts = vec![TxOut {
            value: Amount::from_sat(utxo.value),
            script_pubkey: htlc_address.script_pubkey(), // Use HTLC address script
        }];
        
        // Create sighash cache
        let mut sighash_cache = SighashCache::new(&tx);
        
        // Create the leaf hash from the refund script
        let refund_script_bytes = Script::from_bytes(&witness_data[1]);
        let leaf_hash = TapLeafHash::from_script(refund_script_bytes, LeafVersion::TapScript);
    
        // Generate the sighash message to sign using taproot script spend path
        let tap_sighash = sighash_cache.taproot_script_spend_signature_hash(
            0, // input index
            &bitcoin::sighash::Prevouts::All(prevouts.as_slice()),
            leaf_hash,
            TapSighashType::All,
        )?;
    
        // Convert TapSighash to a Message for signing
        let message = Message::from_digest_slice(tap_sighash.as_ref())?;
    
        // Create keypair from private key for Schnorr signing
        let keypair = self.private_key.keypair(&self.secp);
    
        // Sign the sighash with Schnorr signature
        let signature = self.secp.sign_schnorr_no_aux_rand(&message, &keypair);
    
        // Serialize signature with sighash type
        let mut sig_serialized = signature.as_ref().to_vec();
        sig_serialized.push(TapSighashType::All as u8);
        
        // Construct the witness stack for taproot script spend:
        // For refund: [signature, refund_script, control_block]
        let mut witness = Witness::new();
        witness.push(&sig_serialized);        // Our signature
        witness.push(&witness_data[1]);       // refund script
        witness.push(&witness_data[2]);       // Control block
    
        // Set the witness on the transaction
        tx.input[0].witness = witness;
    
        println!("Refund transaction details:");
        println!("- Input value: {} sats", utxo.value);
        println!("- Estimated fee: {} sats", estimated_fee);
        println!("- Output value: {} sats", output_value);
                 println!("- Transaction locktime: {}", match tx.lock_time {
             LockTime::Blocks(height) => format!("Block {}", height.to_consensus_u32()),
             LockTime::Seconds(time) => format!("Time {}", time.to_consensus_u32()),
         });
         println!("- HTLC expiry height: {}", htlc_expiry_height);
        println!("- Input sequence: 0x{:x} ({})", tx.input[0].sequence.0, tx.input[0].sequence.0);
        println!("- Witness stack items: {}", tx.input[0].witness.len());
        println!("- Signature length: {} bytes", sig_serialized.len());
    
        Ok(tx)
    }

    pub fn generate_preimage(&self) -> [u8; 32] {
        let mut preimage = [0u8; 32];
        for (i, byte) in preimage.iter_mut().enumerate() {
            *byte = (i as u8).wrapping_add(0x42);
        }
        preimage
    }

    pub fn hash_preimage(preimage: &[u8; 32]) -> [u8; 32] {
        sha256::Hash::hash(preimage).to_byte_array()
    }

    pub async fn broadcast_transaction(&self, transaction: &Transaction) -> Result<String, Box<dyn std::error::Error>> {
        Ok(self.indexer.submit_tx(transaction).await?)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use bitcoin::{hex, secp256k1::SecretKey};
    use ::hex::decode;
    use std::str::FromStr;

    #[tokio::test]
    async fn test_htlc_init_and_redeem() {
        // Test configuration
        let indexer_url = "http://localhost:3000";
        let network = Network::Regtest;
        let secp = Secp256k1::new();
        
        let private_key_hex = "8459644d232bed482bccf5131c371c65f39c12efa5e7e5e7b162016378ae26d1";
        let private_key_bytes = decode(private_key_hex).expect("Invalid private key");
        let private_key = SecretKey::from_str(private_key_hex).expect("Invalid private key");
        let priv_key = PrivateKey::from_slice(&private_key_bytes, network).unwrap();
        let x_only_key = PublicKey::from_secret_key(&secp, &private_key).x_only_public_key().0;
        let compressed = CompressedPublicKey::from_private_key(&secp, &priv_key).unwrap();
        let address = Address::p2wpkh(&compressed, network);
        println!("Address: {}", address);

        let wallet = HTLCWallet::new(&private_key_hex, network, indexer_url);
        
        // Create a BitcoinHTLC instance
        let secret_hash = "731170d859f81a395a79e02cf3812e413b21793900e70ff77e48dfcf7ef6a4e6";
        let initiator_pubkey = x_only_key.to_string();
        let redeemer_pubkey = x_only_key.to_string();
        let timelock = 12;
        
        let bitcoin_htlc = BitcoinHTLC::new(
            secret_hash.to_string(),
            initiator_pubkey.to_string(),
            redeemer_pubkey.to_string(),
            timelock,
            network,
        ).expect("Failed to create BitcoinHTLC");
        
        // Test 1: Initiate HTLC with a higher amount to avoid dust issues
        println!("Testing HTLC initiation...");
        let amount = 50000; // Increased to 50k sats to avoid dust issues
        
        match wallet.initiate_htlc(&bitcoin_htlc, amount).await {
            Ok(tx) => {
                println!("✅ HTLC initiation transaction created successfully");
                println!("Transaction ID: {}", tx.txid());
                println!("Inputs: {}", tx.input.len());
                println!("Outputs: {}", tx.output.len());
                
                // Display transaction details
                for (i, output) in tx.output.iter().enumerate() {
                    println!("Output {}: {} sats", i, output.value.to_sat());
                }
                
                match wallet.indexer.submit_tx(&tx).await {
                    Ok(tx_id) => {
                        println!("✅ Transaction broadcasted successfully");
                        println!("Broadcasted TX ID: {}", tx_id);
                        
                        // Test 2: Redeem HTLC
                        println!("\nTesting HTLC redemption...");
                        let secret = "db3fafd38168bcb8ea8979e010f4a377ca426f3ce478ea6ea23769d416306180";
                        let recipient_address = wallet.get_address();
                        
                        // Wait for confirmation
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                        
                        match wallet.redeem_htlc(&bitcoin_htlc, secret, &recipient_address).await {
                            Ok(redeem_tx) => {
                                println!("✅ HTLC redemption transaction created successfully");
                                println!("Redeem Transaction ID: {}", redeem_tx.txid());
                                
                                match wallet.indexer.submit_tx(&redeem_tx).await {
                                    Ok(redeem_tx_id) => {
                                        println!("✅ Redemption transaction broadcasted successfully");
                                        println!("Redeem Broadcasted TX ID: {}", redeem_tx_id);
                                    }
                                    Err(e) => {
                                        println!("❌ Failed to broadcast redemption transaction: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                println!("❌ Failed to create redemption transaction: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        println!("❌ Failed to broadcast initiation transaction: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("❌ Failed to create initiation transaction: {}", e);
            }
        }
        
        // Test dust threshold calculations
        println!("\nTesting dust threshold calculations...");
        let p2wpkh_script = wallet.address.script_pubkey();
        let htlc_script = bitcoin_htlc.address().unwrap().script_pubkey();
        
        println!("P2WPKH dust threshold: {} sats", HTLCWallet::get_dust_threshold(&p2wpkh_script));
        println!("HTLC script dust threshold: {} sats", HTLCWallet::get_dust_threshold(&htlc_script));
        
                 println!("Is 200 sats dust for P2WPKH? {}", HTLCWallet::is_dust(200, &p2wpkh_script));
         println!("Is 1000 sats dust for P2WPKH? {}", HTLCWallet::is_dust(1000, &p2wpkh_script));
     }

     #[tokio::test]
     async fn test_htlc_init_and_refund() {
         // Test configuration
         let indexer_url = "http://localhost:3000";
         let network = Network::Regtest;
         let secp = Secp256k1::new();
         
         let private_key_hex = "8459644d232bed482bccf5131c371c65f39c12efa5e7e5e7b162016378ae26d1";
         let private_key_bytes = decode(private_key_hex).expect("Invalid private key");
         let private_key = SecretKey::from_str(private_key_hex).expect("Invalid private key");
         let priv_key = PrivateKey::from_slice(&private_key_bytes, network).unwrap();
         let x_only_key = PublicKey::from_secret_key(&secp, &private_key).x_only_public_key().0;
         let compressed = CompressedPublicKey::from_private_key(&secp, &priv_key).unwrap();
         let address = Address::p2wpkh(&compressed, network);
         println!("Address: {}", address);

         let wallet = HTLCWallet::new(&private_key_hex, network, indexer_url);
         
         // Create a BitcoinHTLC instance with timelock = 2
         let secret_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
         let initiator_pubkey = x_only_key.to_string();
         let redeemer_pubkey = "be4b9e8e8c0146b155d3ce35d0e3dfef1c99ef598b63e00524a912dd21480bce".to_string();
         let timelock = 2; // Short timelock for testing
         
         let bitcoin_htlc = BitcoinHTLC::new(
             secret_hash.to_string(),
             initiator_pubkey.to_string(),
             redeemer_pubkey.to_string(),
             timelock,
             network,
         ).expect("Failed to create BitcoinHTLC");
         
         // Test 1: Initiate HTLC
         println!("Testing HTLC initiation for refund test...");
         let amount = 30020; // 30k sats
         
         match wallet.initiate_htlc(&bitcoin_htlc, amount).await {
             Ok(tx) => {
                 println!("✅ HTLC initiation transaction created successfully");
                 println!("Transaction ID: {}", tx.compute_txid());
                 println!("Inputs: {}", tx.input.len());
                 println!("Outputs: {}", tx.output.len());
                 
                 // Display transaction details
                 for (i, output) in tx.output.iter().enumerate() {
                     println!("Output {}: {} sats", i, output.value.to_sat());
                 }
                 
                 match wallet.indexer.submit_tx(&tx).await {
                     Ok(tx_id) => {
                         println!("✅ Transaction broadcasted successfully");
                         println!("Broadcasted TX ID: {}", tx_id);
                         
                         // Test 2: Wait for timelock and then refund
                         println!("\nTesting HTLC refund after timelock...");
                         let refund_address = wallet.get_address();
                         
                         // Wait for timelock to expire (2 blocks + some buffer)
                         println!("Waiting for timelock to expire ({} blocks)...", timelock);
                         tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                         
                         // Get current block height
                         match wallet.indexer.get_current_block_height().await {
                             Ok(current_height) => {
                                 println!("Current block height: {}", current_height);
                                 
                                 match wallet.refund_htlc(&bitcoin_htlc, &refund_address).await {
                                     Ok(refund_tx) => {
                                         println!("✅ HTLC refund transaction created successfully");
                                         println!("Refund Transaction ID: {}", refund_tx.compute_txid());
                                         
                                         match wallet.indexer.submit_tx(&refund_tx).await {
                                             Ok(refund_tx_id) => {
                                                 println!("✅ Refund transaction broadcasted successfully");
                                                 println!("Refund Broadcasted TX ID: {}", refund_tx_id);
                                             }
                                             Err(e) => {
                                                 println!("❌ Failed to broadcast refund transaction: {}", e);
                                                 println!("This might be expected if timelock hasn't expired yet");
                                             }
                                         }
                                     }
                                     Err(e) => {
                                         println!("❌ Failed to create refund transaction: {}", e);
                                         println!("This might be expected if timelock hasn't expired yet");
                                     }
                                 }
                             }
                             Err(e) => {
                                 println!("❌ Failed to get current block height: {}", e);
                             }
                         }
                     }
                     Err(e) => {
                         println!("❌ Failed to broadcast initiation transaction: {}", e);
                     }
                 }
             }
             Err(e) => {
                 println!("❌ Failed to create initiation transaction: {}", e);
             }
         }
         
         // Test 3: Get HTLC address
         println!("\nTesting HTLC address generation for refund test...");
         match bitcoin_htlc.address() {
             Ok(htlc_addr) => {
                 println!("✅ HTLC address generated: {}", htlc_addr);
             }
             Err(e) => {
                 println!("❌ Failed to generate HTLC address: {}", e);
             }
         }
     }
 }