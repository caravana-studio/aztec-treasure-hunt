import { Account } from '@aztec/aztec.js/account';
import { AccountManager, type DeployAccountOptions } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { randomBytes } from '@aztec/foundation/crypto/random';
import { Fr } from '@aztec/foundation/curves/bn254';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa/lazy';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr/lazy';
import { getInitialTestAccountsData } from '@aztec/accounts/testing/lazy';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { createLogger } from '@aztec/aztec.js/log';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { FeeService } from './FeeService';

const logger = createLogger('account-service');
const LOCAL_STORAGE_KEY = 'aztec-account';

export interface StoredAccount {
  address: string;
  signingKey: string;
  secretKey: string;
  salt: string;
}

export interface AccountData {
  accountManager: AccountManager;
  account: Account;
  address: AztecAddress;
}

/**
 * Service for managing Aztec accounts.
 * Handles account creation, storage, and retrieval.
 */
export class AccountService {
  /**
   * Create a new ECDSA account, deploy it, and store in localStorage.
   */
  static async createAndDeployAccount(wallet: BaseWallet): Promise<AccountData> {
    // Generate random credentials
    const salt = Fr.random();
    const secretKey = Fr.random();
    const signingKey = randomBytes(32);

    // Create ECDSA account contract
    const contract = new EcdsaRAccountContract(signingKey);
    const accountManager = await AccountManager.create(
      wallet,
      secretKey,
      contract,
      salt
    );

    // Register account before deployment
    await this.registerAccountWithWallet(wallet, accountManager);

    // Deploy the account with sponsored fees
    const sponsoredFPC = await FeeService.getSponsoredFPCContract();
    const deployMethod = await accountManager.getDeployMethod();
    const deployOpts: DeployAccountOptions = {
      from: AztecAddress.ZERO,
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(sponsoredFPC.instance.address),
      },
      skipClassPublication: true,
      skipInstancePublication: true,
    };

    const receipt = await deployMethod.send(deployOpts).wait({ timeout: 120 });
    logger.info('Account deployed', receipt);

    // Store credentials in localStorage
    this.saveToStorage({
      address: accountManager.address.toString(),
      signingKey: signingKey.toString('hex'),
      secretKey: secretKey.toString(),
      salt: salt.toString(),
    });

    return {
      accountManager,
      account: await accountManager.getAccount(),
      address: accountManager.address,
    };
  }

  /**
   * Load existing account from localStorage.
   */
  static async loadExistingAccount(wallet: BaseWallet): Promise<AccountData | null> {
    const stored = this.loadFromStorage();
    if (!stored) {
      return null;
    }

    try {
      const contract = new EcdsaRAccountContract(
        Buffer.from(stored.signingKey, 'hex')
      );
      const accountManager = await AccountManager.create(
        wallet,
        Fr.fromString(stored.secretKey),
        contract,
        Fr.fromString(stored.salt)
      );

      await this.registerAccountWithWallet(wallet, accountManager);

      return {
        accountManager,
        account: await accountManager.getAccount(),
        address: accountManager.address,
      };
    } catch (err) {
      logger.error('Failed to load existing account:', err);
      return null;
    }
  }

  /**
   * Connect to a test account (for development).
   */
  static async connectTestAccount(wallet: BaseWallet, index: number): Promise<AccountData> {
    const testAccounts = await getInitialTestAccountsData();
    const accountData = testAccounts[index];

    const accountManager = await AccountManager.create(
      wallet,
      accountData.secret,
      new SchnorrAccountContract(accountData.signingKey),
      accountData.salt
    );

    await this.registerAccountWithWallet(wallet, accountManager);

    return {
      accountManager,
      account: await accountManager.getAccount(),
      address: accountManager.address,
    };
  }

  /**
   * Register an account with the wallet.
   */
  private static async registerAccountWithWallet(
    wallet: BaseWallet,
    accountManager: AccountManager
  ): Promise<void> {
    const instance = await accountManager.getInstance();
    const artifact = await accountManager.getAccountContract().getContractArtifact();
    await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
  }

  /**
   * Save account data to localStorage.
   * WARNING: This stores secrets in plaintext. Not recommended for production.
   */
  private static saveToStorage(data: StoredAccount): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Load account data from localStorage.
   */
  private static loadFromStorage(): StoredAccount | null {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Clear stored account data.
   */
  static clearStorage(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  /**
   * Check if there's a stored account.
   */
  static hasStoredAccount(): boolean {
    return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
  }
}
