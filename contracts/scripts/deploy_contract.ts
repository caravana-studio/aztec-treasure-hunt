import { TreasureHuntContract } from "../src/artifacts/TreasureHunt.js"
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
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

    // Create artifacts directory if it doesn't exist
    if (!fs.existsSync(artifactsDest)) {
        fs.mkdirSync(artifactsDest, { recursive: true });
    }

    // Copy .ts files from artifacts
    const artifactFiles = fs.readdirSync(artifactsSource).filter(f => f.endsWith('.ts'));
    for (const file of artifactFiles) {
        fs.copyFileSync(
            path.join(artifactsSource, file),
            path.join(artifactsDest, file)
        );
        logger.info(`   Copied ${file}`);
    }

    // Copy target directory
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
    deploymentSalt: string
) {
    const envSuffix = configManager.isDevnet() ? '.env.devnet' : '.env.local';
    logger.info(`📝 Writing client ${envSuffix} file...`);

    const envFilePath = path.resolve(CLIENT_DIR, envSuffix);
    const nodeUrl = getAztecNodeUrl();

    const envContent = `VITE_CONTRACT_ADDRESS=${contractAddress}
VITE_DEPLOYER_ADDRESS=${deployerAddress}
VITE_DEPLOYMENT_SALT=${deploymentSalt}
VITE_AZTEC_NODE_URL=${nodeUrl}
`;

    fs.writeFileSync(envFilePath, envContent);
    logger.info(`✅ Client .env written to ${envFilePath}`);
}

async function main() {
    let logger: Logger;

    logger = createLogger('aztec:treasure-hunt');
    logger.info(`🚀 Starting contract deployment process...`);

    const timeouts = getTimeouts();

    // Setup wallet
    logger.info('📡 Setting up wallet...');
    const wallet = await setupWallet();
    logger.info(`📊 Wallet set up successfully`);

    // Setup sponsored FPC
    logger.info('💰 Setting up sponsored fee payment contract...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('📝 Registering sponsored FPC contract with wallet...');
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('✅ Sponsored fee payment method configured');

    // Deploy account
    logger.info('👤 Deploying Schnorr account...');
    let accountManager = await deploySchnorrAccount(wallet);
    const address = accountManager.address;
    logger.info(`✅ Account deployed successfully at: ${address}`);

    // Deploy treasure hunt contract
    logger.info('🏴‍☠️  Starting treasure hunt contract deployment...');
    logger.info(`📋 Admin address for treasure hunt contract: ${address}`);

    const deployRequest = TreasureHuntContract.deploy(wallet, address);

    logger.info('🔍 Simulating deployment...');
    await deployRequest.simulate({ from: address });
    logger.info('✅ Simulation successful');

    const deployResult = await deployRequest.send({
        from: address,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout: timeouts.deployTimeout, returnReceipt: true }
    });

    const treasureHuntContract = deployResult.contract;
    const instance = deployResult.instance;

    logger.info(`🎉 Treasure Hunt Contract deployed successfully!`);
    logger.info(`📍 Contract address: ${treasureHuntContract.address}`);
    logger.info(`👤 Admin address: ${address}`);

    // Verify deployment
    logger.info('🔍 Verifying contract deployment...');
    logger.info('✅ Contract deployed and ready for game creation');

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

    // Copy artifacts only for local deploys (avoid overwriting)
    if (!configManager.isDevnet()) {
        copyArtifactsToClient(logger);
    } else {
        logger.info('⏭️  Skipping artifact copy for devnet deploy');
    }
    writeClientEnv(
        logger,
        treasureHuntContract.address.toString(),
        instance.deployer.toString(),
        instance.salt.toString()
    );

    logger.info('🏁 Deployment process completed successfully!');
    logger.info(`📋 Summary:`);
    logger.info(`   - Contract Address: ${treasureHuntContract.address}`);
    logger.info(`   - Admin Address: ${address}`);
    logger.info(`   - Sponsored FPC: ${sponsoredFPC.address}`);
    logger.info(`   - Client .env: Updated ✅`);
    logger.info(`   - Client artifacts: Copied ✅`);
}

main().catch((error) => {
    const logger = createLogger('aztec:treasure-hunt');
    logger.error(`❌ Deployment failed: ${error.message || error}`);
    if (error.stack) {
        logger.error(`📋 Error details: ${error.stack}`);
    }
    process.exit(1);
});
