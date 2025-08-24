import type { AtomicSwapConfig } from "../ASConfig";

export enum WalletChain {
  Bitcoin,
  EVM,
}

interface IHTLCWallet {
  id(): string;
  init(): Promise<string>;
  redeem(secret: string, receiver?: string): Promise<string>;
  refund(receiver?: string): Promise<string>;
}


export interface IBaseWallet {
  chain(): WalletChain;
  getAddress(): Promise<string>;
  sign(hexMsg: string): Promise<string>;
  newSwap(swapConfig: AtomicSwapConfig): Promise<IHTLCWallet>;
}
export type { IHTLCWallet };
