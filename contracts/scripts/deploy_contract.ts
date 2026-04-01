import { TreasureHuntContract } from "../src/artifacts/TreasureHunt.js"
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod, FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import {
    deploySchnorrAccount,
    createSchnorrAccountManager,
    deployAccountManager,
} from "../src/utils/deploy_account.js";
import { bridgeFeeJuice, DEFAULT_FEE_JUICE_AMOUNT } from "../src/utils/bridge_fee_juice.js";
import { getTimeouts, getAztecNodeUrl } from "../config/config.js";
import configManager from "../config/config.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const CLIENT_DIR = path.resolve(process.cwd(), "../client");

function copyArtifactsToClient(logger: Logger) {
    logger.info('📦 Copying artifacts to client...');

    const artifactsSource = path.resolve(process.cwd(), "src/artifacts");
    const targetSource = path.resolve(process.cwd(), "target");
    const artifactsDest = path.resolve(CLIENT_DIR, "src/artifacts");
    const targetDest = path.resolve(CLIENT_DIR, "target");

    if (!fs.existsSync(artifactsDest)) {
        fs.mkdirSync(artifactsDest, { recursive: true });
    }

    const artifactFiles = fs.readdirSync(artifactsSource).filter(f => f.endsWith('.ts'));
    for (const file of artifactFiles) {
        fs.copyFileSync(
            path.join(artifactsSource, file),
            path.join(artifactsDest, file)
        );
        logger.info(`   Copied ${file}`);
    }

    if (fs.existsSync(targetSource)) {
        execSync(`cp -r "${targetSource}" "${targetDest}"`, { stdio: 'inherit' });
        logger.info(`   Copied target/ directory`);
    }

    logger.info('✅ Artifacts copied to client successfully');
}

function writeClientEnv(
    logger: Logger,
    contractAddress: string,
    deployerAddress: string,
    adminAddress: string,
    deploymentSalt: string
) {
    const env = configManager.getConfig().environment;
    const envSuffix = env === 'local' ? '.env.local' : `.env.${env}`;
    logger.info(`📝 Writing client ${envSuffix} file...`);

    const envFilePath = path.resolve(CLIENT_DIR, envSuffix);
    const nodeUrl = getAztecNodeUrl();

    const envContent = `VITE_CONTRACT_ADDRESS=${contractAddress}
VITE_DEPLOYER_ADDRESS=${deployerAddress}
VITE_ADMIN_ADDRESS=${adminAddress}
VITE_DEPLOYMENT_SALT=${deploymentSalt}
VITE_AZTEC_NODE_URL=${nodeUrl}
`;

    fs.writeFileSync(envFilePath, envContent);
    logger.info(`✅ Client .env written to ${envFilePath}`);
}

async function main() {
    const logger = createLogger('aztec:treasure-hunt');
    logger.info(`🚀 Starting contract deployment process...`);

    const timeouts = getTimeouts();
    const hasSponsoredFPC = configManager.hasSponsoredFPC();

    // Setup wallet
    logger.info('📡 Setting up wallet...');
    const wallet = await setupWallet();
    logger.info(`📊 Wallet set up successfully`);

    let accountManager;
    let contractPaymentMethod;

    if (hasSponsoredFPC) {
        // ── Local / Devnet: use SponsoredFPC ──────────────────────────────
        logger.info('💰 Setting up SponsoredFPC fee payment...');
        const sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
        logger.info(`✅ SponsoredFPC configured at: ${sponsoredFPC.address}`);

        logger.info('👤 Deploying Schnorr account...');
        accountManager = await deploySchnorrAccount(wallet);
        logger.info(`✅ Account deployed at: ${accountManager.address}`);

        contractPaymentMethod = sponsoredPaymentMethod;

    } else {
        // ── Mainnet / Testnet: bridge Fee Juice from L1 ───────────────────
        const l1PrivateKey = process.env.L1_PRIVATE_KEY;
        if (!l1PrivateKey) {
            throw new Error(
                '❌ L1_PRIVATE_KEY env var is required for mainnet/testnet deploy.\n' +
                '   Set it to the private key of an Ethereum account with ETH for L1 gas.\n' +
                '   Example: L1_PRIVATE_KEY=0x... yarn deploy::mainnet'
            );
        }

        // Create account manager first to get the deterministic L2 address
        logger.info('👤 Creating Schnorr account (not yet deployed)...');
        accountManager = await createSchnorrAccountManager(wallet);
        logger.info(`📍 Account address: ${accountManager.address}`);

        // Bridge Fee Juice from L1 to the new account address
        const bridgeAmount = BigInt(configManager.getConfig().settings.bridgeAmount ?? DEFAULT_FEE_JUICE_AMOUNT);
        const claim = await bridgeFeeJuice(
            accountManager.address,
            l1PrivateKey,
            bridgeAmount,
            logger
        );

        // Deploy account using the claim to pay fees
        logger.info('👤 Deploying account with Fee Juice claim...');
        const claimPaymentMethod = new FeeJuicePaymentMethodWithClaim(accountManager.address, claim);
        await deployAccountManager(wallet, accountManager, claimPaymentMethod, logger);
        logger.info(`✅ Account deployed at: ${accountManager.address}`);

        // After claim, the account has Fee Juice — subsequent txs are auto-paid
        contractPaymentMethod = undefined;
    }

    const address = accountManager.address;

    // Deploy TreasureHunt contract
    logger.info('🏴‍☠️  Starting treasure hunt contract deployment...');
    logger.info(`📋 Admin address for treasure hunt contract: ${address}`);

    const deployRequest = TreasureHuntContract.deploy(wallet, address);

    logger.info('🔍 Simulating deployment...');
    await deployRequest.simulate({ from: address });
    logger.info('✅ Simulation successful');

    const sendOptions: any = {
        from: address,
        wait: { timeout: timeouts.deployTimeout, returnReceipt: true }
    };
    if (contractPaymentMethod) {
        sendOptions.fee = { paymentMethod: contractPaymentMethod };
    }

    const deployResult = await deployRequest.send(sendOptions);
    const receipt = deployResult.receipt;
    const treasureHuntContract = receipt.contract;
    const instance = receipt.instance;

    logger.info(`🎉 Treasure Hunt Contract deployed successfully!`);
    logger.info(`📍 Contract address: ${treasureHuntContract.address}`);
    logger.info(`👤 Admin address: ${address}`);

    logger.info('📦 Contract instantiation data:');
    logger.info(`Salt: ${instance.salt}`);
    logger.info(`Deployer: ${instance.deployer}`);
    if (instance.publicKeys) {
        logger.info(`Public Keys - Master Nullifier: ${instance.publicKeys.masterNullifierPublicKey}`);
        logger.info(`Public Keys - Master Incoming Viewing: ${instance.publicKeys.masterIncomingViewingPublicKey}`);
        logger.info(`Public Keys - Master Outgoing Viewing: ${instance.publicKeys.masterOutgoingViewingPublicKey}`);
        logger.info(`Public Keys - Master Tagging: ${instance.publicKeys.masterTaggingPublicKey}`);
    }
    logger.info(`Constructor args: ${JSON.stringify([address.toString()])}`);

    if (configManager.isLocalNetwork()) {
        copyArtifactsToClient(logger);
    } else {
        logger.info('⏭️  Skipping artifact copy for remote deploy');
    }
    writeClientEnv(
        logger,
        treasureHuntContract.address.toString(),
        instance.deployer.toString(),
        address.toString(),
        instance.salt.toString()
    );

    logger.info('🏁 Deployment process completed successfully!');
    logger.info(`📋 Summary:`);
    logger.info(`   - Contract Address: ${treasureHuntContract.address}`);
    logger.info(`   - Admin Address: ${address}`);
    logger.info(`   - Fee method: ${hasSponsoredFPC ? 'SponsoredFPC' : 'Fee Juice (bridged from L1)'}`);
    logger.info(`   - Client .env: Updated ✅`);
    if (configManager.isLocalNetwork()) logger.info(`   - Client artifacts: Copied ✅`);
}

main().catch((error) => {
    const logger = createLogger('aztec:treasure-hunt');
    logger.error(`❌ Deployment failed: ${error.message || error}`);
    if (error.stack) {
        logger.error(`📋 Error details: ${error.stack}`);
    }
    process.exit(1);
});
