// End-to-end tests for the Treasure Hunt game contract
// Tests the game lifecycle on a real Aztec network

import { TreasureHuntContract } from "../../artifacts/TreasureHunt.js"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";

// Test constants
const TEST_GAME_IDS = {
    CREATE: 1,
    JOIN: 2,
    PLACE_TREASURES: 3,
    FULL_SETUP: 4,
    DIG: 5,
    DETECTOR: 6,
    SHOVEL: 7,
    TRAP: 8,
};

// Sample treasure positions
const TREASURES = {
    player1: { x1: 0, y1: 0, x2: 7, y2: 7, x3: 0, y3: 7 },  // Corners
    player2: { x1: 3, y1: 3, x2: 4, y2: 4, x3: 5, y3: 5 },  // Middle
};

describe("Treasure Hunt Game", () => {
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let wallet: TestWallet;
    let player1Account: AccountManager;
    let player2Account: AccountManager;
    let contract: TreasureHuntContract;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:treasure-hunt');
        logger.info(`Treasure Hunt tests running.`)
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Create two player accounts
        logger.info('Creating player accounts...');
        let secretKey1 = Fr.random();
        let signingKey1 = GrumpkinScalar.random();
        let salt1 = Fr.random();
        player1Account = await wallet.createSchnorrAccount(secretKey1, salt1, signingKey1);
        await (await player1Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        let secretKey2 = Fr.random();
        let signingKey2 = GrumpkinScalar.random();
        let salt2 = Fr.random();
        player2Account = await wallet.createSchnorrAccount(secretKey2, salt2, signingKey2);
        await (await player2Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        await wallet.registerSender(player1Account.address);
        await wallet.registerSender(player2Account.address);
        logger.info('Player accounts created and registered');

        // Deploy the contract once for all tests
        logger.info('Deploying Treasure Hunt contract...');
        const adminAddress = player1Account.address;
        contract = await TreasureHuntContract.deploy(wallet, adminAddress).send({
            from: adminAddress,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });

        logger.info(`Contract deployed at: ${contract.address.toString()}`);
    }, 600000)

    it("Verifies contract was deployed", async () => {
        expect(contract).toBeDefined();
        expect(contract.address).toBeDefined();
        logger.info('Contract deployment verified');
    }, 60000)

    it("Creates a game", async () => {
        logger.info('Starting create game test');
        const gameId = new Fr(TEST_GAME_IDS.CREATE);

        const tx = await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
        logger.info('Game created successfully');
    }, 600000)

    it("Allows a second player to join", async () => {
        logger.info('Starting join game test');
        const gameId = new Fr(TEST_GAME_IDS.JOIN);

        // Create game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Join game
        const tx = await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
        logger.info('Player 2 joined successfully');
    }, 600000)

    it("Allows players to place treasures", async () => {
        logger.info('Starting place treasures test');
        const gameId = new Fr(TEST_GAME_IDS.PLACE_TREASURES);

        // Create and join game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Player 1 places treasures
        const tx1 = await contract.methods.place_treasures(
            gameId,
            TREASURES.player1.x1, TREASURES.player1.y1,
            TREASURES.player1.x2, TREASURES.player1.y2,
            TREASURES.player1.x3, TREASURES.player1.y3
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx1.status).toBe(TxStatus.SUCCESS);
        logger.info('Player 1 placed treasures');

        // Player 2 places treasures
        const tx2 = await contract.methods.place_treasures(
            gameId,
            TREASURES.player2.x1, TREASURES.player2.y1,
            TREASURES.player2.x2, TREASURES.player2.y2,
            TREASURES.player2.x3, TREASURES.player2.y3
        ).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx2.status).toBe(TxStatus.SUCCESS);
        logger.info('Player 2 placed treasures');
    }, 600000)

    it("Completes full game setup", async () => {
        logger.info('Starting full setup test');
        const gameId = new Fr(TEST_GAME_IDS.FULL_SETUP);

        // Create game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Join game
        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Both players place treasures
        await contract.methods.place_treasures(
            gameId,
            TREASURES.player1.x1, TREASURES.player1.y1,
            TREASURES.player1.x2, TREASURES.player1.y2,
            TREASURES.player1.x3, TREASURES.player1.y3
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId,
            TREASURES.player2.x1, TREASURES.player2.y1,
            TREASURES.player2.x2, TREASURES.player2.y2,
            TREASURES.player2.x3, TREASURES.player2.y3
        ).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        logger.info('Full game setup completed - game is ready to play!');
    }, 600000)

    it("Player can dig at a location", async () => {
        logger.info('Starting dig test');
        const gameId = new Fr(TEST_GAME_IDS.DIG);

        // Setup game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId, 0, 0, 7, 7, 0, 7
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId, 3, 3, 4, 4, 5, 5
        ).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Player 1's turn - dig at (2, 2)
        const tx = await contract.methods.dig(gameId, 2, 2).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
        logger.info('Dig action completed');
    }, 600000)

    it("Player can use shovel to relocate treasure", async () => {
        logger.info('Starting shovel (relocate) test');
        const gameId = new Fr(TEST_GAME_IDS.SHOVEL);

        // Setup game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Player 1 places treasures at (0,0), (7,7), (0,7)
        await contract.methods.place_treasures(
            gameId, 0, 0, 7, 7, 0, 7
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId, 3, 3, 4, 4, 5, 5
        ).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Player 1 uses shovel to move treasure from (0,0) to (1,1)
        // This is the KEY feature - private state that CHANGES
        const tx = await contract.methods.use_shovel(
            gameId,
            0, 0,  // Old position
            1, 1   // New position
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
        logger.info('Shovel used - treasure relocated privately!');
    }, 600000)

    it("Player can place a trap", async () => {
        logger.info('Starting trap placement test');
        const gameId = new Fr(TEST_GAME_IDS.TRAP);

        // Setup game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId, 0, 0, 7, 7, 0, 7
        ).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        await contract.methods.place_treasures(
            gameId, 3, 3, 4, 4, 5, 5
        ).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        // Player 1 places a trap at (2, 2)
        const tx = await contract.methods.use_trap(gameId, 2, 2).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });

        expect(tx.status).toBe(TxStatus.SUCCESS);
        logger.info('Trap placed privately!');
    }, 600000)
});
