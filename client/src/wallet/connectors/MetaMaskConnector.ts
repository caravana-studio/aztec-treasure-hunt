/**
 * MetaMask / External Signer Connector
 *
 * Uses window.ethereum to detect MetaMask (or any injected EVM wallet). The
 * user signs a deterministic message and we derive a Schnorr secret key from
 * that signature, creating a stable Aztec account tied to their ETH wallet.
 *
 * PXE is managed locally (same as Embedded). MetaMask only signs one message.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { EmbeddedWallet } from '../../embedded-wallet';
import { PXEService } from '../../services/aztec/PXEService';
import { FeeService } from '../../services/aztec/FeeService';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig } from '../../config/network';

const METAMASK_ACCOUNT_KEY = 'aztec-metamask-account';

interface StoredMetaMaskAccount {
  ethAddress: string;
  secretKey: string;
  signingKey: string;
  salt: string;
}

function getEthereumProvider(): NonNullable<typeof window.ethereum> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No EVM wallet found. Please install MetaMask or another EVM wallet.');
  }
  return window.ethereum;
}

async function requestEthAccount(provider: NonNullable<typeof window.ethereum>): Promise<string> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts?.length) throw new Error('No ETH accounts available');
  return accounts[0];
}

async function signMessage(provider: NonNullable<typeof window.ethereum>, ethAddress: string): Promise<string> {
  const message = `Aztec Treasure Hunt - Derive Account Key\n\nThis signature derives your Aztec account. It grants no permissions.\n\nWallet: ${ethAddress}`;
  const hexMsg = '0x' + Buffer.from(message, 'utf8').toString('hex');
  return provider.request({ method: 'personal_sign', params: [hexMsg, ethAddress] }) as Promise<string>;
}

/**
 * Derive deterministic Schnorr keys from a MetaMask signature.
 * Uses simple byte mixing — sufficient for deriving deterministic, non-secret keys.
 */
function deriveKeys(signature: string, ethAddress: string): {
  secretKey: Fr;
  signingKey: GrumpkinScalar;
  salt: Fr;
} {
  const mix = (data: Buffer, tag: string): Buffer => {
    const input = Buffer.concat([data, Buffer.from(tag, 'utf8')]);
    const out = Buffer.alloc(32);
    for (let i = 0; i < input.length; i++) {
      out[i % 32] ^= input[i];
      out[(i + 3) % 32] ^= (input[i] * 0x9e) & 0xff;
      out[(i + 7) % 32] ^= ((input[i] << 1) | (input[i] >> 7)) & 0xff;
    }
    // Extra mixing passes
    for (let p = 0; p < 8; p++) {
      for (let i = 0; i < 32; i++) {
        out[i] = (out[i] ^ out[(i + 11) % 32] ^ (p * 0x37)) & 0xff;
      }
    }
    return out;
  };

  const sigBuf = Buffer.from(signature.replace('0x', ''), 'hex');
  const addrBuf = Buffer.from(ethAddress.replace('0x', '').toLowerCase(), 'hex');
  const combined = Buffer.concat([sigBuf, addrBuf]);

  return {
    secretKey: Fr.fromBuffer(mix(combined, 'aztec-secret-v1')),
    signingKey: GrumpkinScalar.fromBuffer(mix(combined, 'aztec-signing-v1')),
    salt: Fr.fromBuffer(mix(combined, 'aztec-salt-v1')),
  };
}

export interface MetaMaskConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

export async function connectMetaMask(nodeUrl: string): Promise<MetaMaskConnectorResult> {
  const config = getNetworkConfig();
  const provider = getEthereumProvider();
  const ethAddress = await requestEthAccount(provider);

  // Restore or derive keys
  const stored = loadStoredAccount(ethAddress);
  let secretKey: Fr, signingKey: GrumpkinScalar, salt: Fr;

  if (stored) {
    secretKey = Fr.fromString(stored.secretKey);
    signingKey = GrumpkinScalar.fromString(stored.signingKey);
    salt = Fr.fromString(stored.salt);
  } else {
    const signature = await signMessage(provider, ethAddress);
    ({ secretKey, signingKey, salt } = deriveKeys(signature, ethAddress));
  }

  // Init PXE + wallet
  const { pxe, aztecNode } = await PXEService.getInstance(nodeUrl, false);
  await FeeService.registerWithPXE(pxe);
  const wallet = new EmbeddedWallet(pxe, aztecNode);

  // Register TreasureHunt contract
  const contractInstance = await getContractInstanceFromInstantiationParams(
    TreasureHuntContract.artifact,
    {
      deployer: AztecAddress.fromString(config.deployerAddress),
      salt: Fr.fromString(config.deploymentSalt),
      constructorArgs: [AztecAddress.fromString(config.deployerAddress)],
    }
  );
  await wallet.registerContract(contractInstance, TreasureHuntContract.artifact);
  const contractAddress = AztecAddress.fromString(config.contractAddress);

  // Create AccountManager with Schnorr contract
  const accountContract = new SchnorrAccountContract(signingKey);
  const accountManager = await AccountManager.create(wallet, secretKey, accountContract, salt);

  // Register account with wallet (needed for PXE to track it)
  const accountInstance = await accountManager.getInstance();
  const artifact = await accountManager.getAccountContract().getContractArtifact();
  await wallet.registerContract(accountInstance, artifact, accountManager.getSecretKey());

  // Deploy the account (SDK ignores it if already deployed)
  try {
    const fpc = await FeeService.getSponsoredFPCContract();
    const deployMethod = await accountManager.getDeployMethod();
    await deployMethod.send({
      from: AztecAddress.ZERO,
      fee: { paymentMethod: new SponsoredFeePaymentMethod(fpc.instance.address) },
      wait: { timeout: 120000 },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exist')) {
      throw err;
    }
    // Account already deployed — that's fine
  }

  // Save account for future sessions
  if (!stored) {
    saveAccount({ ethAddress, secretKey: secretKey.toString(), signingKey: signingKey.toString(), salt: salt.toString() });
  }

  // Expose account through the wallet
  const account = await accountManager.getAccount();
  const address = accountManager.address;
  (wallet as any).accounts.set(address.toString(), account);
  (wallet as any).connectedAccount = address;

  return { wallet, address, contractAddress };
}

function loadStoredAccount(ethAddress: string): StoredMetaMaskAccount | null {
  try {
    const raw = localStorage.getItem(METAMASK_ACCOUNT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredMetaMaskAccount;
    if (data.ethAddress.toLowerCase() !== ethAddress.toLowerCase()) return null;
    return data;
  } catch {
    return null;
  }
}

function saveAccount(data: StoredMetaMaskAccount): void {
  localStorage.setItem(METAMASK_ACCOUNT_KEY, JSON.stringify(data));
}
