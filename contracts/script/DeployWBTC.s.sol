// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WrappedBitcoin} from "../src/Token.sol";

contract DeployWrappedBitcoin is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("WrappedBitcoin"));
        // this is for sepolia testnet for aave
        address x = address(new WrappedBitcoin{salt: salt}());
        console.log("The address is ", x);

        vm.stopBroadcast();
    }
}
