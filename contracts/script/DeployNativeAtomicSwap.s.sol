// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {NativeATOMIC_SWAP} from "../src/NativeAtomicSwap.sol";

contract DeployNativeAtomicSwap is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("NATIVE_ATOMIC_SWAP"));
        // this is for sepolia testnet for aave
        address x = address(new NativeATOMIC_SWAP{salt: salt}());
        console.log("The address is ", x);

        vm.stopBroadcast();
    }
}
