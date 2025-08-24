import { getContract, type WalletClient } from 'viem';
import { getTransactionCount, waitForTransactionReceipt } from 'viem/actions';
import { err, ok } from 'neverthrow';
import { WalletService } from './wallet';
import { AsyncResult, Order, EvmChain } from '../types';
import { switchOrAddNetwork } from '../utils/networkUtils';
import atomicSwapABI from '../../abi/atomicSwap.json';
import erc20ABI from '../../abi/erc20.json';

export class ContractService {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  private getWallet(): WalletClient {
    return this.walletService.getWallet();
  }

  private with0x(address: string): `0x${string}` {
    return address.startsWith('0x') ? address as `0x${string}` : `0x${address}`;
  }

  private async getTokenAddress(asset: string): Promise<AsyncResult<string, string>> {
    try {
      const atomicSwap = getContract({
        address: this.with0x(asset),
        abi: atomicSwapABI,
        client: this.getWallet(),
      });

      const token = await atomicSwap.read.token();
      return ok(token as `0x${string}`);
    } catch (error) {
      return err(`Failed to get token address: ${String(error)}`);
    }
  }

  private async switchToChainForOrder(order: Order): Promise<AsyncResult<WalletClient, string>> {
    try {
      // For destination swap operations, we need to be on the destination chain
      const targetChain = order.destination_swap.chain as EvmChain;
      
      const result = await switchOrAddNetwork(targetChain, this.getWallet());
      if (result.isErr()) {
        return err(result.error);
      }

      // Update the wallet service with the new client
      this.walletService = new WalletService();
      await this.walletService.switchToChain(targetChain);
      
      return ok(this.getWallet());
    } catch (error) {
      return err(`Failed to switch to chain: ${String(error)}`);
    }
  }

  private async checkAllowance(tokenAddress: string, spenderAddress: string, requiredAmount: bigint): Promise<AsyncResult<boolean, string>> {
    try {
      const tokenContract = getContract({
        address: this.with0x(tokenAddress),
        abi: erc20ABI,
        client: this.getWallet(),
      });

      const allowance = await tokenContract.read.allowance([
        this.walletService.getAccount().address,
        this.with0x(spenderAddress)
      ]) as bigint;

      return ok(allowance >= requiredAmount);
    } catch (error) {
      return err(`Failed to check allowance: ${String(error)}`);
    }
  }

  private async approveWithNonceManagement(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<AsyncResult<string, string>> {
    try {
      const tokenContract = getContract({
        address: this.with0x(tokenAddress),
        abi: erc20ABI,
        client: this.getWallet(),
      });

      // Get current nonce
      const nonce = await getTransactionCount(this.getWallet(), {
        address: this.walletService.getAddress()
      });

      // Approve with explicit nonce
      const txHash = await tokenContract.write.approve([
        this.with0x(spenderAddress),
        amount
      ], {
        account: this.walletService.getAccount(),
        chain: this.getWallet().chain,
        nonce: nonce
      });

      // Wait for transaction to be mined
      await waitForTransactionReceipt(this.getWallet(), { hash: txHash });

      return ok(txHash);
    } catch (error) {
      return err(`Failed to approve: ${String(error)}`);
    }
  }

  async initiate(order: Order): Promise<AsyncResult<string, string>> {
    try {
      // Switch to the destination chain for the operation
      const chainResult = await this.switchToChainForOrder(order);
      if (chainResult.isErr()) {
        return err(chainResult.error);
      }

      const tokenAddress = this.with0x(order.destination_swap.token_address);
      const htlcAddress = this.with0x(order.destination_swap.htlc_address);
      const amount = BigInt(order.destination_swap.amount);

      // Check if approval is already sufficient
      const allowanceCheck = await this.checkAllowance(tokenAddress, htlcAddress, amount);
      if (allowanceCheck.isErr()) {
        return err(allowanceCheck.error);
      }

      // Only approve if allowance is insufficient
      if (!allowanceCheck.value) {
        console.log(`Insufficient allowance, approving ${amount} tokens for HTLC contract ${htlcAddress}`);
        
        const approvalResult = await this.approveWithNonceManagement(tokenAddress, htlcAddress, amount);
        if (approvalResult.isErr()) {
          return err(`Approval failed: ${approvalResult.error}`);
        }
        
        console.log(`Approval successful: ${approvalResult.value}`);
      } else {
        console.log(`Sufficient allowance already exists for HTLC contract ${htlcAddress}`);
      }

      // Get current nonce for the initiate transaction
      const nonce = await getTransactionCount(this.getWallet(), {
        address: this.walletService.getAddress()
      });

      // Initiate the atomic swap with explicit nonce
      const atomicSwap = getContract({
        address: htlcAddress,
        abi: atomicSwapABI,
        client: this.getWallet(),
      });

      const txHash = await atomicSwap.write.initiate([
        this.with0x(order.destination_swap.secret_hash),
        BigInt(order.destination_swap.timelock),
        amount,
        this.with0x(order.destination_swap.redeemer)
      ], {
        account: this.walletService.getAccount(),
        chain: this.getWallet().chain,
        value: amount,
        nonce: nonce
      });

      // Wait for transaction to be mined
      await waitForTransactionReceipt(this.getWallet(), { hash: txHash });

      return ok(txHash);
    } catch (error) {
      return err(`Failed to initiate swap: ${String(error)}`);
    }
  }

  async redeem(order: Order): Promise<AsyncResult<string, string>> {
    try {
      // Switch to the source chain for the redeem operation
      const targetChain = order.source_swap.chain as EvmChain;
      
      const result = await switchOrAddNetwork(targetChain, this.getWallet());
      if (result.isErr()) {
        return err(result.error);
      }

      // Update the wallet service with the new client
      this.walletService = new WalletService();
      await this.walletService.switchToChain(targetChain);

      // Get current nonce
      const nonce = await getTransactionCount(this.getWallet(), {
        address: this.walletService.getAddress()
      });

      const atomicSwap = getContract({
        address: this.with0x(order.source_swap.htlc_address),
        abi: atomicSwapABI,
        client: this.getWallet(),
      });

      const txHash = await atomicSwap.write.redeem([
        order.create_order.create_id,
        this.with0x(order.destination_swap.secret)
      ], {
        account: this.walletService.getAccount(),
        chain: this.getWallet().chain,
        value: BigInt(order.source_swap.amount),
        nonce: nonce
      });

      // Wait for transaction to be mined
      await waitForTransactionReceipt(this.getWallet(), { hash: txHash });

      return ok(txHash);
    } catch (error) {
      return err(`Failed to redeem swap: ${String(error)}`);
    }
  }

}
