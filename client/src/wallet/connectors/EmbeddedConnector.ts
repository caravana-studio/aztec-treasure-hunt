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
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { createStore } from '@aztec/kv-store/indexeddb';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createPXE, getPXEConfig } from '@aztec/pxe/client/lazy';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { EmbeddedWallet, WalletDB } from '@aztec/wallets/embedded';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig } from '../../config/network';

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

export interface EmbeddedConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

async function initWallet(nodeUrl: string): Promise<EmbeddedWallet> {
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

  const pxe = await createPXE(aztecNode, pxeConfig);

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

  // Register Sponsored FPC contract
  const fpcInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: new Fr(SPONSORED_FPC_SALT) }
  );
  await wallet.registerContract(fpcInstance, SponsoredFPCContract.artifact);
  cachedFeePaymentMethod = new SponsoredFeePaymentMethod(fpcInstance.address);

  // Register game contract
  const gameInstance = await getContractInstanceFromInstantiationParams(
    TreasureHuntContract.artifact,
    {
      deployer: AztecAddress.fromString(config.deployerAddress),
      salt: Fr.fromString(config.deploymentSalt),
      constructorArgs: [AztecAddress.fromString(config.deployerAddress)],
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

  // Deploy account with sponsored fees
  const deployMethod = await accountManager.getDeployMethod();
  await deployMethod.send({
    from: NO_FROM,
    skipClassPublication: true,
    fee: { paymentMethod: cachedFeePaymentMethod! },
    wait: { timeout: 120000 },
  });

  return {
    wallet,
    address: accountManager.address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}
