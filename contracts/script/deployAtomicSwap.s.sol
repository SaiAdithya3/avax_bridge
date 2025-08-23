// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ATOMIC_SWAP} from "../src/AtomicSwap.sol";

contract DeployAtomicSwapScript is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("gardenfinance_cbbtc_01"));
        // this is for sepolia testnet for aave
        address x = address(new ATOMIC_SWAP{salt: salt}());
        console.log("The address is ", x);

        vm.stopBroadcast();
    }
}
