use anyhow::Result;
use bitcoin::{
    key::{Secp256k1, XOnlyPublicKey}, opcodes::all::{OP_CHECKSIG, OP_CHECKSIGADD, OP_CSV, OP_DROP, OP_EQUALVERIFY, OP_NUMEQUAL, OP_SHA256}, secp256k1::{PublicKey, SecretKey}, taproot::{TaprootBuilder, TaprootSpendInfo}, Address, KnownHrp, Network, ScriptBuf
};
use sha2::{Digest, Sha256};
use alloy::hex;
use once_cell::sync::Lazy;

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
    let redeem_leaf = redeem_leaf(&htlc_params.secret_hash, &htlc_params.redeemer_pubkey);
    let refund_leaf = refund_leaf(htlc_params.timelock as u64, &htlc_params.initiator_pubkey);
    let instant_refund_leaf = instant_refund_leaf(&htlc_params.initiator_pubkey, &htlc_params.redeemer_pubkey);

    let secp = Secp256k1::new();
    let mut taproot_builder = TaprootBuilder::new();

    // Add leaves to the Taproot tree with weights (1 for redeem, 2 for others)
    taproot_builder = taproot_builder
        .add_leaf(1, redeem_leaf)
        .map_err(|e| anyhow::anyhow!("Unable to add redeem leaf to Taproot tree: {e}"))?
        .add_leaf(2, refund_leaf)
        .map_err(|e| anyhow::anyhow!("Unable to add refund leaf to Taproot tree: {e}"))?
        .add_leaf(2, instant_refund_leaf)
        .map_err(|e| anyhow::anyhow!("Unable to add instant refund leaf to Taproot tree: {e}"))?;

    if !taproot_builder.is_finalizable() {
        return Err(anyhow::anyhow!("Taproot builder is not in a finalizable state"));
    }
    
    let internal_key = *GARDEN_NUMS;

    taproot_builder
        .finalize(&secp, internal_key)
        .map_err(|_| anyhow::anyhow!("Failed to finalize Taproot spend info"))
}


pub fn redeem_leaf(secret_hash: &[u8; 32], redeemer_pubkey: &XOnlyPublicKey) -> ScriptBuf {
    bitcoin::script::Builder::new()
        .push_opcode(OP_SHA256)
        .push_slice(secret_hash)
        .push_opcode(OP_EQUALVERIFY)
        .push_slice(redeemer_pubkey.serialize())
        .push_opcode(OP_CHECKSIG)
        .into_script()
}

/// Creates a Bitcoin script that allows refunding after a timelock expires.
///
/// # Arguments
/// * `timelock` - Number of blocks to lock the funds
/// * `initiator_pubkey` - Public key of the initiator who can claim the refund
///
/// # Returns
/// A script that enforces the timelock and verifies the initiator's signature
pub fn refund_leaf(timelock: u64, initiator_pubkey: &XOnlyPublicKey) -> ScriptBuf {
    bitcoin::script::Builder::new()
        .push_int(timelock as i64)
        .push_opcode(OP_CSV)
        .push_opcode(OP_DROP)
        .push_slice(&initiator_pubkey.serialize())
        .push_opcode(OP_CHECKSIG)
        .into_script()
}

/// Creates a Bitcoin script that requires both initiator and redeemer signatures for instant refund.
///
/// # Arguments
/// * `initiator_pubkey` - Public key of the initiator
/// * `redeemer_pubkey` - Public key of the redeemer
///
/// # Returns
/// A script that enforces both parties must sign to execute the refund
pub fn instant_refund_leaf(
    initiator_pubkey: &XOnlyPublicKey,
    redeemer_pubkey: &XOnlyPublicKey,
) -> ScriptBuf {
    bitcoin::script::Builder::new()
        .push_slice(&initiator_pubkey.serialize())
        .push_opcode(OP_CHECKSIG)
        .push_slice(&redeemer_pubkey.serialize())
        .push_opcode(OP_CHECKSIGADD)
        .push_int(2)
        .push_opcode(OP_NUMEQUAL)
        .into_script()
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_htlc_address() {
        let secret_hash_str = "a4ddaad30ff45cfcc7fbae1d49b78ef717341b2b81fdd73410200788b9220da4";
        let initiator_pubkey_str = "aa86614fda03b039bf077e7be6531159c3b157166259168908097b9983156919";
        let redeemer_pubkey_str = "4ee866579971fd784cad175fb000d1a5245c1a5031ce46fef44469000ebc8819";


        let secret_hash = hex::decode(secret_hash_str).unwrap().try_into().unwrap();
        let initiator_pubkey = hex::decode(initiator_pubkey_str).unwrap();
        let redeemer_pubkey = hex::decode(redeemer_pubkey_str).unwrap();


        let htlc_params = HTLCParams {
            secret_hash: secret_hash,
            redeemer_pubkey: XOnlyPublicKey::from_slice(&redeemer_pubkey).unwrap(),
            initiator_pubkey: XOnlyPublicKey::from_slice(&initiator_pubkey).unwrap(),
            timelock: 12,
        };

        let address = get_htlc_address(&htlc_params, Network::Bitcoin).unwrap();
        println!("HTLC address: {}", address);
    }
}