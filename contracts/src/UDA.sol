// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AtomicSwap.sol";
import "./NativeAtomicSwap.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UniqueDepositAddress is Initializable {
    using Clones for address;
    using SafeERC20 for IERC20;

    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        (
            address _addressATOMIC_SWAP,
            address _token,
            address refundAddress,
            address redeemer,
            uint256 timelock,
            bytes32 secretHash,
            uint256 amount
        ) = getArgs();
        IERC20(_token).approve(_addressATOMIC_SWAP, amount);
        ATOMIC_SWAP(_addressATOMIC_SWAP).initiateOnBehalf(_token, refundAddress, redeemer, timelock, amount, secretHash);
    }

    function getArgs() internal view returns (address, address, address, address, uint256, bytes32, uint256) {
        bytes memory args = address(this).fetchCloneArgs();
        return abi.decode(args, (address, address, address, address, uint256, bytes32, uint256));
    }

    function recover(address _token) public {
        (, , address refundAddress,,,,) = getArgs();
        IERC20(_token).safeTransfer(refundAddress, IERC20(_token).balanceOf(address(this)));
    }

    function recover() public {
        (, , address _refundAddress,,,,) = getArgs();
        payable(_refundAddress).transfer(address(this).balance);
    }
}

contract NativeUniqueDepositAddress is Initializable {
    using Clones for address;
    using SafeERC20 for IERC20;

    constructor() {
        _disableInitializers();
    }


    function initialize() public initializer {
        (
            address _nativeATOMIC_SWAP,
            address _refundAddress,
            address _redeemer,
            uint256 timelock,
            bytes32 secretHash,
            uint256 amount
        ) = getArgs();
        NativeATOMIC_SWAP(_nativeATOMIC_SWAP).initiateOnBehalf{value: amount}(
            payable(_refundAddress), payable(_redeemer), timelock, amount, secretHash
        );
    }

    function getArgs() internal view returns (address, address, address, uint256, bytes32, uint256) {
        bytes memory args = address(this).fetchCloneArgs();
        return abi.decode(args, (address, address, address, uint256, bytes32, uint256));
    }

    function recover(address _token) public {
        (, address refundAddress,,,,) = getArgs();
        IERC20(_token).safeTransfer(refundAddress, IERC20(_token).balanceOf(address(this)));
    }

    /**
     * @notice  Allows the owner to recover any eth accidentally sent to this contract
     * @dev     Always sends the funds to the owner (refundAddress) of the contract
     */
    function recover() public {
        (, address _refundAddress,,,,) = getArgs();
        payable(_refundAddress).transfer(address(this).balance);
    }
}
