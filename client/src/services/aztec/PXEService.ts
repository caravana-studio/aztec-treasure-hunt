import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE, type PXE } from '@aztec/pxe/client/bundle';
import { createStore } from '@aztec/kv-store/indexeddb';
import { createLogger } from '@aztec/aztec.js/log';

const logger = createLogger('pxe-service');
const pxeLogger = createLogger('pxe');

export interface PXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
}

/**
 * Singleton service for managing the PXE instance.
 * Uses IndexedDB for persistence across page reloads.
 */
export class PXEService {
  private static instance: PXEInstance | null = null;
  private static initPromise: Promise<PXEInstance> | null = null;
  private static currentNodeUrl: string | null = null;

  static async getInstance(nodeUrl: string, proverEnabled = false): Promise<PXEInstance> {
    if (this.instance && this.currentNodeUrl === nodeUrl) {
      return this.instance;
    }

    if (this.initPromise && this.currentNodeUrl === nodeUrl) {
      return this.initPromise;
    }

    this.currentNodeUrl = nodeUrl;
    this.initPromise = this.initialize(nodeUrl, proverEnabled);

    try {
      this.instance = await this.initPromise;
      return this.instance;
    } finally {
      this.initPromise = null;
    }
  }

  static getExistingInstance(): PXEInstance | null {
    return this.instance;
  }

  static isInitialized(): boolean {
    return this.instance !== null;
  }

  static reset(): void {
    this.instance = null;
    this.currentNodeUrl = null;
    this.initPromise = null;
    logger.info('PXE instance reset');
  }

  private static async initialize(nodeUrl: string, proverEnabled: boolean): Promise<PXEInstance> {
    logger.info('Initializing PXE with node URL:', nodeUrl);

    const aztecNode = createAztecNodeClient(nodeUrl);
    const l1Contracts = await aztecNode.getL1ContractAddresses();

    // Create persistent IndexedDB store
    const storeName = `aztec-pxe-${nodeUrl.replace(/[^a-z0-9]/gi, '-')}`;
    let pxeStore: Awaited<ReturnType<typeof createStore>>;
    try {
      pxeStore = await createStore(
        storeName,
        { dataDirectory: 'pxe', dataStoreMapSizeKb: 5e5 },
        undefined,
        pxeLogger
      );
    } catch {
      logger.warn('Failed to create persistent PXE store, using smaller ephemeral store');
      pxeStore = await createStore(
        `${storeName}-tmp`,
        { dataDirectory: 'pxe-tmp', dataStoreMapSizeKb: 1e5 },
        undefined,
        pxeLogger
      );
    }

    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    config.proverEnabled = proverEnabled;

    const pxe = await createPXE(aztecNode, config, { store: pxeStore });

    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info('PXE connected to node', nodeInfo);

    return { pxe, aztecNode };
  }
}
