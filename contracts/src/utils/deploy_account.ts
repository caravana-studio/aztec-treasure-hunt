import { NO_FROM } from "@aztec/aztec.js/account";
import type { FeePaymentMethod } from "@aztec/aztec.js/fee";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "./setup_wallet.js";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";

/**
 * Creates a Schnorr AccountManager without deploying it.
 * Use this when you need the account address before deploying
 * (e.g., to bridge Fee Juice to that address first).
 */
export async function createSchnorrAccountManager(wallet: EmbeddedWallet): Promise<AccountManager> {
    const logger = createLogger('aztec:aztec-starter');

    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();

    logger.info(`Save the following SECRET and SALT in .env for future use.`);
    logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
    logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
    logger.info(`🧂 Salt generated: ${salt.toString()}`);

    const account = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    logger.info(`📍 Account address will be: ${account.address}`);

    return account;
}

/**
 * Deploys a pre-created AccountManager using the given fee payment method.
 */
export async function deployAccountManager(
    wallet: EmbeddedWallet,
    accountManager: AccountManager,
    paymentMethod: FeePaymentMethod,
    logger: Logger
): Promise<void> {
    const deployMethod = await accountManager.getDeployMethod();
    const tx = await deployMethod.send({
        from: NO_FROM,
        skipClassPublication: true,
        fee: { paymentMethod },
        wait: { timeout: 120000, returnReceipt: true },
    });
    logger.info(`✅ Account deployment transaction successful!`);
    logger.info(`📋 Transaction hash: ${tx.receipt.txHash}`);
}

/**
 * Creates and deploys a Schnorr account using SponsoredFPC for fees.
 * Use for local network and devnet where SponsoredFPC is available.
 */
export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
    const logger = createLogger('aztec:aztec-starter');
    logger.info('👤 Starting Schnorr account deployment...');
    logger.info('🔐 Generating account keys...');

    const activeWallet = wallet ?? await setupWallet();
    const account = await createSchnorrAccountManager(activeWallet);

    logger.info('💰 Setting up sponsored fee payment for account deployment...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('📝 Registering sponsored FPC contract with PXE...');
    await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('✅ Sponsored fee payment method configured for account deployment');

    await deployAccountManager(activeWallet, account, paymentMethod, logger);

    return account;
}
