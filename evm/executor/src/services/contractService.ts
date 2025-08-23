import { getContract, type WalletClient } from 'viem';
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

  async initiate(order: Order): Promise<AsyncResult<string, string>> {
    try {
      // Switch to the destination chain for the operation
      const chainResult = await this.switchToChainForOrder(order);
      if (chainResult.isErr()) {
        return err(chainResult.error);
      }

      // For ERC20 tokens, we need to approve the atomic swap contract first
      const tokenAddress = await this.getTokenAddress(order.destination_swap.asset);
      if (tokenAddress.isErr()) {
        return err(tokenAddress.error);
      }

      const tokenContract = getContract({
        address: this.with0x(tokenAddress.value),
        abi: erc20ABI,
        client: this.getWallet(),
      });

      // Approve the atomic swap contract to spend tokens
      await tokenContract.write.approve([
        this.with0x(order.destination_swap.asset),
        order.destination_swap.amount
      ], {
        account: this.walletService.getAccount(),
        chain: this.getWallet().chain,
      });

      // Initiate the atomic swap
      const atomicSwap = getContract({
        address: this.with0x(order.destination_swap.htlc_address),
        abi: atomicSwapABI,
        client: this.getWallet(),
      });

      const txHash = await atomicSwap.write.initiate([
        this.with0x(order.destination_swap.secret_hash),
        BigInt(order.destination_swap.timelock),
        BigInt(order.destination_swap.amount),
        this.with0x(order.destination_swap.redeemer)
      ], {
        account: this.walletService.getAccount(),
        chain: this.getWallet().chain,
        value: BigInt(order.destination_swap.amount),
      });

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
      });

      return ok(txHash);
    } catch (error) {
      return err(`Failed to redeem swap: ${String(error)}`);
    }
  }

}
