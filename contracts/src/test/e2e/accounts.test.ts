import { TreasureHuntContractArtifact, TreasureHuntContract } from "../../artifacts/TreasureHunt.js"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee'
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getAztecNodeUrl, getTimeouts } from "../../../config/config.js";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { TxStatus } from "@aztec/stdlib/tx";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";

describe("Accounts", () => {
    let wallet: EmbeddedWallet;
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let ownerAccount: AccountManager;

    let randomAccountManagers: AccountManager[] = [];
    let randomAddresses: AztecAddress[] = [];

    let node: AztecNode;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:accounts');
        logger.info(`Aztec-Starter tests running.`)
        const nodeUrl = getAztecNodeUrl();
        node = createAztecNodeClient(nodeUrl);
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Set up a wallet
        let secretKey = Fr.random();
        let signingKey = GrumpkinScalar.random();
        let salt = Fr.random();
        ownerAccount = await AccountManager.create(wallet, secretKey, new SchnorrAccountContract(signingKey), salt);
        await (await ownerAccount.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });
    }, 600000)

    beforeEach(async () => {
        // generate random accounts
        randomAccountManagers = await Promise.all(
            Array.from({ length: 2 }, async () => {
                const secretKey = Fr.random();
                const signingKey = GrumpkinScalar.random();
                const salt = Fr.random();
                return AccountManager.create(wallet, secretKey, new SchnorrAccountContract(signingKey), salt);
            })
        );
        // get corresponding addresses
        randomAddresses = randomAccountManagers.map(am => am.address);
    })

    it.skip("Creates accounts with fee juice", async () => {
        // TODO: L1 fee juice bridging tests require @aztec/ethereum and @aztec/protocol-contracts
        // Skipped pending v4 L1 API migration
    });

    it("Deploys first unfunded account from first funded account", async () => {
        const receipt = await (await randomAccountManagers[0].getDeployMethod())
            .send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } })
            .wait({ timeout: getTimeouts().deployTimeout });

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        const deployedAccount = await randomAccountManagers[0].getAccount();
        expect(deployedAccount.getAddress()).toEqual(randomAccountManagers[0].address);
    });

    it("Sponsored contract deployment", async () => {
        logger.info('Starting "Sponsored contract deployment" test');
        const salt = Fr.random();
        logger.info(`Using salt: ${salt.toString()}`);
        const TreasureHuntArtifact = TreasureHuntContractArtifact

        logger.info('Generating 2 Schnorr accounts...');
        const accounts = await Promise.all(
            Array.from({ length: 2 }, async () => {
                const secretKey = Fr.random();
                const signingKey = GrumpkinScalar.random();
                const salt = Fr.random();
                return AccountManager.create(wallet, secretKey, new SchnorrAccountContract(signingKey), salt);
            })
        );
        logger.info(`Generated accounts: ${accounts.map(a => a.address.toString()).join(', ')}`);

        logger.info('Deploying accounts...');
        await Promise.all(accounts.map(async (a, i) => {
            logger.info(`Deploying account ${i}: ${a.address.toString()}`);
            return (await a.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });
        }));
        logger.info('All accounts deployed');

        const deployedAccounts = await Promise.all(accounts.map(a => a.getAccount()));
        const [deployerAccount, adminAccount] = deployedAccounts;
        const [deployerAddress, adminAddress] = deployedAccounts.map(w => w.getAddress());
        logger.info(`Deployer address: ${deployerAddress.toString()}`);
        logger.info(`Admin address: ${adminAddress.toString()}`);

        const deploymentData = await getContractInstanceFromInstantiationParams(TreasureHuntArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerAccount.getAddress()
            });
        const deployer = new ContractDeployer(TreasureHuntArtifact, wallet);
        const tx = deployer.deploy(adminAddress).send({
            from: deployerAddress,
            contractAddressSalt: salt,
            fee: { paymentMethod: sponsoredPaymentMethod } // without the sponsoredFPC the deployment fails, thus confirming it works
        })

        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
                error: ''
            }),
        );

        const receiptAfterMined = await tx.wait({ wallet, timeout: getTimeouts().deployTimeout });
        expect(await wallet.getContractMetadata(deploymentData.address)).toBeDefined();
        expect((await wallet.getContractMetadata(deploymentData.address)).contractInstance).toBeTruthy();
        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        expect(receiptAfterMined.contract.address).toEqual(deploymentData.address)
    })

});
