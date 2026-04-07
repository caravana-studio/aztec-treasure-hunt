/**
 * Azguard Browser Wallet Connector — Wallet SDK Protocol
 *
 * Uses @aztec/wallet-sdk WalletManager for discovery, secure channel (ECDH),
 * and emoji-based verification. Replaces the old CAIP-based @azguardwallet/client.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { WalletManager } from '@aztec/wallet-sdk/manager';
import type {
  DiscoverySession,
  WalletProvider,
  PendingConnection,
} from '@aztec/wallet-sdk/manager';
import { hashToEmoji } from '@aztec/wallet-sdk/crypto';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig, usesSponsoredFeePayment } from '../../config/network';

export type { DiscoverySession, WalletProvider, PendingConnection };

const APP_ID = 'treasure-hunt';
const DISCOVERY_TIMEOUT_MS = 30_000;

export interface AzguardConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

type WalletCapabilitiesResponse = {
  granted?: Array<Record<string, unknown>>;
  wallet?: {
    name?: string;
    version?: string;
  };
};

const AZGUARD_UTILITY_FUNCTIONS = [
  'get_next_game_id',
  'get_game',
  'get_my_powers',
  'get_all_dig_results',
];

const AZGUARD_TRANSACTION_FUNCTIONS = [
  'create_game',
  'join_game',
  'place_treasures',
  'dig',
  'check_dig_result',
  'respond_detector',
  'respond_compass',
  'use_detector',
  'use_compass',
  'use_shovel',
  'use_trap',
];

async function getSponsoredFpcInstance() {
  return getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: new Fr(0) }
  );
}

function getRequiredCapabilities(
  contractAddress: AztecAddress,
  sponsoredFpcAddress?: AztecAddress
) {
  const utilityScope = AZGUARD_UTILITY_FUNCTIONS.map((fn) => ({
    contract: contractAddress,
    function: fn,
  }));
  const gameTransactionScope = AZGUARD_TRANSACTION_FUNCTIONS.map((fn) => ({
    contract: contractAddress,
    function: fn,
  }));
  const sponsoredTransactionScope = sponsoredFpcAddress
    ? [{ contract: sponsoredFpcAddress, function: 'sponsor_unconditionally' }]
    : [];
  const transactionScope = [
    ...sponsoredTransactionScope,
    ...gameTransactionScope,
  ];
  const contracts = sponsoredFpcAddress
    ? [contractAddress, sponsoredFpcAddress]
    : [contractAddress];

  return [
    {
      type: 'accounts' as const,
      canGet: true,
    },
    {
      type: 'contracts' as const,
      contracts,
      canRegister: true,
    },
    {
      type: 'simulation' as const,
      transactions: { scope: transactionScope },
      utilities: { scope: utilityScope },
    },
    {
      type: 'transaction' as const,
      scope: transactionScope,
    },
  ];
}

function hasGrantedCapability(
  granted: Array<Record<string, unknown>> | undefined,
  type: string,
  predicate?: (capability: Record<string, unknown>) => boolean
): boolean {
  return (
    granted?.some((capability) => {
      if (capability.type !== type) {
        return false;
      }

      return predicate ? predicate(capability) : true;
    }) ?? false
  );
}

function getGrantedAddress(granted: Array<Record<string, unknown>> | undefined): AztecAddress {
  const accountsCapability = granted?.find((capability) => capability.type === 'accounts');
  const accounts = Array.isArray(accountsCapability?.accounts) ? accountsCapability.accounts : [];

  if (accounts.length === 0) {
    throw new Error('Azguard did not grant access to any accounts.');
  }

  const firstAccount = accounts[0] as { item?: AztecAddress; address?: AztecAddress } | AztecAddress;

  if (firstAccount instanceof AztecAddress) {
    return firstAccount;
  }

  const address = firstAccount.item ?? firstAccount.address;
  if (!address) {
    throw new Error('Azguard returned an invalid account entry.');
  }

  return address;
}

async function getRegisteredGameInstance(contractAddress: AztecAddress) {
  const config = getNetworkConfig();
  const node = createAztecNodeClient(config.nodeUrl);

  const publishedInstance = await node.getContract(contractAddress);
  if (publishedInstance) {
    return publishedInstance;
  }

  const deterministicInstance = await getContractInstanceFromInstantiationParams(
    TreasureHuntContract.artifact,
    {
      deployer: AztecAddress.fromString(config.deployerAddress),
      salt: Fr.fromString(config.deploymentSalt),
      constructorArgs: [
        AztecAddress.fromString(config.adminAddress ?? config.deployerAddress),
      ],
    }
  );

  if (deterministicInstance.address.toString() !== contractAddress.toString()) {
    console.warn(
      `TreasureHunt instance mismatch for ${contractAddress.toString()}. Falling back to configured address using deterministic instance metadata from env.`
    );
    return {
      ...deterministicInstance,
      address: contractAddress,
    };
  }

  return deterministicInstance;
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
  const sponsoredFpcInstance = usesSponsoredFeePayment(config.nodeUrl)
    ? await getSponsoredFpcInstance()
    : null;
  const node = createAztecNodeClient(config.nodeUrl);
  const expectedNodeInfo = await node.getNodeInfo();
  const expectedChainId = new Fr(expectedNodeInfo.l1ChainId);
  const expectedVersion = new Fr(expectedNodeInfo.rollupVersion);

  const wallet = (await pending.confirm()) as unknown as BaseWallet;

  const walletChainInfo = await wallet.getChainInfo();
  if (
    walletChainInfo.chainId.toString() !== expectedChainId.toString() ||
    walletChainInfo.version.toString() !== expectedVersion.toString()
  ) {
    throw new Error(
      `Azguard is connected to a different Aztec chain. Expected chainId=${expectedChainId.toString()} version=${expectedVersion.toString()}, got chainId=${walletChainInfo.chainId.toString()} version=${walletChainInfo.version.toString()}. Reload the app on the correct network and reconnect the wallet.`
    );
  }

  const requestCapabilities = (wallet as BaseWallet & {
    requestCapabilities?: (manifest: Record<string, unknown>) => Promise<WalletCapabilitiesResponse>;
  }).requestCapabilities;

  if (typeof requestCapabilities !== 'function') {
    throw new Error(
      'This Azguard version does not support capability authorization. Update the wallet extension and reconnect.'
    );
  }

  let capabilities: WalletCapabilitiesResponse;
  try {
    capabilities = await requestCapabilities.call(wallet, {
      version: '1.0' as const,
      metadata: {
        name: 'Aztec Treasure Hunt',
        version: '1.0.0',
        description:
          'Strategic treasure hunting with private state on Aztec Network',
        url: typeof window !== 'undefined' ? window.location.origin : '',
      },
      capabilities: getRequiredCapabilities(
        contractAddress,
        sponsoredFpcInstance?.address
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Azguard rejected the required permissions: ${message}`);
  }

  const granted = capabilities.granted;
  const missingCapabilities = [
    !hasGrantedCapability(granted, 'accounts', (capability) => capability.canGet === true) && 'accounts',
    !hasGrantedCapability(granted, 'contracts', (capability) => capability.canRegister === true) && 'contracts',
    !hasGrantedCapability(
      granted,
      'simulation',
      (capability) => Boolean(capability.utilities)
    ) && 'simulation',
    !hasGrantedCapability(granted, 'transaction', (capability) => Boolean(capability.scope)) && 'transaction',
  ].filter(Boolean);

  if (missingCapabilities.length > 0) {
    const walletName = capabilities.wallet?.name ?? 'Azguard';
    throw new Error(
      `${walletName} did not grant the required permissions (${missingCapabilities.join(', ')}). Disconnect, reconnect, and approve the full permission request.`
    );
  }

  const gameInstance = await getRegisteredGameInstance(contractAddress);
  try {
    if (sponsoredFpcInstance) {
      await wallet.registerContract(
        sponsoredFpcInstance,
        SponsoredFPCContract.artifact
      );
    }
    await wallet.registerContract(gameInstance, TreasureHuntContract.artifact);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Azguard could not register TreasureHunt in its PXE: ${message}`);
  }

  const address = getGrantedAddress(granted);
  return { wallet, address, contractAddress };
}
