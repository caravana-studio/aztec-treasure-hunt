import { Account, SignerlessAccount } from '@aztec/aztec.js/account';
import { createLogger } from '@aztec/aztec.js/log';
import { AccountFeePaymentMethodOptions } from '@aztec/entrypoints/account';
import { GasSettings } from '@aztec/stdlib/gas';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { type AztecNode } from '@aztec/aztec.js/node';
import { type FeeOptions, BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import type { PXE } from '@aztec/pxe/client/bundle';
import { PXEService } from './services/aztec/PXEService';
import { FeeService } from './services/aztec/FeeService';
import { AccountService } from './services/aztec/AccountService';

const logger = createLogger('wallet');

/**
 * Embedded Wallet implementation for browser-based Aztec interactions.
 * Uses singleton PXE service and modular account/fee services.
 *
 * WARNING: This stores credentials in localStorage in plaintext.
 * Do not use in production without proper key management.
 */
export class EmbeddedWallet extends BaseWallet {
  connectedAccount: AztecAddress | null = null;
  protected accounts: Map<string, Account> = new Map();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe, aztecNode);
  }

  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    if (address.equals(AztecAddress.ZERO)) {
      return new SignerlessAccount();
    }

    const account = this.accounts.get(address.toString());
    if (!account) {
      throw new Error(`Account not found in wallet for address: ${address}`);
    }
    return account;
  }

  /**
   * Get default fee options with sponsored fee payment.
   */
  protected override async completeFeeOptions(
    from: AztecAddress,
    feePayer?: AztecAddress,
    gasSettings?: Partial<GasSettings>
  ): Promise<FeeOptions> {
    const maxFeesPerGas =
      gasSettings?.maxFeesPerGas ??
      (await this.aztecNode.getCurrentMinFees()).mul(1 + this.minFeePadding);

    let walletFeePaymentMethod;
    let accountFeePaymentMethodOptions;

    if (!feePayer) {
      walletFeePaymentMethod = await FeeService.createSponsoredFeePaymentMethod();
      accountFeePaymentMethodOptions = AccountFeePaymentMethodOptions.EXTERNAL;
    } else {
      accountFeePaymentMethodOptions = from.equals(feePayer)
        ? AccountFeePaymentMethodOptions.FEE_JUICE_WITH_CLAIM
        : AccountFeePaymentMethodOptions.EXTERNAL;
    }

    const fullGasSettings = GasSettings.default({ ...gasSettings, maxFeesPerGas });
    this.log.debug('Using L2 gas settings', fullGasSettings);

    return {
      gasSettings: fullGasSettings,
      walletFeePaymentMethod,
      accountFeePaymentMethodOptions,
    };
  }

  getAccounts() {
    return Promise.resolve(
      Array.from(this.accounts.values()).map((acc) => ({
        alias: '',
        item: acc.getAddress(),
      }))
    );
  }

  /**
   * Initialize the wallet with PXE connection.
   */
  static async initialize(nodeUrl: string): Promise<EmbeddedWallet> {
    const { pxe, aztecNode } = await PXEService.getInstance(nodeUrl, false);

    // Register Sponsored FPC Contract with PXE
    await FeeService.registerWithPXE(pxe);

    const nodeInfo = await aztecNode.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);

    return new EmbeddedWallet(pxe, aztecNode);
  }

  getConnectedAccount(): AztecAddress | null {
    return this.connectedAccount;
  }

  /**
   * Connect to a test account (for development).
   */
  async connectTestAccount(index: number): Promise<AztecAddress> {
    const { account, address } = await AccountService.connectTestAccount(this, index);
    this.accounts.set(address.toString(), account);
    this.connectedAccount = address;
    return address;
  }

  /**
   * Create a new account and connect to it.
   */
  async createAccountAndConnect(): Promise<AztecAddress> {
    if (!this.pxe) {
      throw new Error('PXE not initialized');
    }

    const { account, address } = await AccountService.createAndDeployAccount(this);
    this.accounts.set(address.toString(), account);
    this.connectedAccount = address;
    return address;
  }

  /**
   * Connect to an existing account from localStorage.
   */
  async connectExistingAccount(): Promise<AztecAddress | null> {
    const accountData = await AccountService.loadExistingAccount(this);
    if (!accountData) {
      return null;
    }

    this.accounts.set(accountData.address.toString(), accountData.account);
    this.connectedAccount = accountData.address;
    return accountData.address;
  }

}
