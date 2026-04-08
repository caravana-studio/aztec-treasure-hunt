import { createEthereumChain } from '@aztec/ethereum/chain';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { L1FeeJuicePortalManager } from '@aztec/aztec.js/ethereum';
import { waitForL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { Logger } from '@aztec/aztec.js/log';
import configManager, { getAztecNodeUrl, getTimeouts } from '../../config/config.js';

// Amount of Fee Juice to bridge from L1: enough for account + contract deploy
export const DEFAULT_FEE_JUICE_AMOUNT = 1_000_000_000_000_000_000_000n;
const L1_BALANCE_WAIT_INTERVAL_MS = 3_000;
const L1_BALANCE_WAIT_TIMEOUT_MS = 180_000;

async function waitForL1TokenBalanceIncrease(
    getBalance: () => Promise<bigint>,
    previousBalance: bigint,
    logger: Logger
) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < L1_BALANCE_WAIT_TIMEOUT_MS) {
        const currentBalance = await getBalance();
        if (currentBalance > previousBalance) {
            return currentBalance;
        }

        await new Promise((resolve) => setTimeout(resolve, L1_BALANCE_WAIT_INTERVAL_MS));
    }

    logger.warn(`Timed out waiting for minted L1 Fee Juice balance to increase after ${L1_BALANCE_WAIT_TIMEOUT_MS / 1000}s.`);
    return previousBalance;
}

/**
 * Bridges Fee Juice from L1 to an L2 address using the Fee Juice Portal.
 * Returns a claim object that can be used with FeeJuicePaymentMethodWithClaim
 * to pay for the first transaction from the funded account.
 *
 * Requires L1_PRIVATE_KEY env var: an Ethereum account with ETH for L1 gas.
 * Only needed for mainnet/testnet deploys (local/devnet use SponsoredFPC instead).
 */
export async function bridgeFeeJuice(
    recipientAddress: AztecAddress,
    l1PrivateKey: string,
    amount: bigint,
    logger: Logger
) {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const networkConfig = configManager.getNetworkConfig();

    const chain = createEthereumChain([networkConfig.l1RpcUrl], networkConfig.l1ChainId);
    const l1Client = createExtendedL1Client(chain.rpcUrls, l1PrivateKey, chain.chainInfo);

    const portalManager = await L1FeeJuicePortalManager.new(node, l1Client, logger);
    const tokenManager = portalManager.getTokenManager();
    const shouldMint = networkConfig.l1ChainId !== 1;

    logger.info(`🌉 Bridging ${amount} Fee Juice from L1 to ${recipientAddress}...`);
    if (shouldMint) {
        const l1Address = l1Client.account.address;
        const beforeBalance = await tokenManager.getL1TokenBalance(l1Address);
        await tokenManager.mint(l1Address, l1Address);
        const mintedBalance = await waitForL1TokenBalanceIncrease(
            () => tokenManager.getL1TokenBalance(l1Address),
            beforeBalance,
            logger
        );
        logger.info(`✅ L1 Fee Juice minted. Balance is now ${mintedBalance}`);
    }

    const claim = await portalManager.bridgeTokensPublic(recipientAddress, amount, false);
    const messageHash = Fr.fromString(claim.messageHash);
    const waitTimeoutSeconds = Math.max(Math.ceil(getTimeouts().waitTimeout / 1000), 300);

    logger.info(`✅ Fee Juice bridged. Claim amount: ${claim.claimAmount}`);
    logger.info(`💾 Save this claim info until the account deploy succeeds:`);
    logger.info(`   - Claim secret: ${claim.claimSecret.toString()}`);
    logger.info(`   - Message hash: ${claim.messageHash}`);
    logger.info(`   - Message leaf index: ${claim.messageLeafIndex}`);
    logger.info(`ℹ️  Waiting for L1→L2 message propagation (up to ${waitTimeoutSeconds}s)...`);
    await waitForL1ToL2MessageReady(node, messageHash, { timeoutSeconds: waitTimeoutSeconds });
    logger.info(`✅ L1→L2 message is ready to be consumed on L2`);

    return claim;
}
