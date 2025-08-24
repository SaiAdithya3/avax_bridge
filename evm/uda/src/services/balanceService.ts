import { ethers } from 'ethers';
import { CONFIG } from '../config';
import { EvmChain, Swap, UDABalanceCheck, ChainConfig } from '../types';
import { Result, err, ok } from 'neverthrow';

// ERC20 ABI for balanceOf function
const ERC20_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export class BalanceService {
  private providers: Map<EvmChain, ethers.JsonRpcProvider> = new Map();

  constructor() {
    // Initialize providers for each EVM chain
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      // Initialize Avalanche testnet provider
      this.providers.set('avalanche_testnet', new ethers.JsonRpcProvider(CONFIG.chains.avalanche_testnet.rpc_url));
      
      // Initialize Arbitrum Sepolia provider
      this.providers.set('arbitrum_sepolia', new ethers.JsonRpcProvider(CONFIG.chains.arbitrum_sepolia.rpc_url));
      
    } catch (error) {
      console.error('Failed to initialize providers:', error);
    }
  }

  async checkTokenBalance(
    chain: EvmChain,
    tokenAddress: string,
    depositAddress: string
  ): Promise<Result<string, string>> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        return err(`Provider not found for chain: ${chain}`);
      }

      // Create contract instance using ABI
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      // Get balance
      const balance = await contract.balanceOf(depositAddress);
      
      // Convert balance to string
      const balanceString = balance.toString();
      
      return ok(balanceString);
    } catch (error) {
      return err(`Failed to check token balance: ${error}`);
    }
  }

  async checkSwapBalance(orderId: string, swap: Swap): Promise<Result<UDABalanceCheck, string>> {
    try {
      // Only process EVM chains
      if (swap.chain === 'bitcoin_testnet') {  
        return err('Bitcoin chains not supported in UDA watcher');
      }

      if (!swap.deposit_address) {
        return err('Deposit address not found for swap');
      }

      const chain = swap.chain as EvmChain;
      const tokenAddress = swap.token_address;
      const depositAddress = swap.deposit_address;
      const requiredAmount = swap.amount;

      // Check current balance
      const balanceResult = await this.checkTokenBalance(chain, tokenAddress, depositAddress);
      if (balanceResult.isErr()) {
        return err(balanceResult.error);
      }

      const currentBalance = balanceResult.value;
      const hasEnoughBalance = BigInt(currentBalance) >= BigInt(requiredAmount);

      const balanceCheck: UDABalanceCheck = {
        orderId: orderId,
        chain,
        tokenAddress,
        depositAddress,
        requiredAmount,
        currentBalance,
        hasEnoughBalance,
        timestamp: new Date(),
        chainConfig: CONFIG.chains[chain] as ChainConfig, // Include the chain configuration
        swap: swap // Include the entire swap object
      };

      return ok(balanceCheck);
    } catch (error) {
      return err(`Failed to check swap balance: ${error}`);
    }
  }

  async checkMultipleSwaps(swaps: {orderId: string, swap: Swap}[]): Promise<Result<UDABalanceCheck[], string>> {
    try {
      const balanceChecks: UDABalanceCheck[] = [];
      
      for (const swap of swaps) {
        // Skip bitcoin swaps
        if (swap.swap.chain === 'bitcoin_testnet') {
          continue;
        }

        const balanceCheck = await this.checkSwapBalance(swap.orderId, swap.swap);
        if (balanceCheck.isOk()) {
          balanceChecks.push(balanceCheck.value);
        } else {
          console.warn(`Failed to check balance for swap ${swap.orderId}:`, balanceCheck.error);
        }
      }

      return ok(balanceChecks);
    } catch (error) {
      return err(`Failed to check multiple swaps: ${error}`);
    }
  }

  async getProvider(chain: EvmChain): Promise<Result<ethers.JsonRpcProvider, string>> {
    const provider = this.providers.get(chain);
    if (!provider) {
      return err(`Provider not found for chain: ${chain}`);
    }
    return ok(provider);
  }

  async isProviderHealthy(chain: EvmChain): Promise<boolean> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        return false;
      }

      // Try to get latest block number
      await provider.getBlockNumber();
      return true;
    } catch (error) {
      console.error(`Provider health check failed for ${chain}:`, error);
      return false;
    }
  }
}
