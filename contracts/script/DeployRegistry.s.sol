// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ATOMIC_SWAPRegistry} from "../src/AtomicSwapRegistry.sol";
import {NativeUniqueDepositAddress} from "../src/UDA.sol";

contract DeployAtomicSwapRegistryScript is Script {
    function run(address owner, address changeOwner) external {
        // uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast();

        bytes32 salt = keccak256(abi.encode("gardenfinance_eth_ATOMIC_SWAPRegistry_2"));
        // this is for sepolia testnet for aave
        address x = address(new ATOMIC_SWAPRegistry{salt: salt}(owner));
        console.log("The address of Registry is ", x);

        address nativeUDA = address(new NativeUniqueDepositAddress());
        ATOMIC_SWAPRegistry(x).setImplNativeUDA(address(nativeUDA));

        ATOMIC_SWAPRegistry(x).transferOwnership(changeOwner);

        console.log("The address of Native UDA is ", nativeUDA);

        vm.stopBroadcast();
    }
}
