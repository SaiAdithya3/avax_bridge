// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ATOMIC_SWAPRegistry} from "../src/AtomicSwapRegistry.sol";
import {NativeUniqueDepositAddress} from "../src/UDA.sol";

contract DeployAtomicSwapRegistryScript is Script {
    function run() external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("ATOMIC_SWAPRegistry"));
        // this is for sepolia testnet for aave
        ATOMIC_SWAPRegistry x = (new ATOMIC_SWAPRegistry{salt: salt}());
        console.log("The address of Registry is ", address(x));

        x.addATOMIC_SWAP(0x6B1c656ad724C246049EF586Fa35D217A8db13A0);
        // x.addNativeATOMIC_SWAP();

        vm.stopBroadcast();
    }
}
