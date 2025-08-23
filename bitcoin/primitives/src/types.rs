use bitcoin::{ScriptBuf};

pub struct BitcoinTaprootWitnessStack {
    pub signature: Vec<u8>,
    pub secret: Option<Vec<u8>>,
    pub random_sig: Option<Vec<u8>>,
    pub script: ScriptBuf,
    pub control_block: Vec<u8>,
}

impl BitcoinTaprootWitnessStack {
    pub fn new(signature: Vec<u8>, secret: Option<Vec<u8>>, random_sig: Option<Vec<u8>>, script: ScriptBuf, control_block: Vec<u8>) -> Self {
        Self { signature, secret, random_sig, script, control_block }
    }
}