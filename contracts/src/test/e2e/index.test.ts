// End-to-end tests for the Treasure Hunt game contract
// Tests the game lifecycle on a real Aztec network with state verification

import { TreasureHuntContract } from "../../artifacts/TreasureHunt.js"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee'
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { TxStatus } from "@aztec/stdlib/tx";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";

// Game status constants (must match contract)
const STATUS_CREATED = 0;
const STATUS_SETUP = 1;
const STATUS_PLAYING = 2;
const STATUS_AWAITING = 3;
const STATUS_FINISHED = 4;

// Action constants
const ACTION_NONE = 0;
const ACTION_DIG = 1;
const ACTION_DETECTOR = 2;
const ACTION_COMPASS = 3;

// Test constants
const TEST_GAME_IDS = {
    CREATE: 100,
    JOIN: 101,
    PLACE_TREASURES: 102,
    FULL_SETUP: 103,
    DIG: 104,
    DETECTOR: 105,
    SHOVEL: 106,
    TRAP: 107,
    ADMIN_CHECK: 108,
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
    let wallet: EmbeddedWallet;
    let player1Account: AccountManager;
    let player2Account: AccountManager;
    let contract: TreasureHuntContract;

    beforeAll(async () => {
        logger = createLogger('aztec:treasure-hunt:tests');
        logger.info(`Treasure Hunt tests running.`)
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Create two player accounts
        logger.info('Creating player accounts...');
        let secretKey1 = Fr.random();
        let signingKey1 = GrumpkinScalar.random();
        let salt1 = Fr.random();
        player1Account = await AccountManager.create(wallet, secretKey1, new SchnorrAccountContract(signingKey1), salt1);
        await (await player1Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

        let secretKey2 = Fr.random();
        let signingKey2 = GrumpkinScalar.random();
        let salt2 = Fr.random();
        player2Account = await AccountManager.create(wallet, secretKey2, new SchnorrAccountContract(signingKey2), salt2);
        await (await player2Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });

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

    describe("Contract Deployment", () => {
        it("should have valid contract address", async () => {
            expect(contract).toBeDefined();
            expect(contract.address).toBeDefined();
            expect(contract.address.toString()).not.toBe(AztecAddress.ZERO.toString());
            logger.info('Contract deployment verified');
        }, 60000)

        it("should have correct admin address", async () => {
            const admin = await contract.methods.get_admin().simulate({ from: player1Account.address });
            expect(admin.toString()).toBe(player1Account.address.toString());
            logger.info(`Admin verified: ${admin.toString()}`);
        }, 60000)
    })

    describe("Game Creation", () => {
        it("should create a new game with correct initial state", async () => {
            logger.info('Starting create game test');
            const gameId = new Fr(TEST_GAME_IDS.CREATE);

            // Create game
            const tx = await contract.methods.create_game(gameId).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // Verify game state using utility functions
            const player1 = await contract.methods.get_player1(gameId).simulate({ from: player1Account.address });
            const player2 = await contract.methods.get_player2(gameId).simulate({ from: player1Account.address });
            const status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });

            expect(player1.toString()).toBe(player1Account.address.toString());
            expect(player2.toString()).toBe(AztecAddress.ZERO.toString());
            expect(Number(status)).toBe(STATUS_CREATED);

            logger.info('Game created with verified state');
        }, 600000)

        it("should allow second player to join and update state", async () => {
            logger.info('Starting join game test');
            const gameId = new Fr(TEST_GAME_IDS.JOIN);

            // Create game
            await contract.methods.create_game(gameId).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            // Verify initial state
            let status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            expect(Number(status)).toBe(STATUS_CREATED);

            // Join game
            const tx = await contract.methods.join_game(gameId).send({
                from: player2Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // Verify updated state
            const player1 = await contract.methods.get_player1(gameId).simulate({ from: player1Account.address });
            const player2 = await contract.methods.get_player2(gameId).simulate({ from: player1Account.address });
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });

            expect(player1.toString()).toBe(player1Account.address.toString());
            expect(player2.toString()).toBe(player2Account.address.toString());
            expect(Number(status)).toBe(STATUS_SETUP);

            logger.info('Player 2 joined - state verified');
        }, 600000)
    })

    describe("Treasure Placement", () => {
        it("should allow players to place treasures and transition to playing state", async () => {
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

            // Verify we're in setup state
            let status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            expect(Number(status)).toBe(STATUS_SETUP);

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

            // Verify still in setup (waiting for player 2)
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            let isReady = await contract.methods.is_game_ready(gameId).simulate({ from: player1Account.address });
            expect(Number(status)).toBe(STATUS_SETUP);
            expect(isReady).toBe(false);

            logger.info('Player 1 placed treasures - verified game not ready yet');

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

            // Verify game is now ready and in playing state
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            isReady = await contract.methods.is_game_ready(gameId).simulate({ from: player1Account.address });
            const currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(isReady).toBe(true);
            expect(currentTurn.toString()).toBe(player1Account.address.toString()); // Player 1 goes first

            logger.info('Both players placed treasures - game is ready!');
        }, 600000)
    })

    describe("Game Actions", () => {
        let fullSetupGameId: Fr;

        // Helper to setup a game ready for play
        async function setupGameForPlay(gameId: Fr) {
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
        }

        it("should allow player to dig and verify game state changes", async () => {
            logger.info('Starting dig test');
            const gameId = new Fr(TEST_GAME_IDS.DIG);

            await setupGameForPlay(gameId);

            // Verify initial playing state
            let status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            let currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(currentTurn.toString()).toBe(player1Account.address.toString());

            // Initial treasures found should be 0
            let p1Found = await contract.methods.get_player1_treasures_found(gameId).simulate({ from: player1Account.address });
            let p2Found = await contract.methods.get_player2_treasures_found(gameId).simulate({ from: player1Account.address });
            expect(Number(p1Found)).toBe(0);
            expect(Number(p2Found)).toBe(0);

            // Player 1's turn - dig at (2, 2) - should miss (no treasure there)
            const tx = await contract.methods.dig(gameId, 2, 2).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // Verify pending action was set
            const [pendingAction, pendingX, pendingY] = await contract.methods.get_pending_action(gameId).simulate({ from: player1Account.address });
            expect(Number(pendingAction)).toBe(ACTION_DIG);
            expect(Number(pendingX)).toBe(2);
            expect(Number(pendingY)).toBe(2);

            // Verify status changed to awaiting
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            expect(Number(status)).toBe(STATUS_AWAITING);

            logger.info('Dig action verified - game awaiting opponent response');
        }, 600000)

        it("should allow player to use shovel and relocate treasure", async () => {
            logger.info('Starting shovel (relocate) test');
            const gameId = new Fr(TEST_GAME_IDS.SHOVEL);

            await setupGameForPlay(gameId);

            // Verify game is playing and it's player 1's turn
            let status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            let currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(currentTurn.toString()).toBe(player1Account.address.toString());

            // Player 1 uses shovel to move treasure from (0,0) to (1,1)
            // This demonstrates Aztec's key feature - private state that CHANGES
            const tx = await contract.methods.use_shovel(
                gameId,
                0, 0,  // Old position
                1, 1   // New position
            ).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // After using shovel, turn should switch to player 2
            currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(currentTurn.toString()).toBe(player2Account.address.toString());

            logger.info('Shovel used - treasure relocated privately, turn switched!');
        }, 600000)

        it("should allow player to place a trap", async () => {
            logger.info('Starting trap placement test');
            const gameId = new Fr(TEST_GAME_IDS.TRAP);

            await setupGameForPlay(gameId);

            // Verify initial state
            let status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });
            let currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(currentTurn.toString()).toBe(player1Account.address.toString());

            // Player 1 places a trap at (2, 2)
            const tx = await contract.methods.use_trap(gameId, 2, 2).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // After placing trap, turn should switch to player 2
            currentTurn = await contract.methods.get_current_turn(gameId).simulate({ from: player1Account.address });
            status = await contract.methods.get_game_status(gameId).simulate({ from: player1Account.address });

            expect(Number(status)).toBe(STATUS_PLAYING);
            expect(currentTurn.toString()).toBe(player2Account.address.toString());

            logger.info('Trap placed privately, turn switched!');
        }, 600000)
    })

    describe("Full Game State Verification", () => {
        it("should correctly report game state through get_game utility", async () => {
            logger.info('Testing full game state retrieval');
            const gameId = new Fr(TEST_GAME_IDS.FULL_SETUP);

            // Create and setup game
            await contract.methods.create_game(gameId).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

            await contract.methods.join_game(gameId).send({
                from: player2Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout });

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

            // Get full game state
            const game = await contract.methods.get_game(gameId).simulate({ from: player1Account.address });

            // Verify all fields
            expect(game.player1.toString()).toBe(player1Account.address.toString());
            expect(game.player2.toString()).toBe(player2Account.address.toString());
            expect(game.player1_setup_done).toBe(true);
            expect(game.player2_setup_done).toBe(true);
            expect(Number(game.player1_found)).toBe(0);
            expect(Number(game.player2_found)).toBe(0);
            expect(game.current_turn.toString()).toBe(player1Account.address.toString());
            expect(Number(game.pending_action)).toBe(ACTION_NONE);
            expect(Number(game.status)).toBe(STATUS_PLAYING);
            expect(game.winner.toString()).toBe(AztecAddress.ZERO.toString());

            logger.info('Full game state verified through get_game utility');
            logger.info(`Game state: status=${game.status}, current_turn=${game.current_turn.toString().slice(0, 10)}...`);
        }, 600000)

        it("should verify admin check functionality", async () => {
            logger.info('Testing admin verification');
            const gameId = new Fr(TEST_GAME_IDS.ADMIN_CHECK);

            // Get admin address
            const admin = await contract.methods.get_admin().simulate({ from: player1Account.address });

            // Admin should be player1 (who deployed the contract)
            expect(admin.toString()).toBe(player1Account.address.toString());

            // Verify non-admin is different
            expect(admin.toString()).not.toBe(player2Account.address.toString());

            logger.info(`Admin check passed: ${admin.toString()}`);
        }, 60000)
    })

    describe("Game Winner Verification", () => {
        it("should have winner as zero address before game ends", async () => {
            const gameId = new Fr(TEST_GAME_IDS.FULL_SETUP); // Reuse existing game

            const winner = await contract.methods.get_winner(gameId).simulate({ from: player1Account.address });
            expect(winner.toString()).toBe(AztecAddress.ZERO.toString());

            logger.info('Winner correctly shows zero address for ongoing game');
        }, 60000)
    })
});
