// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ATOMIC_SWAP} from "../src/AtomicSwap.sol";
import {ATOMIC_SWAPRegistry} from "../src/AtomicSwapRegistry.sol";


contract InitiatesTest is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        // Interact with the ATOMIC_SWAP contract
        ATOMIC_SWAP atomicSwap = ATOMIC_SWAP(0x6B1c656ad724C246049EF586Fa35D217A8db13A0);
        IERC20 usdc = IERC20(0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112);

        usdc.approve(address(atomicSwap), type(uint256).max);

        for (uint i = 0; i < 10; i++) {
            atomicSwap.initiate(address(0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112), address(123), 100, 1000, sha256(abi.encodePacked((i + 1) * 100)));
        }

        vm.stopBroadcast();
    }
}

contract InitiateViaRegistry is Script {
    function run() external {
        vm.startBroadcast();

        // Interact with the ATOMIC_SWAP contract
        // ATOMIC_SWAP atomicSwap = ATOMIC_SWAP(0x6B1c656ad724C246049EF586Fa35D217A8db13A0);
        IERC20 usdc = IERC20(0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112);
        ATOMIC_SWAPRegistry atomicSwapRegistry = ATOMIC_SWAPRegistry(0x66F20a5Fbf43e4B36Ac9e2D9DE33E8B8cAfD3ab7);


        for (uint i = 0; i < 10; i++) {
            address UDA = atomicSwapRegistry.getERC20Address(address(usdc), address(123), address(231), 100, 1000, sha256(abi.encodePacked((i + 1) * 1000)));

            usdc.transfer(UDA, 1000);

            atomicSwapRegistry.createERC20SwapAddress(address(usdc), address(123), address(231), 100, 1000, sha256(abi.encodePacked((i + 1) * 1000)));
        }

        vm.stopBroadcast();
    }
}

contract FullFlowTest is Script {
    ATOMIC_SWAP atomicSwap = ATOMIC_SWAP(0x6B1c656ad724C246049EF586Fa35D217A8db13A0);
    IERC20 usdc = IERC20(0xeffc83AC0Da8EC6C91CDe640d35eFB0D10c2E112);
    IERC20 wbtc = IERC20(0x00c1Df9bf9C7ff7F3c2A8F9e9af72DA95b350D34);
    ATOMIC_SWAPRegistry atomicSwapRegistry = ATOMIC_SWAPRegistry(0x66F20a5Fbf43e4B36Ac9e2D9DE33E8B8cAfD3ab7);

    address redeemerAddress = address(0xe62a2b235f7bB86C1122313153824D54E6137e77);

    function run() external {
        vm.startBroadcast();

        // Interact with the ATOMIC_SWAP contract
        atomicSwap.initiate(address(wbtc), redeemerAddress, 100, 1000, sha256(abi.encodePacked("secret11")));

        atomicSwap.redeem(sha256(abi.encode(block.chainid,sha256(abi.encodePacked("secret11")),msg.sender,redeemerAddress,100,1000,address(atomicSwap))),abi.encodePacked("secret11"));

        vm.stopBroadcast();
    }
}