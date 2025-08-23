// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ATOMIC_SWAP} from "../src/AtomicSwap.sol";
import {NativeATOMIC_SWAP} from "../src/NativeAtomicSwap.sol";
import {ATOMIC_SWAPRegistry} from "../src/AtomicSwapRegistry.sol";
import {Token} from "../src/Token.sol";
import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

contract TestATOMIC_SWAP is Test {
    ATOMIC_SWAP public atomicSwap;
    NativeATOMIC_SWAP public nativeAtomicSwap;
    ATOMIC_SWAPRegistry public registry;
    Token public usdc;
    Token public usdcClone;

    address public owner = makeAddr("owner");
    address public initiator = makeAddr("initiator");
    address public redeemer = makeAddr("redeemer");
    address public refundAddress = makeAddr("refundAddress");

    function setUp() public {
        vm.startPrank(owner);
        atomicSwap = new ATOMIC_SWAP();
        nativeAtomicSwap = new NativeATOMIC_SWAP();
        registry = new ATOMIC_SWAPRegistry();
        registry.addATOMIC_SWAP(address(atomicSwap));
        registry.addNativeATOMIC_SWAP(address(nativeAtomicSwap));

        usdc = new Token();
        usdcClone = new Token();

        usdc.transfer(initiator, 10000 * 10**18);
        usdcClone.transfer(initiator, 10000 * 10**18);
        vm.stopPrank();
    }

    // Add your test functions here
    function test_Initiate() public {
        vm.startPrank(initiator);
        usdc.approve(address(atomicSwap), type(uint256).max);
        atomicSwap.initiate(address(usdc), redeemer, 100 , 10e18, sha256("secret"));

        usdcClone.approve(address(atomicSwap), type(uint256).max);
        atomicSwap.initiate(address(usdcClone), redeemer, 100 , 10e17, sha256("secret"));

        assert(usdc.balanceOf(address(atomicSwap)) == 10e18);
        assert(usdcClone.balanceOf(address(atomicSwap)) == 10e17);

        vm.stopPrank();
    }

    function test_redeem() public {
        test_Initiate();
        vm.startPrank(redeemer);
        atomicSwap.redeem(0x1d955409a8e171056240cfb86eb5063128b9765e58a306763e0d79f0bc98d4b5, abi.encodePacked("secret"));


        vm.stopPrank();
    }

    function test_UDA() public {
        vm.startPrank(initiator);
        address udacreated = registry.getERC20Address(address(usdc), refundAddress, redeemer, 100 , 10e18, sha256("secret"));

        usdc.transfer(udacreated, 10e18);

        registry.createERC20SwapAddress(address(usdc), refundAddress, redeemer, 100 , 10e18, sha256("secret"));
        vm.stopPrank();
    }

    function test_redeemUDA() public {
        test_UDA();
        bytes32 orderId = sha256(abi.encode(block.chainid, sha256(abi.encodePacked("secret")), refundAddress, redeemer, 100 , 10e18, address(atomicSwap)));
        atomicSwap.redeem(orderId, abi.encodePacked("secret"));
    }

    function test_initiateNative() public {
        vm.deal(initiator, 10e18);
        nativeAtomicSwap.initiate{value: 10e18}(payable(redeemer), 100 , 10e18, sha256("secret"));
        assert(address(nativeAtomicSwap).balance == 10e18);
    }

    function test_NativeUDA() public {
        address udacreated = registry.getNativeAddress(payable(refundAddress), payable(redeemer), 100 , 10e18, sha256("secret"));

        vm.deal(udacreated, 10e18);
        registry.createNativeSwapAddress(payable(refundAddress), payable(redeemer), 100 , 10e18, sha256("secret"));

        assert(address(redeemer).balance == 0);

        bytes32 orderId = sha256(abi.encode(block.chainid, sha256(abi.encodePacked("secret")), refundAddress, redeemer, 100 , 10e18, address(nativeAtomicSwap)));
        nativeAtomicSwap.redeem(orderId, abi.encodePacked("secret"));
        assert(address(nativeAtomicSwap).balance == 0);
        assert(address(redeemer).balance == 10e18);
    }
}