/**
 * Azguard Browser Wallet Connector — Wallet SDK Protocol
 *
 * Uses @aztec/wallet-sdk WalletManager for discovery, secure channel (ECDH),
 * and emoji-based verification. Replaces the old CAIP-based @azguardwallet/client.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { WalletManager } from '@aztec/wallet-sdk/manager';
import type {
  DiscoverySession,
  WalletProvider,
  PendingConnection,
} from '@aztec/wallet-sdk/manager';
import { hashToEmoji } from '@aztec/wallet-sdk/crypto';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { getNetworkConfig } from '../../config/network';

export type { DiscoverySession, WalletProvider, PendingConnection };

const APP_ID = 'treasure-hunt';
const DISCOVERY_TIMEOUT_MS = 30_000;

export interface AzguardConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

/** Check if Azguard is installed (polls for async content script injection) */
export function isAzguardInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).azguard) {
      resolve(true);
      return;
    }
    let remaining = 500;
    const id = setInterval(() => {
      remaining -= 10;
      if ((window as any).azguard) {
        clearInterval(id);
        resolve(true);
      } else if (remaining <= 0) {
        clearInterval(id);
        resolve(false);
      }
    }, 10);
  });
}

/**
 * Start wallet discovery. Calls `onDiscovered` each time a wallet extension
 * is found. Returns a DiscoverySession with `.cancel()` and `.done`.
 */
export async function discoverWallets(
  nodeUrl: string,
  onDiscovered: (provider: WalletProvider) => void
): Promise<DiscoverySession> {
  const node = createAztecNodeClient(nodeUrl);
  const nodeInfo = await node.getNodeInfo();

  const chainInfo = {
    chainId: new Fr(nodeInfo.l1ChainId),
    version: new Fr(nodeInfo.rollupVersion),
  };

  const session = WalletManager.configure({
    extensions: { enabled: true },
  }).getAvailableWallets({
    chainInfo,
    appId: APP_ID,
    timeout: DISCOVERY_TIMEOUT_MS,
    onWalletDiscovered: onDiscovered,
  });

  return session;
}

/**
 * Establish a secure ECDH channel with the selected wallet provider.
 * Returns a PendingConnection for emoji verification.
 */
export async function establishChannel(
  provider: WalletProvider
): Promise<PendingConnection> {
  return provider.establishSecureChannel(APP_ID);
}

/**
 * Get the 9 verification emojis from a pending connection's hash.
 */
export function getVerificationEmojis(pending: PendingConnection): string[] {
  return Array.from(hashToEmoji(pending.verificationHash.toString()));
}

/**
 * Confirm the pending connection and return a wallet + address ready for gameplay.
 */
export async function confirmConnection(
  pending: PendingConnection
): Promise<AzguardConnectorResult> {
  const config = getNetworkConfig();
  const contractAddress = AztecAddress.fromString(config.contractAddress);

  const wallet = (await pending.confirm()) as unknown as BaseWallet;

  // Get the wallet's account address
  let address: AztecAddress;
  try {
    // Try requestCapabilities first for wallets that support it
    const capabilities = await (wallet as any).requestCapabilities({
      version: '1.0' as const,
      metadata: {
        name: 'Aztec Treasure Hunt',
        version: '1.0.0',
        description:
          'Strategic treasure hunting with private state on Aztec Network',
        url: typeof window !== 'undefined' ? window.location.origin : '',
      },
      capabilities: [
        { type: 'accounts', canGet: true },
        {
          type: 'contracts',
          contracts: [contractAddress],
          canRegister: true,
        },
      ],
    });
    const accountsCap = capabilities.granted?.find(
      (c: any) => c.type === 'accounts'
    );
    const accounts = accountsCap?.accounts ?? [];
    if (accounts.length > 0) {
      address = accounts[0].item ?? accounts[0].address ?? accounts[0];
    } else {
      throw new Error('No accounts from capabilities');
    }
  } catch {
    // Fallback: getAccounts()
    const raw = await wallet.getAccounts();
    if (!raw || raw.length === 0) {
      throw new Error('Wallet returned no accounts');
    }
    const first = raw[0] as any;
    address = first.item ?? first.address ?? first;
  }

  return { wallet, address, contractAddress };
}
