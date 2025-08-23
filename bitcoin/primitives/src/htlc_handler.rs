use std::str::FromStr;

use anyhow::{anyhow, Context, Result};
use bitcoin::{
    absolute::LockTime,
    key::{Keypair, Secp256k1},
    secp256k1::{All, Message},
    sighash::SighashCache,
    taproot::LeafVersion,
    transaction::Version,
    Address, Amount, CompressedPublicKey, EcdsaSighashType, OutPoint, PrivateKey, PublicKey,
    Script, ScriptBuf, Sequence, TapLeafHash, TapSighashType, Transaction, TxIn, TxOut, Txid,
    Witness,
};
use serde::Deserialize;

use crate::indexer::SimpleIndexer;

/// Constants for transaction fees and sizes
const DEFAULT_FEE_RATE_SAT_PER_VBYTE: u64 = 250;
const ESTIMATED_TAPROOT_TX_SIZE_VBYTES: u64 = 200;
const RBF_SEQUENCE: u32 = 0xfffffffd; // ENABLE_RBF_NO_LOCKTIME

/// Handler for HTLC (Hashed Timelock Contract) operations on Bitcoin
pub struct HtlcHandler {
    network: bitcoin::Network,
    indexer: SimpleIndexer,
    secp: Secp256k1<All>,
}

impl HtlcHandler {
    /// Creates a new HTLC handler instance
    ///
    /// # Arguments
    /// * `network` - The Bitcoin network to operate on (mainnet, testnet, etc.)
    /// * `indexer_url` - URL for the Bitcoin indexer service
    ///
    /// # Returns
    /// * `Result<Self>` - The initialized HTLC handler or an error
    pub fn new(network: bitcoin::Network, indexer_url: &str) -> Result<Self> {
        Ok(Self {
            network,
            indexer: SimpleIndexer::new(indexer_url)?,
            secp: Secp256k1::new(),
        })
    }

    /// Broadcasts a transaction to the Bitcoin network
    ///
    /// # Arguments
    /// * `tx` - The transaction to broadcast
    ///
    /// # Returns
    /// * `Result<String>` - The transaction ID or an error
    pub async fn broadcast_tx(&self, tx: &Transaction) -> Result<String> {
        let tx_id = self
            .indexer
            .submit_tx(tx)
            .await
            .context("failed to broadcast transaction")?;
        Ok(tx_id)
    }

    /// Generates a Bitcoin address from a private key
    ///
    /// # Arguments
    /// * `private_key` - The private key to derive the address from
    ///
    /// # Returns
    /// * `Result<String>` - The P2WPKH address or an error
    pub fn get_btc_address_for_priv_key(&self, private_key: &PrivateKey) -> Result<String> {
        let public_key = PublicKey::from_private_key(&self.secp, private_key);
        let compressed_pubkey = CompressedPublicKey::try_from(public_key)?;
        let addr = Address::p2wpkh(&compressed_pubkey, self.network).to_string();
        Ok(addr)
    }

    /// Initiates an HTLC by creating and funding a transaction
    ///
    /// # Arguments
    /// * `private_key` - The sender's private key
    /// * `htlc_addr` - The HTLC address to fund
    /// * `amount` - The amount to send in satoshis
    ///
    /// # Returns
    /// * `Result<Transaction>` - The signed transaction or an error
    pub fn initiate_htlc(
        &self,
        private_key: &PrivateKey,
        htlc_addr: &Address,
        amount: u64,
    ) -> Result<Transaction> {
        let public_key = PublicKey::from_private_key(&self.secp, private_key);
        let compressed_pubkey = CompressedPublicKey::try_from(public_key)?;
        let sender_address = Address::p2wpkh(&compressed_pubkey, self.network);

        // Get UTXOs for funding
        let utxos = self.get_utxos_for_funding(&sender_address, amount)?;

        // Create transaction inputs and outputs
        let (inputs, input_values) = self.create_inputs_from_utxos(&utxos)?;
        let outputs = self.create_outputs_for_htlc(amount, htlc_addr, &sender_address, &input_values)?;

        // Create and sign the transaction
        let mut unsigned_tx = self.create_unsigned_transaction(inputs, outputs);
        self.sign_p2wpkh_transaction(&mut unsigned_tx, &public_key, private_key, &input_values)?;

        Ok(unsigned_tx)
    }

    /// Creates a redeem transaction to spend from an HTLC
    ///
    /// # Arguments
    /// * `htlc_addr` - The HTLC address to spend from
    /// * `witness_stack` - The witness stack for the HTLC script
    /// * `receiver_address` - Optional receiver address (uses private key address if None)
    /// * `private_key` - The private key for signing
    /// * `fee_rate` - Fee rate in satoshis per vbyte
    ///
    /// # Returns
    /// * `Result<Transaction>` - The signed redeem transaction or an error
    pub async fn create_redeem_tx(
        &self,
        htlc_addr: &Address,
        witness_stack: Vec<Vec<u8>>,
        receiver_address: Option<String>,
        private_key: &PrivateKey,
        fee_rate: u64,
    ) -> Result<Transaction> {
        // Determine recipient address
        let recipient = match receiver_address {
            Some(addr) => addr,
            None => self.get_btc_address_for_priv_key(private_key)?,
        };

        // Get HTLC UTXOs
        let utxo = self.get_htlc_utxo(htlc_addr).await?;
        let recipient_addr = self.parse_and_validate_address(&recipient)?;

        // Calculate output value after fees
        let fee = fee_rate * ESTIMATED_TAPROOT_TX_SIZE_VBYTES;
        let output_value = utxo.value.saturating_sub(fee);

        // Create and sign the transaction
        let mut tx = self.create_unsigned_redeem_tx(&utxo, &recipient_addr, output_value)?;
        let leaf_hash = self.create_leaf_hash(&witness_stack[2])?;
        let prevouts = self.create_prevouts_for_signing(htlc_addr, utxo.value);

        tx = self.sign_and_set_taproot_witness(
            tx,
            0,
            leaf_hash,
            private_key,
            TapSighashType::All,
            prevouts,
            witness_stack,
        )?;

        Ok(tx)
    }

    // Private helper methods

    /// Gets UTXOs for funding a transaction
    fn get_utxos_for_funding(&self, sender_address: &Address, amount: u64) -> Result<Vec<UTXO>> {
        let runtime = tokio::runtime::Runtime::new()
            .map_err(|e| anyhow!("Unable to create runtime: {}", e))?;

        runtime.block_on(self.indexer.get_utxos_for_amount(&sender_address.to_string(), amount as i64))
    }

    /// Creates transaction inputs from UTXOs
    fn create_inputs_from_utxos(&self, utxos: &[UTXO]) -> Result<(Vec<TxIn>, Vec<u64>)> {
        let mut inputs = Vec::new();
        let mut input_values = Vec::new();

        for utxo in utxos {
            let txid = Txid::from_str(&utxo.txid)?;
            inputs.push(TxIn {
                previous_output: OutPoint {
                    txid,
                    vout: utxo.vout,
                },
                script_sig: ScriptBuf::new(),
                sequence: Sequence(RBF_SEQUENCE),
                witness: Witness::new(),
            });
            input_values.push(utxo.value);
        }

        Ok((inputs, input_values))
    }

    /// Creates transaction outputs for HTLC funding
    fn create_outputs_for_htlc(
        &self,
        amount: u64,
        htlc_addr: &Address,
        sender_address: &Address,
        input_values: &[u64],
    ) -> Result<Vec<TxOut>> {
        let fee = DEFAULT_FEE_RATE_SAT_PER_VBYTE * input_values.len() as u64;
        let total_input: u64 = input_values.iter().sum();

        let mut outputs = vec![TxOut {
            value: Amount::from_sat(amount),
            script_pubkey: htlc_addr.script_pubkey(),
        }];

        // Add change output if needed
        if total_input > (amount + fee) {
            outputs.push(TxOut {
                value: Amount::from_sat(total_input - amount - fee),
                script_pubkey: sender_address.script_pubkey(),
            });
        }

        Ok(outputs)
    }

    /// Creates an unsigned transaction
    fn create_unsigned_transaction(&self, inputs: Vec<TxIn>, outputs: Vec<TxOut>) -> Transaction {
        Transaction {
            version: Version::TWO,
            lock_time: LockTime::ZERO,
            input: inputs,
            output: outputs,
        }
    }

    /// Signs a P2WPKH transaction
    fn sign_p2wpkh_transaction(
        &self,
        tx: &mut Transaction,
        public_key: &PublicKey,
        private_key: &PrivateKey,
        input_values: &[u64],
    ) -> Result<()> {
        let mut sighash_cache = SighashCache::new(tx);

        for (i, &input_value) in input_values.iter().enumerate() {
            let script_pubkey = ScriptBuf::new_p2wpkh(&public_key.wpubkey_hash()?);
            let sighash_type = EcdsaSighashType::All;
            let sighash = sighash_cache.p2wpkh_signature_hash(
                i,
                &script_pubkey,
                Amount::from_sat(input_value),
                sighash_type,
            )?;

            let msg = Message::from(sighash);
            let signature = self.secp.sign_ecdsa(&msg, &private_key.inner);

            let btc_signature = bitcoin::ecdsa::Signature {
                signature,
                sighash_type,
            };
            let pubkey_bytes = public_key.to_bytes();
            *sighash_cache.witness_mut(i).unwrap() = Witness::p2wpkh(
                &btc_signature,
                &bitcoin::secp256k1::PublicKey::from_slice(&pubkey_bytes)?,
            );
        }

        Ok(())
    }

    /// Gets the UTXO for an HTLC address
    async fn get_htlc_utxo(&self, htlc_addr: &Address) -> Result<UTXO> {
        let htlc_addr_string = htlc_addr.to_string();
        let utxos = self.indexer.get_utxos(&htlc_addr_string).await?;
        
        if utxos.is_empty() {
            return Err(anyhow!("HTLC address is not funded"));
        }
        
        Ok(utxos[0].clone())
    }

    /// Parses and validates a Bitcoin address
    fn parse_and_validate_address(&self, address: &str) -> Result<Address> {
        Address::from_str(address)
            .map_err(|e| anyhow!("Invalid address format: {:?}", e))?
            .require_network(self.network)
            .map_err(|e| anyhow!("Network mismatch: {:?}", e))
    }

    /// Creates an unsigned redeem transaction
    fn create_unsigned_redeem_tx(
        &self,
        utxo: &UTXO,
        recipient_addr: &Address,
        output_value: u64,
    ) -> Result<Transaction> {
        let txid = Txid::from_str(&utxo.txid)?;

        Ok(Transaction {
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
                script_pubkey: recipient_addr.script_pubkey(),
            }],
        })
    }

    /// Creates a leaf hash from script bytes
    fn create_leaf_hash(&self, script_bytes: &[u8]) -> Result<TapLeafHash> {
        Ok(TapLeafHash::from_script(
            Script::from_bytes(script_bytes),
            LeafVersion::TapScript,
        ))
    }

    /// Creates prevouts for signing
    fn create_prevouts_for_signing(&self, htlc_addr: &Address, value: u64) -> Vec<TxOut> {
        vec![TxOut {
            value: Amount::from_sat(value),
            script_pubkey: htlc_addr.script_pubkey(),
        }]
    }

    /// Signs and sets taproot witness for a transaction
    pub fn sign_and_set_taproot_witness(
        &self,
        mut tx: Transaction,
        input_index: usize,
        leaf_hash: TapLeafHash,
        private_key: &PrivateKey,
        sighash_type: TapSighashType,
        prevouts: Vec<TxOut>,
        witness_stack: Vec<Vec<u8>>,
    ) -> Result<Transaction> {
        let secp = Secp256k1::new();
        let keypair = Keypair::from_secret_key(&secp, &private_key.inner);
        let mut sighash_cache = SighashCache::new(&tx);

        let tap_sighash = sighash_cache.taproot_script_spend_signature_hash(
            input_index,
            &bitcoin::sighash::Prevouts::All(prevouts.as_slice()),
            leaf_hash,
            sighash_type,
        )?;

        let message = Message::from_digest_slice(tap_sighash.as_ref())?;
        let signature = secp.sign_schnorr_no_aux_rand(&message, &keypair);

        let mut sig_serialized = signature.as_ref().to_vec();
        if sighash_type != TapSighashType::Default {
            sig_serialized.push(sighash_type as u8);
        }

        let mut witness = Witness::new();
        witness.push(sig_serialized);
        witness.push(&witness_stack[1]);
        witness.push(&witness_stack[2]);
        witness.push(&witness_stack[3]);

        tx.input[input_index].witness = witness;

        Ok(tx)
    }
}

/// Represents an Unspent Transaction Output (UTXO)
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct UTXO {
    pub txid: String,
    pub vout: u32,
    pub status: Status,
    pub value: u64,
}

/// Represents the status of a transaction
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct Status {
    pub confirmed: bool,
    #[serde(default)]
    pub block_height: u64,
    #[serde(default)]
    pub block_hash: String,
    #[serde(default)]
    pub block_time: u64,
}
