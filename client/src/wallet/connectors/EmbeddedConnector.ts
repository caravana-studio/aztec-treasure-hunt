/**
 * Embedded Wallet Connector
 *
 * Uses the official @aztec/wallets EmbeddedWallet with WalletDB (IndexedDB-backed).
 * Creates a local PXE, manages accounts via WalletDB, and handles fee payment
 * with the canonical Sponsored FPC contract.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { NO_FROM } from '@aztec/aztec.js/account';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import type { AcceleratorProver as AcceleratorProverType } from '@alejoamiras/aztec-accelerator';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig } from '../../config/network';
import { useAcceleratorStore } from '../../store/accelerator';
import type { AcceleratorPhaseLabel } from '../../store/accelerator';

/**
 * Lazy account contracts provider — uses dynamic imports so Vite can
 * code-split the account contract artifacts.
 */
const lazyAccountContracts = {
  async getSchnorrAccountContract(signingKey: import('@aztec/foundation/curves/bn254').Fq) {
    const { SchnorrAccountContract } = await import('@aztec/accounts/schnorr/lazy');
    return new SchnorrAccountContract(signingKey);
  },
  async getEcdsaRAccountContract(signingKey: Buffer) {
    const { EcdsaRAccountContract } = await import('@aztec/accounts/ecdsa/lazy');
    return new EcdsaRAccountContract(signingKey);
  },
  async getEcdsaKAccountContract(signingKey: Buffer) {
    const { EcdsaKAccountContract } = await import('@aztec/accounts/ecdsa/lazy');
    return new EcdsaKAccountContract(signingKey);
  },
  async getStubAccountContractArtifact() {
    const { getStubAccountContractArtifact } = await import('@aztec/accounts/stub/lazy');
    return getStubAccountContractArtifact();
  },
  async createStubAccount(address: import('@aztec/stdlib/contract').CompleteAddress) {
    const { createStubAccount } = await import('@aztec/accounts/stub/lazy');
    return createStubAccount(address);
  },
  async getMulticallContract() {
    const { getCanonicalMultiCallEntrypoint } = await import(
      '@aztec/protocol-contracts/multi-call-entrypoint/lazy'
    );
    return getCanonicalMultiCallEntrypoint();
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedWallet: any | null = null;
let cachedFeePaymentMethod: SponsoredFeePaymentMethod | null = null;


export function getSponsoredFeePaymentMethod(): SponsoredFeePaymentMethod | null {
  return cachedFeePaymentMethod;
}

let cachedProver: AcceleratorProverType | null = null;

export function getAcceleratorProver(): AcceleratorProverType | null {
  return cachedProver;
}

export interface EmbeddedConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initWallet(nodeUrl: string): Promise<any> {
  if (cachedWallet) return cachedWallet;

  const config = getNetworkConfig();
  const isRemoteNetwork = !nodeUrl.includes('localhost') && !nodeUrl.includes('127.0.0.1');

  // Connect to Aztec node
  const aztecNode = createAztecNodeClient(nodeUrl);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const rollupAddress = l1Contracts.rollupAddress;

  // Dynamically import heavy PXE/wallet modules to avoid Rollup bundle initialization errors
  const { createPXE, getPXEConfig } = await import('@aztec/pxe/client/lazy');
  const { createStore } = await import('@aztec/kv-store/indexeddb');
  const { EmbeddedWallet, WalletDB } = await import('@aztec/wallets/embedded');
  const { SponsoredFPCContract } = await import('@aztec/noir-contracts.js/SponsoredFPC');

  // Create PXE
  const pxeConfig = getPXEConfig();
  pxeConfig.dataDirectory = `pxe-${rollupAddress}`;
  pxeConfig.proverEnabled = config.proverEnabled || isRemoteNetwork;
  pxeConfig.l1Contracts = l1Contracts;

  // Set up AcceleratorProver via dynamic import — avoids Rollup bundling issues
  // with @aztec/bb-prover WASM dependencies in production builds.
  let prover: AcceleratorProverType | null = null;
  const { setAvailable, setPhase, setLastProofMs } = useAcceleratorStore.getState();
  try {
    const { AcceleratorProver } = await import('@alejoamiras/aztec-accelerator');
    prover = new AcceleratorProver();
    cachedProver = prover;

    const acceleratorStatus = await prover.checkAcceleratorStatus();
    setAvailable(acceleratorStatus.available);

    if (acceleratorStatus.available) {
      console.log('[accelerator] Native proving active — desktop accelerator detected at localhost:59833');
    } else {
      console.log('[accelerator] Native proving unavailable — falling back to WASM proving');
    }

    prover.setOnPhase((phase, data) => {
      setPhase(phase as AcceleratorPhaseLabel);
      if (phase === 'proved') {
        if (data?.durationMs) setLastProofMs(data.durationMs);
        console.log(`[accelerator] Proof complete${data?.durationMs ? ` in ${(data.durationMs / 1000).toFixed(1)}s` : ''}`);
        setTimeout(() => setPhase(null), 2000);
      } else {
        console.log(`[accelerator] Phase: ${phase}`);
      }
    });
  } catch (e) {
    console.warn('[accelerator] AcceleratorProver unavailable, using default WASM prover:', e);
    setAvailable(false);
  }

  // Always pass proverOrOptions so createPXE skips its internal
  // `new BBLazyPrivateKernelProver()` call, which fails in production bundles.
  // AcceleratorProver extends BBLazyPrivateKernelProver extends BBPrivateKernelProver,
  // so instanceof check passes and no extra prover is created.
  // If AcceleratorProver failed to load, fall back by letting createPXE use its default.
  const pxeOptions = prover ? { proverOrOptions: prover } : {};
  const pxe = await createPXE(aztecNode, pxeConfig, pxeOptions);

  // Create WalletDB (IndexedDB-backed account persistence)
  const walletDBStore = await createStore(`wallet-${rollupAddress}`, {
    dataDirectory: 'wallet',
    dataStoreMapSizeKb: 2e10,
  });
  const walletDB = WalletDB.init(walletDBStore, (msg: string) =>
    console.log('[wallet]', msg)
  );

  // Create EmbeddedWallet
  const wallet = new EmbeddedWallet(pxe, aztecNode, walletDB, lazyAccountContracts);

  // SponsoredFPC is available on all Aztec networks (local, devnet, testnet).
  // Use salt=0 as the canonical default, matching the playground.
  const fpcInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: new Fr(0) }
  );
  await wallet.registerContract(fpcInstance, SponsoredFPCContract.artifact);
  cachedFeePaymentMethod = new SponsoredFeePaymentMethod(fpcInstance.address);

  // Register game contract
  const gameInstance = await getContractInstanceFromInstantiationParams(
    TreasureHuntContract.artifact,
    {
      deployer: AztecAddress.fromString(config.deployerAddress),
      salt: Fr.fromString(config.deploymentSalt),
      constructorArgs: [
        AztecAddress.fromString(config.adminAddress ?? config.deployerAddress),
      ],
    }
  );
  await wallet.registerContract(gameInstance, TreasureHuntContract.artifact);

  cachedWallet = wallet;
  return wallet;
}

/** Try to reconnect a previously saved embedded account */
export async function reconnectEmbedded(
  nodeUrl: string
): Promise<EmbeddedConnectorResult | null> {
  const config = getNetworkConfig();
  const wallet = await initWallet(nodeUrl);

  const accounts = await wallet.getAccounts();
  if (!accounts || accounts.length === 0) return null;

  const address = accounts[0].item;
  return {
    wallet,
    address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}

/** Create a new embedded account and connect */
export async function createEmbeddedAccount(
  nodeUrl: string
): Promise<EmbeddedConnectorResult> {
  const config = getNetworkConfig();
  const wallet = await initWallet(nodeUrl);

  const secret = Fr.random();
  const salt = Fr.random();
  const accountManager = await wallet.createSchnorrAccount(secret, salt);

  if (!cachedFeePaymentMethod) {
    throw new Error('Fee payment method not initialized. Call initWallet first.');
  }

  // Deploy account with sponsored fees
  // additionalScopes is required: the account constructor initializes private storage
  // and needs its own nullifier key in scope (same pattern as the playground).
  const deployMethod = await accountManager.getDeployMethod();
  await deployMethod.send({
    from: NO_FROM,
    skipClassPublication: true,
    fee: { paymentMethod: cachedFeePaymentMethod! },
    additionalScopes: [accountManager.address],
    wait: { timeout: 120000 },
  });

  return {
    wallet,
    address: accountManager.address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}
