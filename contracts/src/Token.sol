// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }
}

contract USDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }
}

contract WrappedBitcoin is ERC20 {
    constructor() ERC20("Wrapped Bitcoin", "WBTC") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }
}

contract WrappedAVAX is ERC20 {
    constructor() ERC20("Wrapped AVAX", "WAVAX") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }
}
