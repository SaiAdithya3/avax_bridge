export const AtomicSwapABI = [
  {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "eip712Domain",
      "inputs": [],
      "outputs": [
          {
              "name": "fields",
              "type": "bytes1",
              "internalType": "bytes1"
          },
          {
              "name": "name",
              "type": "string",
              "internalType": "string"
          },
          {
              "name": "version",
              "type": "string",
              "internalType": "string"
          },
          {
              "name": "chainId",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "verifyingContract",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "salt",
              "type": "bytes32",
              "internalType": "bytes32"
          },
          {
              "name": "extensions",
              "type": "uint256[]",
              "internalType": "uint256[]"
          }
      ],
      "stateMutability": "view"
  },
  {
      "type": "function",
      "name": "initiate",
      "inputs": [
          {
              "name": "token",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "redeemer",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "secretHash",
              "type": "bytes32",
              "internalType": "bytes32"
          }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "initiateOnBehalf",
      "inputs": [
          {
              "name": "token",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "initiator",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "redeemer",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "secretHash",
              "type": "bytes32",
              "internalType": "bytes32"
          }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "initiateWithSignature",
      "inputs": [
          {
              "name": "token",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "initiator",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "redeemer",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "secretHash",
              "type": "bytes32",
              "internalType": "bytes32"
          },
          {
              "name": "signature",
              "type": "bytes",
              "internalType": "bytes"
          }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [
          {
              "name": "",
              "type": "string",
              "internalType": "string"
          }
      ],
      "stateMutability": "view"
  },
  {
      "type": "function",
      "name": "orders",
      "inputs": [
          {
              "name": "",
              "type": "bytes32",
              "internalType": "bytes32"
          }
      ],
      "outputs": [
          {
              "name": "token",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "initiator",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "redeemer",
              "type": "address",
              "internalType": "address"
          },
          {
              "name": "initiatedAt",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "timelock",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
          },
          {
              "name": "fulfilledAt",
              "type": "uint256",
              "internalType": "uint256"
          }
      ],
      "stateMutability": "view"
  },
  {
      "type": "function",
      "name": "redeem",
      "inputs": [
          {
              "name": "orderID",
              "type": "bytes32",
              "internalType": "bytes32"
          },
          {
              "name": "secret",
              "type": "bytes",
              "internalType": "bytes"
          }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "refund",
      "inputs": [
          {
              "name": "orderID",
              "type": "bytes32",
              "internalType": "bytes32"
          }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
  },
  {
      "type": "function",
      "name": "version",
      "inputs": [],
      "outputs": [
          {
              "name": "",
              "type": "string",
              "internalType": "string"
          }
      ],
      "stateMutability": "view"
  },
  {
      "type": "event",
      "name": "EIP712DomainChanged",
      "inputs": [],
      "anonymous": false
  },
  {
      "type": "event",
      "name": "Initiated",
      "inputs": [
          {
              "name": "orderID",
              "type": "bytes32",
              "indexed": true,
              "internalType": "bytes32"
          },
          {
              "name": "secretHash",
              "type": "bytes32",
              "indexed": true,
              "internalType": "bytes32"
          },
          {
              "name": "amount",
              "type": "uint256",
              "indexed": true,
              "internalType": "uint256"
          }
      ],
      "anonymous": false
  },
  {
      "type": "event",
      "name": "Redeemed",
      "inputs": [
          {
              "name": "orderID",
              "type": "bytes32",
              "indexed": true,
              "internalType": "bytes32"
          },
          {
              "name": "secretHash",
              "type": "bytes32",
              "indexed": true,
              "internalType": "bytes32"
          },
          {
              "name": "secret",
              "type": "bytes",
              "indexed": false,
              "internalType": "bytes"
          }
      ],
      "anonymous": false
  },
  {
      "type": "event",
      "name": "Refunded",
      "inputs": [
          {
              "name": "orderID",
              "type": "bytes32",
              "indexed": true,
              "internalType": "bytes32"
          }
      ],
      "anonymous": false
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__DuplicateOrder",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__IncorrectSecret",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__InvalidInitiatorSignature",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__InvalidRedeemerSignature",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__OrderFulfilled",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__OrderNotExpired",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__OrderNotInitiated",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__SameFunderAndRedeemer",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__SameInitiatorAndRedeemer",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__ZeroAddressInitiator",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__ZeroAddressRedeemer",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__ZeroAmount",
      "inputs": []
  },
  {
      "type": "error",
      "name": "ATOMIC_SWAP__ZeroTimelock",
      "inputs": []
  },
  {
      "type": "error",
      "name": "InvalidShortString",
      "inputs": []
  },
  {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
          {
              "name": "token",
              "type": "address",
              "internalType": "address"
          }
      ]
  },
  {
      "type": "error",
      "name": "StringTooLong",
      "inputs": [
          {
              "name": "str",
              "type": "string",
              "internalType": "string"
          }
      ]
  }
] as const;
  