import { createWalletClient, http, type WalletClient, type Account, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalanche } from 'viem/chains';
import { WALLET_CONFIG } from '../../config';
import { Result, err, ok } from 'neverthrow';
import { EvmChain } from '../types';
import { evmToViemChainMap } from '../utils/networkUtils';

export class WalletService {
  private wallet: WalletClient;
  private account: Account;

  constructor() {
    this.account = privateKeyToAccount(WALLET_CONFIG.privateKey as `0x${string}`);
    
    this.wallet = createWalletClient({
      account: this.account,
      chain: avalanche,
      transport: http(WALLET_CONFIG.rpcUrl)
    });
  }

  getWallet(): WalletClient {
    return this.wallet;
  }

  getAccount(): Account {
    return this.account;
  }

  getAddress(): `0x${string}` {
    return this.account.address;
  }

  async switchToChain(chain: EvmChain): Promise<Result<WalletClient, string>> {
    try {
      const chainConfig = evmToViemChainMap[chain];
      if (!chainConfig) {
        return err(`Unsupported chain: ${chain}`);
      }

      // Create new wallet client for the target chain
      const newWallet = createWalletClient({
        account: this.account,
        chain: chainConfig,
        transport: http(chainConfig.rpcUrls?.default?.http?.[0] || WALLET_CONFIG.rpcUrl)
      });

      this.wallet = newWallet;
      return ok(newWallet);
    } catch (error) {
      return err(`Failed to switch to chain ${chain}: ${error}`);
    }
  }

  // async getBalance(): Promise<Result<bigint, string>> {
  //   try {
  //     const balance = await this.wallet.readContract({
  //       address: this.account.address,
  //       abi: erc20Abi,
  //       functionName: 'balanceOf',
  //       args: [this.account.address]
  //     });
  //     return ok(balance);
  //   } catch (error) {
  //     return err(`Failed to get balance: ${error}`);
  //   }
  // }

}
