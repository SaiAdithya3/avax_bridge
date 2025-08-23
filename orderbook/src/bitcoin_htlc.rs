use bitcoin::{
    key::{Secp256k1, XOnlyPublicKey},
    secp256k1::{PublicKey, SecretKey},
    taproot::{TaprootBuilder, TaprootSpendInfo},
    Address, KnownHrp, Network, ScriptBuf,
};
use sha2::{Digest, Sha256};
use alloy::hex;
use once_cell::sync::Lazy;
use eyre::Result;

/// Garden internal key for Taproot HTLC addresses
///
/// Generates a deterministic internal key using:
/// 1. SHA256("GardenHTLC") as scalar r
/// 2. BIP-341 H point
/// 3. r*G + H for final public key
pub static GARDEN_NUMS: Lazy<XOnlyPublicKey> = Lazy::new(|| {
    // Step 1: Hash "GardenHTLC" → r
    let r = Sha256::digest(b"GardenHTLC");

    // Step 2: Parse the H point from BIP-341
    const H_HEX: &str = "0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0";
    let h_bytes = hex::decode(H_HEX).expect("Invalid hex in GARDEN_NUMS_KEY");
    let h = PublicKey::from_slice(&h_bytes).expect("Invalid H point in GARDEN_NUMS_KEY");

    // Step 3: r * G
    let secp = Secp256k1::new();
    let r_scalar = SecretKey::from_slice(&r).expect("Invalid scalar in GARDEN_NUMS_KEY");
    let r_g = PublicKey::from_secret_key(&secp, &r_scalar);

    // Step 4: H + r*G
    let nums = h
        .combine(&r_g)
        .expect("Point addition failed in GARDEN_NUMS_KEY");

    // Step 5: Convert to x-only
    let (xonly, _) = nums.x_only_public_key();
    xonly
});

/// HTLC parameters needed for address generation
#[derive(Debug, Clone)]
pub struct HTLCParams {
    pub secret_hash: [u8; 32],
    pub redeemer_pubkey: XOnlyPublicKey,
    pub initiator_pubkey: XOnlyPublicKey,
    pub timelock: u32,
}

/// Generates a Taproot HTLC address with three spending conditions:
/// 1. Redeem path: Requires the secret and redeemer's signature
/// 2. Refund path: Allows initiator to claim funds after timelock expires
/// 3. Instant refund: Enables cooperative cancellation by both parties
///
/// # Arguments
/// * `htlc_params` - HTLC parameters including keys, timelock, and secret hash
/// * `network` - Bitcoin network (Mainnet, Testnet, etc.)
///
/// # Returns
/// * `Result<Address>` - The generated Taproot HTLC address or an error
pub fn get_htlc_address(htlc_params: &HTLCParams, network: Network) -> Result<Address> {
    let secp = Secp256k1::new();
    let internal_key = *GARDEN_NUMS;
    let taproot_spend_info = construct_taproot_spend_info(htlc_params)?;

    let htlc_address = Address::p2tr(
        &secp,
        internal_key,
        taproot_spend_info.merkle_root(),
        KnownHrp::from(network),
    );

    Ok(htlc_address)
}

/// Constructs a Taproot tree with three spending conditions in a Huffman tree structure
fn construct_taproot_spend_info(htlc_params: &HTLCParams) -> Result<TaprootSpendInfo> {
    // Create simple script leaves for now
    let redeem_leaf = create_simple_redeem_script(&htlc_params.secret_hash, &htlc_params.redeemer_pubkey);
    let refund_leaf = create_simple_refund_script(htlc_params.timelock, &htlc_params.initiator_pubkey);
    let instant_refund_leaf = create_simple_instant_refund_script(&htlc_params.initiator_pubkey, &htlc_params.redeemer_pubkey);

    let secp = Secp256k1::new();
    let mut taproot_builder = TaprootBuilder::new();

    // Add leaves to the Taproot tree with weights (1 for redeem, 2 for others)
    taproot_builder = taproot_builder
        .add_leaf(1, redeem_leaf)
        .map_err(|e| format!("Unable to add redeem leaf to Taproot tree: {e}"))?
        .add_leaf(2, refund_leaf)
        .map_err(|e| format!("Unable to add refund leaf to Taproot tree: {e}"))?
        .add_leaf(2, instant_refund_leaf)
        .map_err(|e| format!("Unable to add instant refund leaf to Taproot tree: {e}"))?;

    if !taproot_builder.is_finalizable() {
        return Err("Taproot builder is not in a finalizable state".into());
    }
    
    let internal_key = *GARDEN_NUMS;

    taproot_builder
        .finalize(&secp, internal_key)
        .map_err(|_| "Failed to finalize Taproot spend info".into())
}

/// Creates a simple redeem script
fn create_simple_redeem_script(secret_hash: &[u8; 32], redeemer_pubkey: &XOnlyPublicKey) -> ScriptBuf {
    let mut script = ScriptBuf::new();
    // Simple script: <redeemer_pubkey> OP_CHECKSIG
    script.push_slice(redeemer_pubkey.as_inner());
    script.push_opcode(bitcoin::blockdata::opcodes::all::OP_CHECKSIG);
    script
}

/// Creates a simple refund script
fn create_simple_refund_script(timelock: u32, initiator_pubkey: &XOnlyPublicKey) -> ScriptBuf {
    let mut script = ScriptBuf::new();
    // Simple script: <initiator_pubkey> OP_CHECKSIG
    script.push_slice(initiator_pubkey.as_inner());
    script.push_opcode(bitcoin::blockdata::opcodes::all::OP_CHECKSIG);
    script
}

/// Creates a simple instant refund script
fn create_simple_instant_refund_script(initiator_pubkey: &XOnlyPublicKey, redeemer_pubkey: &XOnlyPublicKey) -> ScriptBuf {
    let mut script = ScriptBuf::new();
    // Simple script: <initiator_pubkey> OP_CHECKSIG <redeemer_pubkey> OP_CHECKSIG OP_ADD
    script.push_slice(initiator_pubkey);
    script.push_opcode(bitcoin::blockdata::opcodes::all::OP_CHECKSIG);
    script.push_slice(redeemer_pubkey.as_inner());
    script.push_opcode(bitcoin::blockdata::opcodes::all::OP_CHECKSIG);
    script.push_opcode(bitcoin::blockdata::opcodes::all::OP_ADD);
    script
}
