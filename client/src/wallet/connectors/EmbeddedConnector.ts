/**
 * Embedded Wallet Connector
 *
 * Uses the official @aztec/wallets EmbeddedWallet with WalletDB (IndexedDB-backed).
 * Creates a local PXE, manages accounts via WalletDB, and handles fee payment
 * with the canonical Sponsored FPC contract.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { NO_FROM } from '@aztec/aztec.js/account';
import {
  FeeJuicePaymentMethodWithClaim,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { L1FeeJuicePortalManager } from '@aztec/aztec.js/ethereum';
import { waitForL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';
import { ContractInitializationStatus } from '@aztec/aztec.js/wallet';
import { createEthereumChain } from '@aztec/ethereum/chain';
import { createStore } from '@aztec/kv-store/indexeddb';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { AcceleratorProver } from '@alejoamiras/aztec-accelerator';
import { createPXE, getPXEConfig } from '@aztec/pxe/client/lazy';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { createWalletClient, custom, publicActions } from 'viem';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { EmbeddedWallet, WalletDB } from '@aztec/wallets/embedded';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import {
  getDefaultL1RpcUrl,
  getNetworkConfig,
  usesSponsoredFeePayment,
} from '../../config/network';
import { useAcceleratorStore } from '../../store/accelerator';
import type { AcceleratorPhaseLabel } from '../../store/accelerator';
import { getSponsoredFpcInstance } from './sponsoredFpc';

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

let cachedWallet: EmbeddedWallet | null = null;
let cachedFeePaymentMethod: SponsoredFeePaymentMethod | null = null;

const REMOTE_EMBEDDED_FEE_JUICE_AMOUNT = 1_000_000_000_000_000_000_000n;
const REMOTE_EMBEDDED_MIN_READY_BALANCE = 1_000_000_000_000_000_000n;
const MAX_INIT_ATTEMPTS = 3;
const AZTEC_DB_PREFIXES = ['pxe-', 'wallet-', 'aztec-'];


export function getSponsoredFeePaymentMethod(): SponsoredFeePaymentMethod | null {
  return cachedFeePaymentMethod;
}

let cachedProver: AcceleratorProver | null = null;

export function getAcceleratorProver(): AcceleratorProver | null {
  return cachedProver;
}

export interface EmbeddedConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

function resetCachedEmbeddedState() {
  cachedWallet = null;
  cachedFeePaymentMethod = null;
  cachedProver = null;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

function getInjectedEthereumProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const maybeProvider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return maybeProvider ?? null;
}

function toChainHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

function createBrowserLogger() {
  return {
    info: (...args: unknown[]) => console.log('[embedded:l1]', ...args),
    debug: (...args: unknown[]) => console.debug('[embedded:l1]', ...args),
    verbose: (...args: unknown[]) => console.debug('[embedded:l1]', ...args),
    warn: (...args: unknown[]) => console.warn('[embedded:l1]', ...args),
    error: (...args: unknown[]) => console.error('[embedded:l1]', ...args),
    fatal: (...args: unknown[]) => console.error('[embedded:l1]', ...args),
  } as any;
}

async function ensureInjectedChain(provider: Eip1193Provider, chainId: number) {
  const currentChainHex = await provider.request({ method: 'eth_chainId' });
  const expectedChainHex = toChainHex(chainId);

  if (currentChainHex === expectedChainHex) {
    return;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expectedChainHex }],
    });
    return;
  } catch (error) {
    const code = (error as { code?: number } | undefined)?.code;
    if (code !== 4902) {
      throw error;
    }
  }

  const l1RpcUrl = getDefaultL1RpcUrl(chainId);
  if (!l1RpcUrl) {
    throw new Error(`Unsupported L1 chain ${chainId}. Switch your L1 wallet manually and try again.`);
  }

  const chain = createEthereumChain([l1RpcUrl], chainId).chainInfo;
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: expectedChainHex,
        chainName: chain.name,
        rpcUrls: chain.rpcUrls.default.http,
        nativeCurrency: chain.nativeCurrency,
      },
    ],
  });
}

async function createInjectedL1Client(chainId: number) {
  const provider = getInjectedEthereumProvider();
  if (!provider) {
    throw new Error(
      'Embedded Wallet on testnet or mainnet needs an injected Ethereum wallet with ETH for L1 gas.'
    );
  }

  await ensureInjectedChain(provider, chainId);
  const addresses = await provider.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(addresses) || typeof addresses[0] !== 'string') {
    throw new Error('No Ethereum account was provided by the injected wallet.');
  }

  const l1RpcUrl = getDefaultL1RpcUrl(chainId);
  const chain = createEthereumChain(l1RpcUrl ? [l1RpcUrl] : [], chainId).chainInfo;

  return createWalletClient({
    account: addresses[0] as `0x${string}`,
    chain,
    transport: custom(provider),
  }).extend(publicActions);
}

async function findReconnectableAccount(
  wallet: EmbeddedWallet,
  nodeUrl: string
): Promise<AztecAddress | null> {
  const accounts = await wallet.getAccounts();
  if (!accounts.length) {
    return null;
  }

  if (usesSponsoredFeePayment(nodeUrl)) {
    for (const account of accounts) {
      const metadata = await wallet.getContractMetadata(account.item);
      if (metadata.initializationStatus === ContractInitializationStatus.INITIALIZED) {
        return account.item;
      }
    }

    return null;
  }

  const node = createAztecNodeClient(nodeUrl);
  let bestAddress: AztecAddress | null = null;
  let bestBalance = 0n;

  for (const account of accounts) {
    const metadata = await wallet.getContractMetadata(account.item);
    if (metadata.initializationStatus !== ContractInitializationStatus.INITIALIZED) {
      continue;
    }

    try {
      const balance = await getFeeJuiceBalance(account.item, node);
      if (balance >= REMOTE_EMBEDDED_MIN_READY_BALANCE && balance > bestBalance) {
        bestAddress = account.item;
        bestBalance = balance;
      }
    } catch (error) {
      console.warn('[embedded] Failed to read Fee Juice balance for account', account.item.toString(), error);
    }
  }

  return bestAddress;
}

async function deployRemoteEmbeddedAccount(wallet: EmbeddedWallet, nodeUrl: string) {
  const node = createAztecNodeClient(nodeUrl);
  const nodeInfo = await node.getNodeInfo();
  const l1Client = await createInjectedL1Client(nodeInfo.l1ChainId);
  const logger = createBrowserLogger();

  const secret = Fr.random();
  const salt = Fr.random();
  const accountManager = await wallet.createSchnorrAccount(secret, salt);

  const portalManager = await L1FeeJuicePortalManager.new(node, l1Client as any, logger);
  const claim = await portalManager.bridgeTokensPublic(
    accountManager.address,
    REMOTE_EMBEDDED_FEE_JUICE_AMOUNT,
    nodeInfo.l1ChainId !== 1
  );

  await waitForL1ToL2MessageReady(node, Fr.fromString(claim.messageHash), {
    timeoutSeconds: 300,
  });

  const deployMethod = await accountManager.getDeployMethod();
  await deployMethod.send({
    from: NO_FROM,
    skipClassPublication: true,
    fee: {
      paymentMethod: new FeeJuicePaymentMethodWithClaim(accountManager.address, claim),
    },
    wait: { timeout: 300000 },
  });

  return accountManager.address;
}

async function clearAztecIndexedDB(): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return;
  }

  const databases = await indexedDB.databases();
  const deletions = databases
    .filter((db) => db.name && AZTEC_DB_PREFIXES.some((prefix) => db.name!.startsWith(prefix)))
    .map(
      (db) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })
    );

  await Promise.all(deletions);
}

async function doInitWallet(nodeUrl: string): Promise<EmbeddedWallet> {
  if (cachedWallet) return cachedWallet;

  const config = getNetworkConfig();
  const isRemoteNetwork = !nodeUrl.includes('localhost') && !nodeUrl.includes('127.0.0.1');

  // Connect to Aztec node
  const aztecNode = createAztecNodeClient(nodeUrl);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const rollupAddress = l1Contracts.rollupAddress;

  // Create PXE
  const pxeConfig = getPXEConfig();
  pxeConfig.dataDirectory = `pxe-${rollupAddress}`;
  pxeConfig.proverEnabled = config.proverEnabled || isRemoteNetwork;
  pxeConfig.l1Contracts = l1Contracts;

  // Set up AcceleratorProver (routes to native desktop app at localhost:59833, falls back to WASM)
  const prover = new AcceleratorProver();
  cachedProver = prover;

  const acceleratorStatus = await prover.checkAcceleratorStatus();
  const { setAvailable, setPhase, setLastProofMs } = useAcceleratorStore.getState();
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
      // Clear phase after a short delay so UI returns to idle
      setTimeout(() => setPhase(null), 2000);
    } else {
      console.log(`[accelerator] Phase: ${phase}`);
    }
  });

  const pxe = await createPXE(aztecNode, pxeConfig, { proverOrOptions: prover });

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

  if (usesSponsoredFeePayment(nodeUrl)) {
    // Local/devnet use the canonical sponsor. Remote networks can opt into
    // the same UX by configuring a project-owned SponsoredFPC in env.
    const fpcInstance = await getSponsoredFpcInstance();
    await wallet.registerContract(fpcInstance, SponsoredFPCContract.artifact);
    cachedFeePaymentMethod = new SponsoredFeePaymentMethod(fpcInstance.address);
  } else {
    cachedFeePaymentMethod = null;
  }

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

async function initWallet(nodeUrl: string): Promise<EmbeddedWallet> {
  for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt++) {
    try {
      return await doInitWallet(nodeUrl);
    } catch (error) {
      resetCachedEmbeddedState();

      if (attempt === MAX_INIT_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `[embedded] Wallet initialization failed (attempt ${attempt}/${MAX_INIT_ATTEMPTS}), clearing stale IndexedDB and retrying...`
      );
      await clearAztecIndexedDB();
    }
  }

  throw new Error('Embedded wallet initialization failed.');
}

/** Try to reconnect a previously saved embedded account */
export async function reconnectEmbedded(
  nodeUrl: string
): Promise<EmbeddedConnectorResult | null> {
  const config = getNetworkConfig();
  const wallet = await initWallet(nodeUrl);
  const address = await findReconnectableAccount(wallet, nodeUrl);
  if (!address) return null;

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
  const existingAddress = await findReconnectableAccount(wallet, nodeUrl);

  if (existingAddress) {
    return {
      wallet,
      address: existingAddress,
      contractAddress: AztecAddress.fromString(config.contractAddress),
    };
  }

  let address: AztecAddress;

  if (usesSponsoredFeePayment(nodeUrl)) {
    const secret = Fr.random();
    const salt = Fr.random();
    const accountManager = await wallet.createSchnorrAccount(secret, salt);

    if (!cachedFeePaymentMethod) {
      throw new Error('Fee payment method not initialized. Call initWallet first.');
    }

    // additionalScopes is required here because the constructor initializes
    // private storage and needs the account's nullifier key in scope.
    const deployMethod = await accountManager.getDeployMethod();
    await deployMethod.send({
      from: NO_FROM,
      skipClassPublication: true,
      fee: { paymentMethod: cachedFeePaymentMethod },
      additionalScopes: [accountManager.address],
      wait: { timeout: 120000 },
    });

    address = accountManager.address;
  } else {
    address = await deployRemoteEmbeddedAccount(wallet, nodeUrl);
  }

  return {
    wallet,
    address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}
