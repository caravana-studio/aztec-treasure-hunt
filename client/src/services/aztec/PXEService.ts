import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE, type PXE } from '@aztec/pxe/client/lazy';
import { createLogger } from '@aztec/aztec.js/log';

const logger = createLogger('pxe-service');

export interface PXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
}

/**
 * Singleton service for managing the PXE instance.
 * Ensures only one PXE is created per session.
 */
export class PXEService {
  private static instance: PXEInstance | null = null;
  private static initPromise: Promise<PXEInstance> | null = null;
  private static currentNodeUrl: string | null = null;

  /**
   * Get or create the PXE instance.
   * If already initialized with a different URL, it will reinitialize.
   */
  static async getInstance(nodeUrl: string, proverEnabled = false): Promise<PXEInstance> {
    // If same URL and already initialized, return existing
    if (this.instance && this.currentNodeUrl === nodeUrl) {
      return this.instance;
    }

    // If initialization is in progress for same URL, wait for it
    if (this.initPromise && this.currentNodeUrl === nodeUrl) {
      return this.initPromise;
    }

    // Start new initialization
    this.currentNodeUrl = nodeUrl;
    this.initPromise = this.initialize(nodeUrl, proverEnabled);

    try {
      this.instance = await this.initPromise;
      return this.instance;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Get existing instance without creating a new one.
   * Returns null if not initialized.
   */
  static getExistingInstance(): PXEInstance | null {
    return this.instance;
  }

  /**
   * Check if PXE is initialized.
   */
  static isInitialized(): boolean {
    return this.instance !== null;
  }

  /**
   * Reset the PXE instance (useful for network switching).
   */
  static reset(): void {
    this.instance = null;
    this.currentNodeUrl = null;
    this.initPromise = null;
    logger.info('PXE instance reset');
  }

  private static async initialize(nodeUrl: string, proverEnabled: boolean): Promise<PXEInstance> {
    logger.info('Initializing PXE with node URL:', nodeUrl);

    // Create Aztec Node Client
    const aztecNode = createAztecNodeClient(nodeUrl);

    // Get PXE config and populate with L1 contracts
    const config = getPXEConfig();
    config.l1Contracts = await aztecNode.getL1ContractAddresses();
    config.proverEnabled = proverEnabled;

    // Create PXE instance
    const pxe = await createPXE(aztecNode, config, {
      useLogSuffix: true,
    });

    // Log connection info
    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info('PXE connected to node', nodeInfo);

    return { pxe, aztecNode };
  }
}
