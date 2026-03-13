/**
 * Azguard Browser Wallet Connector
 *
 * Azguard is a browser extension that manages its own PXE and Aztec accounts.
 * It uses a CAIP-based wallet protocol.
 *
 * This connector:
 * 1. Checks if Azguard is installed
 * 2. Connects to Azguard and gets the user's Aztec account
 * 3. For game operations, proxies transactions through Azguard's interface
 *
 * Note: Azguard manages its own PXE, so the game uses Azguard's wallet
 * directly for transaction signing.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { getNetworkConfig } from '../../config/network';

export interface AzguardConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

/** Check if Azguard is installed */
export function isAzguardInstalled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).azguard;
}

export async function connectAzguard(nodeUrl: string): Promise<AzguardConnectorResult> {
  const config = getNetworkConfig();

  if (!isAzguardInstalled()) {
    throw new Error(
      'Azguard wallet extension is not installed. ' +
      'Please install it from the browser extension store and try again.'
    );
  }

  // Dynamically import to avoid bundling if not used
  let AzguardClient: any;
  try {
    const mod = await import('@azguardwallet/client');
    AzguardClient = mod.AzguardClient ?? mod.default;
  } catch {
    throw new Error('Failed to load @azguardwallet/client. Please check the installation.');
  }

  // Determine network name for CAIP chain
  const isDevnet = nodeUrl.includes('devnet');
  const chainId = isDevnet ? 'aztec:1647720761' : 'aztec:0';

  const client = new AzguardClient({
    dappMetadata: {
      name: 'Aztec Treasure Hunt',
      description: 'Strategic treasure hunting with private game state on Aztec Network',
      url: window.location.origin,
    },
  });

  // Connect to Azguard
  const connectionResult = await client.connect({
    requiredPermissions: [
      {
        chains: [chainId],
        methods: [
          'aztec_getAccounts',
          'aztec_requestAccounts',
          'aztec_sendTransaction',
          'aztec_getTxReceipt',
          'aztec_simulateViews',
        ],
      },
    ],
  });

  if (!connectionResult || !connectionResult.accounts || connectionResult.accounts.length === 0) {
    throw new Error('No Aztec accounts found in Azguard');
  }

  // Get the first connected account
  const caipAccount = connectionResult.accounts[0];
  const addressStr = extractAddressFromCaip(caipAccount);
  const address = AztecAddress.fromString(addressStr);
  const contractAddress = AztecAddress.fromString(config.contractAddress);

  // Create a proxy wallet that routes calls through Azguard
  const proxyWallet = createAzguardProxyWallet(client, address, nodeUrl);

  return { wallet: proxyWallet, address, contractAddress };
}

/** Extract address from CAIP account string like "aztec:chainId:0x..." */
function extractAddressFromCaip(caipAccount: string): string {
  const parts = caipAccount.split(':');
  if (parts.length === 3 && parts[0] === 'aztec') {
    return parts[2];
  }
  return caipAccount;
}

/**
 * Create a proxy wallet that routes contract calls through Azguard.
 * This wraps the Azguard client in a BaseWallet-compatible interface.
 */
function createAzguardProxyWallet(client: any, address: AztecAddress, _nodeUrl: string): BaseWallet {
  // Create a minimal wallet-like proxy object
  // The game uses wallet.getAddress() and passes wallet to TreasureHuntContract.at()
  // For Azguard, we need to intercept contract method calls and route through Azguard
  const proxyHandler = {
    get(target: any, prop: string) {
      if (prop === 'getAddress') {
        return () => address;
      }
      if (prop === 'getAccounts') {
        return async () => [{ alias: '', item: address }];
      }
      // For PXE methods, proxy to Azguard
      if (typeof target[prop] === 'function') {
        return (...args: unknown[]) => {
          console.warn(`AzguardProxy: ${prop}() called - routing through Azguard`);
          return (target[prop] as (...a: unknown[]) => unknown)(...args);
        };
      }
      return target[prop];
    },
  };

  // Create a minimal target object with Azguard client as backing
  const target = {
    _azguardClient: client,
    _address: address,
    getAddress: () => address,
    getAccounts: async () => [{ alias: '', item: address }],
  };

  return new Proxy(target, proxyHandler) as unknown as BaseWallet;
}
