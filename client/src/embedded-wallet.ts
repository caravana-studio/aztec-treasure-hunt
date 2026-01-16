import { Account, SignerlessAccount } from '@aztec/aztec.js/account';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { createLogger } from '@aztec/aztec.js/log';
import { AccountManager, type SimulateOptions } from '@aztec/aztec.js/wallet';
import { AccountFeePaymentMethodOptions } from '@aztec/entrypoints/account';
import { Fr } from '@aztec/foundation/curves/bn254';
import {
  getStubAccountContractArtifact,
  createStubAccount,
} from '@aztec/accounts/stub/lazy';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import {
  ExecutionPayload,
  mergeExecutionPayloads,
  type TxSimulationResult,
} from '@aztec/stdlib/tx';
import { GasSettings } from '@aztec/stdlib/gas';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { type FeeOptions, BaseWallet } from '@aztec/wallet-sdk/base-wallet';
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

  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    if (address.equals(AztecAddress.ZERO)) {
      const chainInfo = await this.getChainInfo();
      return new SignerlessAccount(chainInfo);
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
      (await this.aztecNode.getCurrentBaseFees()).mul(1 + this.baseFeePadding);

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

  private async getFakeAccountDataFor(address: AztecAddress) {
    const chainInfo = await this.getChainInfo();
    const originalAccount = await this.getAccountFromAddress(address);
    const originalAddress = await originalAccount.getCompleteAddress();
    const { contractInstance } = await this.pxe.getContractMetadata(originalAddress.address);

    if (!contractInstance) {
      throw new Error(`No contract instance found for address: ${originalAddress.address}`);
    }

    const stubAccount = createStubAccount(originalAddress, chainInfo);
    const StubAccountContractArtifact = await getStubAccountContractArtifact();
    const instance = await getContractInstanceFromInstantiationParams(
      StubAccountContractArtifact,
      { salt: Fr.random() }
    );

    return {
      account: stubAccount,
      instance,
      artifact: StubAccountContractArtifact,
    };
  }

  async simulateTx(
    executionPayload: ExecutionPayload,
    opts: SimulateOptions
  ): Promise<TxSimulationResult> {
    const feeOptions = opts.fee?.estimateGas
      ? await this.completeFeeOptionsForEstimation(
          opts.from,
          executionPayload.feePayer,
          opts.fee?.gasSettings
        )
      : await this.completeFeeOptions(
          opts.from,
          executionPayload.feePayer,
          opts.fee?.gasSettings
        );

    const feeExecutionPayload = await feeOptions.walletFeePaymentMethod?.getExecutionPayload();

    const executionOptions = {
      txNonce: Fr.random(),
      cancellable: this.cancellableTransactions,
      feePaymentMethodOptions: feeOptions.accountFeePaymentMethodOptions,
    };

    const finalExecutionPayload = feeExecutionPayload
      ? mergeExecutionPayloads([feeExecutionPayload, executionPayload])
      : executionPayload;

    const { account: fromAccount, instance, artifact } = await this.getFakeAccountDataFor(opts.from);

    const txRequest = await fromAccount.createTxExecutionRequest(
      finalExecutionPayload,
      feeOptions.gasSettings,
      executionOptions
    );

    const contractOverrides = {
      [opts.from.toString()]: { instance, artifact },
    };

    return this.pxe.simulateTx(txRequest, true, true, true, { contracts: contractOverrides });
  }
}
