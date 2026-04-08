import { FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getCanonicalFeeJuice } from "@aztec/protocol-contracts/fee-juice";
import { bridgeFeeJuice } from "../src/utils/bridge_fee_juice.js";
import {
    createSchnorrAccountManager,
    deployAccountManager,
} from "../src/utils/deploy_account.js";
import { setupWallet } from "../src/utils/setup_wallet.js";
import {
    REMOTE_SPONSORED_FPC_SALT,
    setupSponsoredFPC,
} from "../src/utils/sponsored_fpc.js";
import configManager, { getTimeouts } from "../config/config.js";

const DEFAULT_REFILL_BOOTSTRAP_AMOUNT = 50_000_000_000_000_000_000n;

function getRequiredL1PrivateKey(): string {
    const l1PrivateKey = process.env.L1_PRIVATE_KEY;
    if (!l1PrivateKey) {
        throw new Error(
            "❌ L1_PRIVATE_KEY env var is required to refill the SponsoredFPC.\n" +
            "   Example: L1_PRIVATE_KEY=0x... npm run refill-sponsored-fpc::testnet"
        );
    }
    return l1PrivateKey;
}

function getRefillAmount(): bigint {
    return BigInt(
        process.env.SPONSORED_FPC_REFILL_AMOUNT ??
        configManager.getConfig().settings.sponsoredFPCFundingAmount ??
        0
    );
}

function getBootstrapAmount(): bigint {
    return BigInt(
        process.env.SPONSORED_FPC_BOOTSTRAP_AMOUNT ??
        DEFAULT_REFILL_BOOTSTRAP_AMOUNT
    );
}

async function bootstrapFeePayer(wallet: Awaited<ReturnType<typeof setupWallet>>, logger: Logger) {
    const l1PrivateKey = getRequiredL1PrivateKey();
    const bootstrapAmount = getBootstrapAmount();

    logger.info("👤 Creating temporary Schnorr account for refill...");
    const accountManager = await createSchnorrAccountManager(wallet);
    logger.info(`📍 Temporary refill account: ${accountManager.address}`);

    const claim = await bridgeFeeJuice(
        accountManager.address,
        l1PrivateKey,
        bootstrapAmount,
        logger
    );

    logger.info("👤 Deploying temporary refill account...");
    const claimPaymentMethod = new FeeJuicePaymentMethodWithClaim(accountManager.address, claim);
    await deployAccountManager(wallet, accountManager, claimPaymentMethod, logger);
    logger.info(`✅ Temporary refill account deployed at: ${accountManager.address}`);

    return { accountManager, l1PrivateKey };
}

async function main() {
    const logger = createLogger("aztec:treasure-hunt");
    const timeouts = getTimeouts();

    if (!configManager.hasSponsoredFPC()) {
        throw new Error("This network does not use SponsoredFPC.");
    }

    if (configManager.isLocalNetwork() || configManager.isDevnet()) {
        throw new Error("SponsoredFPC refills are only needed for testnet/mainnet.");
    }

    const refillAmount = getRefillAmount();
    if (refillAmount <= 0n) {
        throw new Error("SPONSORED_FPC_REFILL_AMOUNT must be greater than 0.");
    }

    logger.info("🚀 Starting SponsoredFPC refill...");
    logger.info(`💰 Refill amount: ${refillAmount}`);

    const wallet = await setupWallet();
    const { accountManager, l1PrivateKey } = await bootstrapFeePayer(wallet, logger);

    const sponsoredFPC = await setupSponsoredFPC(
        wallet,
        (message: string) => logger.info(message),
        REMOTE_SPONSORED_FPC_SALT,
        accountManager.address
    );

    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    logger.info(`📍 SponsoredFPC address: ${sponsoredFPC.address}`);

    const claim = await bridgeFeeJuice(
        sponsoredFPC.address,
        l1PrivateKey,
        refillAmount,
        logger
    );

    const feeJuiceInstance = await getCanonicalFeeJuice();
    await wallet.registerContract(feeJuiceInstance.instance, FeeJuiceContract.artifact);
    const feeJuice = await FeeJuiceContract.at(feeJuiceInstance.address, wallet);

    logger.info("📥 Claiming Fee Juice into SponsoredFPC...");
    await feeJuice.methods
        .claim(
            sponsoredFPC.address,
            claim.claimAmount,
            claim.claimSecret,
            claim.messageLeafIndex
        )
        .send({
            from: accountManager.address,
            wait: { timeout: timeouts.txTimeout, returnReceipt: true },
        });

    const sponsoredBalance = await feeJuice.methods
        .balance_of_public(sponsoredFPC.address)
        .simulate({ from: accountManager.address });

    logger.info(`✅ SponsoredFPC refill complete. Current balance: ${sponsoredBalance}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
