// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {USDC} from "../src/Token.sol";

contract DeployUSDC is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("USDC"));
        // this is for sepolia testnet for aave
        address x = address(new USDC{salt: salt}());
        console.log("The address is ", x);

        vm.stopBroadcast();
    }
}
