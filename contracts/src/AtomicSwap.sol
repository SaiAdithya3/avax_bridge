// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";


contract ATOMIC_SWAP is EIP712 {
    using SafeERC20 for IERC20;

    struct Order {
        address token;
        address initiator;
        address redeemer;
        uint256 initiatedAt;
        uint256 timelock;
        uint256 amount;
        uint256 fulfilledAt;
    }

    string public constant name = "ATOMIC_SWAP";
    string public constant version = "3";

    mapping(bytes32 => Order) public orders;

    bytes32 private constant _INITIATE_TYPEHASH =
        keccak256("Initiate(address redeemer,uint256 timelock,uint256 amount,bytes32 secretHash)");


    event Initiated(bytes32 indexed orderID, bytes32 indexed secretHash, uint256 indexed amount);
    event Redeemed(bytes32 indexed orderID, bytes32 indexed secretHash, bytes secret);
    event Refunded(bytes32 indexed orderID);

    //0x32a4beb3
    error ATOMIC_SWAP__ZeroAddressRedeemer();
    //0xcb5d8501
    error ATOMIC_SWAP__ZeroTimelock();
    //0x4d15835c
    error ATOMIC_SWAP__ZeroAmount();
    //0xca1eac12
    error ATOMIC_SWAP__OrderNotInitiated();
    //0x356b842c
    error ATOMIC_SWAP__OrderFulfilled();
    //0x3dbd7ab4
    error ATOMIC_SWAP__IncorrectSecret();
    //0x839f009c
    error ATOMIC_SWAP__OrderNotExpired();
    //0xd3eb4c21
    error ATOMIC_SWAP__SameInitiatorAndRedeemer();
    //0x90c06174
    error ATOMIC_SWAP__DuplicateOrder();
    //0xb41ed7a7
    error ATOMIC_SWAP__InvalidRedeemerSignature();
    //0xc7ea8167
    error ATOMIC_SWAP__SameFunderAndRedeemer();
    //0x5411490b
    error ATOMIC_SWAP__ZeroAddressInitiator();
    //0x3b3fd9ae
    error ATOMIC_SWAP__InvalidInitiatorSignature();

    modifier safeParams(address initiator, address redeemer, uint256 timelock, uint256 amount) {
        require(initiator != redeemer, ATOMIC_SWAP__SameInitiatorAndRedeemer());
        require(redeemer != address(0), ATOMIC_SWAP__ZeroAddressRedeemer());
        require(timelock > 0, ATOMIC_SWAP__ZeroTimelock());
        require(amount > 0, ATOMIC_SWAP__ZeroAmount());
        _;
    }

    constructor() EIP712(name, version) {}

    function initiate(address token, address redeemer, uint256 timelock, uint256 amount, bytes32 secretHash)
        external
        safeParams(msg.sender, redeemer, timelock, amount)
    {
        _initiate(token, msg.sender, msg.sender, redeemer, timelock, amount, secretHash);
    }


    function initiateOnBehalf(address token, address initiator, address redeemer, uint256 timelock, uint256 amount, bytes32 secretHash)
        external
        safeParams(initiator, redeemer, timelock, amount)
    {
        require(msg.sender != redeemer, ATOMIC_SWAP__SameFunderAndRedeemer());
        require(initiator != address(0), ATOMIC_SWAP__ZeroAddressInitiator());
        _initiate(token, msg.sender, initiator, redeemer, timelock, amount, secretHash);
    }

    function initiateWithSignature(
        address token,
        address initiator,
        address redeemer,
        uint256 timelock,
        uint256 amount,
        bytes32 secretHash,
        bytes calldata signature
    ) external safeParams(initiator, redeemer, timelock, amount) {
        bytes32 hash =
            _hashTypedDataV4(keccak256(abi.encode(_INITIATE_TYPEHASH, token , redeemer, timelock, amount, secretHash)));
        require(SignatureChecker.isValidSignatureNow(initiator, hash, signature), ATOMIC_SWAP__InvalidInitiatorSignature());
        _initiate(token, initiator, initiator, redeemer, timelock, amount, secretHash);
    }

    function redeem(bytes32 orderID, bytes calldata secret) external {
        Order storage order = orders[orderID];

        address redeemer = order.redeemer;
        require(redeemer != address(0), ATOMIC_SWAP__OrderNotInitiated());

        require(order.fulfilledAt == 0, ATOMIC_SWAP__OrderFulfilled());

        bytes32 secretHash = sha256(secret);
        uint256 amount = order.amount;

        require(
            sha256(
                abi.encode(block.chainid, secretHash, order.initiator, redeemer, order.timelock, amount, address(this))
            ) == orderID,
            ATOMIC_SWAP__IncorrectSecret()
        );

        order.fulfilledAt = block.number;

        emit Redeemed(orderID, secretHash, secret);

        IERC20(order.token).safeTransfer(redeemer, amount);
    }

    function refund(bytes32 orderID) external {
        Order storage order = orders[orderID];

        uint256 timelock = order.timelock;
        require(timelock > 0, ATOMIC_SWAP__OrderNotInitiated());

        require(order.fulfilledAt == 0, ATOMIC_SWAP__OrderFulfilled());
        require(order.initiatedAt + timelock < block.number, ATOMIC_SWAP__OrderNotExpired());

        order.fulfilledAt = block.number;

        emit Refunded(orderID);

        IERC20(order.token).safeTransfer(order.initiator, order.amount);
    }

    function _initiate(
        address token_,
        address funder_,
        address initiator_,
        address redeemer_,
        uint256 timelock_,
        uint256 amount_,
        bytes32 secretHash_
    ) internal returns (bytes32 orderID) {
        orderID =
            sha256(abi.encode(block.chainid, secretHash_, initiator_, redeemer_, timelock_, amount_, address(this)));

        require(orders[orderID].timelock == 0, ATOMIC_SWAP__DuplicateOrder());

        orders[orderID] = Order({
            token: token_,
            initiator: initiator_,
            redeemer: redeemer_,
            initiatedAt: block.number,
            timelock: timelock_,
            amount: amount_,
            fulfilledAt: 0
        });

        emit Initiated(orderID, secretHash_, amount_);

        IERC20(token_).safeTransferFrom(funder_, address(this), amount_);
    }

}
