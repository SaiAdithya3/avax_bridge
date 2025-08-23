import { trim0x } from '@gardenfi/utils';

export class DigestKey {
  private static readonly STORAGE_KEY = 'avax_digest_key';

  private static isValidPrivateKey(privateKey: string): boolean {
    const bn = BigInt('0x' + privateKey);
    const min = 1n;
    const max = BigInt(
      '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
    );
    return bn >= min && bn < max;
  }

  private static generateRandomDigestKey(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);

    const privateKey = trim0x(Buffer.from(randomBytes).toString('hex'));

    return DigestKey.isValidPrivateKey(privateKey)
      ? privateKey
      : DigestKey.generateRandomDigestKey();
  }

  public static getDigestKey(): string {
    // Try to get from localStorage first
    const storedKey = localStorage.getItem(this.STORAGE_KEY);
    
    if (storedKey && this.isValidPrivateKey(storedKey)) {
      return storedKey;
    }

    // Generate new key if not exists or invalid
    const newKey = this.generateRandomDigestKey();
    localStorage.setItem(this.STORAGE_KEY, newKey);
    return newKey;
  }

  public static setDigestKey(privateKey: string): void {
    if (!this.isValidPrivateKey(privateKey)) {
      throw new Error('Invalid private key provided');
    }
    localStorage.setItem(this.STORAGE_KEY, privateKey);
  }

  public static clearDigestKey(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  public static hasDigestKey(): boolean {
    const storedKey = localStorage.getItem(this.STORAGE_KEY);
    return storedKey !== null && this.isValidPrivateKey(storedKey);
  }
}
