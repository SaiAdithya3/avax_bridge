import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export type ContractType = 'erc20';

export class AbiLoader {
  private static abiCache: Map<ContractType, any[]> = new Map();
  private static readonly ABI_DIR = path.join(process.cwd(), 'abi');

  /**
   * Load ABI for a specific contract type
   */
  static loadAbi(contractType: ContractType): any[] {
    // Check cache first
    if (this.abiCache.has(contractType)) {
      return this.abiCache.get(contractType)!;
    }

    try {
      const abiPath = path.join(this.ABI_DIR, `${contractType}.json`);
      
      if (!fs.existsSync(abiPath)) {
        throw new Error(`ABI file not found for contract type: ${contractType}`);
      }

      const abiContent = fs.readFileSync(abiPath, 'utf-8');
      const abi = JSON.parse(abiContent);

      // Validate ABI structure
      if (!Array.isArray(abi)) {
        throw new Error(`Invalid ABI format for contract type: ${contractType}. Expected array.`);
      }

      // Cache the ABI
      this.abiCache.set(contractType, abi);
      return abi;
      
    } catch (error) {
      logger.error(`Failed to load ABI for contract type ${contractType}:`, error);
      throw error;
    }
  }

  /**
   * Get available contract types
   */
  static getAvailableTypes(): ContractType[] {
    try {
      if (!fs.existsSync(this.ABI_DIR)) {
        logger.warn(`ABI directory not found: ${this.ABI_DIR}`);
        return [];
      }

      const files = fs.readdirSync(this.ABI_DIR);
      const types = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', '') as ContractType);

      return types;
    } catch (error) {
      logger.error('Failed to get available contract types:', error);
      return [];
    }
  }

  /**
   * Get events from ABI for a specific contract type
   */
  static getEventsFromAbi(contractType: ContractType): string[] {
    try {
      const abi = this.loadAbi(contractType);
      const events = abi
        .filter(item => item.type === 'event')
        .map(event => event.name);

      return events;
    } catch (error) {
      logger.error(`Failed to get events for contract type ${contractType}:`, error);
      return [];
    }
  }

  /**
   * Get default events for a contract type (for ERC20, always Transfer and Approval)
   */
  static getDefaultEvents(contractType: ContractType): string[] {
    switch (contractType) {
      case 'erc20':
        return ['Transfer', 'Approval'];
      default:
        return [];
    }
  }

  /**
   * Clear ABI cache (useful for testing or reloading)
   */
  static clearCache(): void {
    this.abiCache.clear();
    logger.info('ABI cache cleared');
  }

  /**
   * Validate if a contract type is supported
   */
  static isValidContractType(type: string): type is ContractType {
    return ['erc20'].includes(type as ContractType);
  }
}
