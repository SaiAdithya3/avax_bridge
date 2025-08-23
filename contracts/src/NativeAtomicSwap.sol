// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;


/**
 * @author  Garden Finance
 * @title   ATOMIC_SWAP smart contract for atomic swaps
 * @notice  Any signer can create an order to serve as one of either halves of a cross chain
 *          atomic swap for any user with respective valid signatures.
 * @dev     The contract can be used to create an order to serve as the the commitment for two
 *          types of users :
 *          Initiator functions: 1. initiate
 *                               2. initiateOnBehalf
 *                               3. refund
 *                               4. instantRefund
 *
 *          Redeemer function:   1. redeem
 */
contract NativeATOMIC_SWAP {
    struct Order {
        address payable initiator;
        address payable redeemer;
        uint256 initiatedAt;
        uint256 timelock;
        uint256 amount;
        uint256 fulfilledAt;
    }

    address public constant token = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    string public constant name = "ATOMIC_SWAP";
    string public constant version = "3";

    mapping(bytes32 => Order) public orders;

    event Initiated(bytes32 indexed orderID, bytes32 indexed secretHash, uint256 indexed amount);
    event Redeemed(bytes32 indexed orderID, bytes32 indexed secretHash, bytes secret);
    event Refunded(bytes32 indexed orderID);

    //0x63cf1fac
    error NativeATOMIC_SWAP__ZeroAddressInitiator();
    //0x64c7ce67
    error NativeATOMIC_SWAP__ZeroAddressRedeemer();
    //0x2907afb8
    error NativeATOMIC_SWAP__ZeroTimelock();
    //0x0e3e0208
    error NativeATOMIC_SWAP__ZeroAmount();
    //0x71e76dc2
    error NativeATOMIC_SWAP__OrderNotInitiated();
    //0x38258a2d
    error NativeATOMIC_SWAP__OrderFulfilled();
    //0xe3358152
    error NativeATOMIC_SWAP__IncorrectSecret();
    //0x221bb10a
    error NativeATOMIC_SWAP__OrderNotExpired();
    //0xb67261d3
    error NativeATOMIC_SWAP__SameInitiatorAndRedeemer();
    //0x850c33e1
    error NativeATOMIC_SWAP__DuplicateOrder();
    //0x98fa56bc
    error NativeATOMIC_SWAP__InvalidRedeemerSignature();
    //0xa6fe390b
    error NativeATOMIC_SWAP__IncorrectFundsRecieved();
    //0x5e1dd837
    error NativeATOMIC_SWAP__SameFunderAndRedeemer();


    modifier safeParams(address initiator, address redeemer, uint256 timelock, uint256 amount) {
        require(redeemer != address(0), NativeATOMIC_SWAP__ZeroAddressRedeemer());
        require(initiator != redeemer, NativeATOMIC_SWAP__SameInitiatorAndRedeemer());
        require(timelock > 0, NativeATOMIC_SWAP__ZeroTimelock());
        require(amount > 0, NativeATOMIC_SWAP__ZeroAmount());
        require(msg.value == amount, NativeATOMIC_SWAP__IncorrectFundsRecieved());
        _;
    }


    function initiate(address payable redeemer, uint256 timelock, uint256 amount, bytes32 secretHash)
        external
        payable
        safeParams(msg.sender, redeemer, timelock, amount)
    {
        _initiate(payable(msg.sender), redeemer, timelock, secretHash);
    }

    function initiateOnBehalf(
        address payable initiator,
        address payable redeemer,
        uint256 timelock,
        uint256 amount,
        bytes32 secretHash
    ) external payable safeParams(initiator, redeemer, timelock, amount) {
        require(msg.sender != redeemer, NativeATOMIC_SWAP__SameFunderAndRedeemer());
        require(initiator != address(0), NativeATOMIC_SWAP__ZeroAddressInitiator());
        _initiate(initiator, redeemer, timelock, secretHash);
    }


    function redeem(bytes32 orderID, bytes calldata secret) external {
        Order storage order = orders[orderID];

        address payable orderRedeemer = order.redeemer;
        require(orderRedeemer != address(0), NativeATOMIC_SWAP__OrderNotInitiated());

        require(order.fulfilledAt == 0, NativeATOMIC_SWAP__OrderFulfilled());

        bytes32 secretHash = sha256(secret);
        uint256 amount = order.amount;

        require(
            sha256(
                abi.encode(
                    block.chainid, secretHash, order.initiator, orderRedeemer, order.timelock, amount, address(this)
                )
            ) == orderID,
            NativeATOMIC_SWAP__IncorrectSecret()
        );

        order.fulfilledAt = block.number;

        emit Redeemed(orderID, secretHash, secret);

        orderRedeemer.transfer(amount);
    }
    
    function refund(bytes32 orderID) external {
        Order storage order = orders[orderID];

        uint256 timelock = order.timelock;
        require(timelock > 0, NativeATOMIC_SWAP__OrderNotInitiated());

        require(order.fulfilledAt == 0, NativeATOMIC_SWAP__OrderFulfilled());
        require(order.initiatedAt + timelock < block.number, NativeATOMIC_SWAP__OrderNotExpired());

        order.fulfilledAt = block.number;

        emit Refunded(orderID);

        order.initiator.transfer(order.amount);
    }

    function _initiate(address payable initiator_, address payable redeemer_, uint256 timelock_, bytes32 secretHash_)
        internal returns (bytes32 orderID)
    {
        orderID =
            sha256(abi.encode(block.chainid, secretHash_, initiator_, redeemer_, timelock_, msg.value, address(this)));

        require(orders[orderID].timelock == 0, NativeATOMIC_SWAP__DuplicateOrder());

        orders[orderID] = Order({
            initiator: initiator_,
            redeemer: redeemer_,
            initiatedAt: block.number,
            timelock: timelock_,
            amount: msg.value,
            fulfilledAt: 0
        });

        emit Initiated(orderID, secretHash_, msg.value);
    }

}
