// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }
}

contract USDC is ERC20 {
    constructor() ERC20("USDC", "USDC-6") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

contract WrappedBitcoin is ERC20 {
    constructor() ERC20("Wrapped Bitcoin", "WBTC-8") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }
}

contract WrappedAVAX is ERC20 {
    constructor() ERC20("Wrapped AVAX", "WAVAX-18") {
        _mint(0x1B150538E943F00127929f7eeB65754f7beB0B6d, 100000000 * 10 ** decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
