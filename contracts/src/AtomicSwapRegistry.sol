// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./AtomicSwap.sol";
import "./NativeAtomicSwap.sol";
import {NativeUniqueDepositAddress, UniqueDepositAddress} from "./UDA.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ATOMIC_SWAPRegistry
 * @dev   This contract manages ATOMIC_SWAPs (Hash Time-Locked Contracts) and Unique Deposit Addresses (UDAs) for native and ERC20 tokens.
 *        It allows the deployment and management of ATOMIC_SWAPs for both native ETH and ERC20 tokens, as well as managing the associated UDAs.
 *        The contract also enables the updating of implementation addresses for the UDAs and ATOMIC_SWAPs.
 */
contract ATOMIC_SWAPRegistry is Ownable {
    using Clones for address;
    using Address for address;

    error ATOMIC_SWAPRegistry__InvalidAddressParameters();
    error ATOMIC_SWAPRegistry__ZeroTimelock();
    error ATOMIC_SWAPRegistry__ZeroAmount();
    error ATOMIC_SWAPRegistry__ATOMIC_SWAPAlreadyExistsForToken();
    error ATOMIC_SWAPRegistry__InvalidAddress();
    error ATOMIC_SWAPRegistry__InsufficientFundsDeposited();
    error ATOMIC_SWAPRegistry__NoATOMIC_SWAPFoundForThisToken();
    error ATOMIC_SWAPRegistry__NoNativeATOMIC_SWAPFound();

    event ATOMIC_SWAPAdded(address indexed ATOMIC_SWAP);
    event NativeATOMIC_SWAPAdded(address indexed nativeATOMIC_SWAP);
    event UDACreated(address indexed addressUDA, address indexed refundAddress, address indexed token);
    event NativeUDACreated(address indexed addressNativeUDA, address indexed refundAddress);
    event UDAImplUpdated(address indexed impl);
    event NativeUDAImplUpdated(address indexed impl);

    string public constant name = "ATOMIC_SWAPRegistry";
    string public constant version = "1.0.0";
    address public implUDA;
    address public implNativeUDA;
    address public nativeATOMIC_SWAP;
    address public ATOMIC_SWAP;

    constructor(address owner) Ownable(owner) {
        implUDA = address(new UniqueDepositAddress());
    }

    modifier safeParams(address refundAddress, address redeemer, uint256 timelock, uint256 amount) {
        require(
            redeemer != address(0) && refundAddress != address(0) && refundAddress != redeemer,
            ATOMIC_SWAPRegistry__InvalidAddressParameters()
        );
        require(timelock > 0, ATOMIC_SWAPRegistry__ZeroTimelock());
        require(amount > 0, ATOMIC_SWAPRegistry__ZeroAmount());
        _;
    }

    modifier validContractAddress(address _addr) {
        require(_addr.code.length != 0, ATOMIC_SWAPRegistry__InvalidAddress());
        _;
    }

    function setImplNativeUDA(address _impl) external onlyOwner validContractAddress(_impl) {
        implNativeUDA = _impl;
        emit NativeUDAImplUpdated(_impl);
    }

    function addNativeATOMIC_SWAP(address _ATOMIC_SWAP) external onlyOwner validContractAddress(_ATOMIC_SWAP) {
        nativeATOMIC_SWAP = _ATOMIC_SWAP;
        emit NativeATOMIC_SWAPAdded(_ATOMIC_SWAP);
    }

    function addATOMIC_SWAP(address _ATOMIC_SWAP) external onlyOwner validContractAddress(_ATOMIC_SWAP) {
        ATOMIC_SWAP = _ATOMIC_SWAP;
        emit ATOMIC_SWAPAdded(_ATOMIC_SWAP);
    }

    function createERC20SwapAddress(
        address token,
        address refundAddress,
        address redeemer,
        uint256 timelock,
        bytes32 secretHash,
        uint256 amount
    ) external returns (address) {
        require(ATOMIC_SWAP != address(0), ATOMIC_SWAPRegistry__NoATOMIC_SWAPFoundForThisToken());

        bytes memory encodedArgs =
            abi.encode(ATOMIC_SWAP, token, refundAddress, redeemer, timelock, secretHash, amount);
        bytes32 salt =
            keccak256(abi.encodePacked(token, refundAddress, redeemer, timelock, secretHash, amount));
        address _implUDA = implUDA;

        // getting the ERC20SwapAddress
        address addr = _implUDA.predictDeterministicAddressWithImmutableArgs(encodedArgs, salt);
        require(IERC20(token).balanceOf(addr) >= amount, ATOMIC_SWAPRegistry__InsufficientFundsDeposited());

        if (addr.code.length == 0) {
            address uda = _implUDA.cloneDeterministicWithImmutableArgs(encodedArgs, salt);
            emit UDACreated(address(uda), address(refundAddress), token);
            uda.functionCall(abi.encodeCall(UniqueDepositAddress.initialize, ()));
        }

        return addr;
    }

    function getERC20Address(
        address token,
        address refundAddress,
        address redeemer,
        uint256 timelock,
        bytes32 secretHash,
        uint256 amount
    ) external view safeParams(refundAddress, redeemer, timelock, amount) returns (address) {
        require(ATOMIC_SWAP != address(0), ATOMIC_SWAPRegistry__NoATOMIC_SWAPFoundForThisToken());
        return implUDA.predictDeterministicAddressWithImmutableArgs(
            abi.encode(ATOMIC_SWAP, token, refundAddress, redeemer, timelock, secretHash, amount),
            keccak256(abi.encodePacked(token, refundAddress, redeemer, timelock, secretHash, amount))
        );
    }

    function createNativeSwapAddress(
        address refundAddress,
        address redeemer,
        uint256 timelock,
        bytes32 secretHash,
        uint256 amount
    ) external returns (address) {
        require(nativeATOMIC_SWAP != address(0), ATOMIC_SWAPRegistry__NoNativeATOMIC_SWAPFound());
        bytes memory encodedArgs =
            abi.encode(nativeATOMIC_SWAP, refundAddress, redeemer, timelock, secretHash, amount);
        bytes32 salt =
            keccak256(abi.encodePacked(refundAddress, redeemer, timelock, secretHash, amount));
        address _implNativeUDA = implNativeUDA;

        // getting Native swap address
        address addr = implNativeUDA.predictDeterministicAddressWithImmutableArgs(encodedArgs, salt);
        require(address(addr).balance >= amount, ATOMIC_SWAPRegistry__InsufficientFundsDeposited());

        if (addr.code.length == 0) {
            address nativeUda = _implNativeUDA.cloneDeterministicWithImmutableArgs(encodedArgs, salt);
            emit NativeUDACreated(address(nativeUda), address(refundAddress));
            nativeUda.functionCall(abi.encodeCall(NativeUniqueDepositAddress.initialize, ()));
        }
        return addr;
    }

    /**
     * @dev     calculate the counterfactual address of this account as it would be returned by createAccount()
     * @notice  this address must be used to deposit the funds into, before calling the createNativeSwapAddress() function
     * @param   refundAddress   Address to recover accidental funds sent to the UDA
     * @param   redeemer        Redeemer's address to be used for the swap
     * @param   timelock        The timelock to be used for the swap
     * @param   secretHash      The secret hash to lock the funds
     * @param   amount          The amount to be used for the swap
     */
    function getNativeAddress(
        address refundAddress,
        address redeemer,
        uint256 timelock,
        bytes32 secretHash,
        uint256 amount
    ) external view safeParams(refundAddress, redeemer, timelock, amount) returns (address) {
        require(nativeATOMIC_SWAP != address(0), ATOMIC_SWAPRegistry__NoNativeATOMIC_SWAPFound());
        return implNativeUDA.predictDeterministicAddressWithImmutableArgs(
            abi.encode(nativeATOMIC_SWAP, refundAddress, redeemer, timelock, secretHash, amount),
            keccak256(abi.encodePacked(refundAddress, redeemer, timelock, secretHash, amount))
        );
    }
}
