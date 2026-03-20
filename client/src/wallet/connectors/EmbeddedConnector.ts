/**
 * Embedded Wallet Connector
 *
 * Manages a local PXE instance and a locally-stored account (ECDSA keys in
 * localStorage). The app owns both the PXE and the signing keys.
 */
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { EmbeddedWallet } from '../../embedded-wallet';
import { PXEService } from '../../services/aztec/PXEService';
import { FeeService } from '../../services/aztec/FeeService';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig } from '../../config/network';

export interface EmbeddedConnectorResult {
  wallet: BaseWallet;
  address: AztecAddress;
  contractAddress: AztecAddress;
}

async function initWallet(nodeUrl: string): Promise<EmbeddedWallet> {
  const config = getNetworkConfig();
  const isRemoteNetwork = !nodeUrl.includes('localhost') && !nodeUrl.includes('127.0.0.1');
  const proverEnabled = config.proverEnabled || isRemoteNetwork;
  const { pxe, aztecNode } = await PXEService.getInstance(nodeUrl, proverEnabled);
  await FeeService.registerWithPXE(pxe);
  const wallet = new EmbeddedWallet(pxe, aztecNode);

  const instance = await getContractInstanceFromInstantiationParams(
    TreasureHuntContract.artifact,
    {
      deployer: AztecAddress.fromString(config.deployerAddress),
      salt: Fr.fromString(config.deploymentSalt),
      constructorArgs: [AztecAddress.fromString(config.deployerAddress)],
    }
  );
  await wallet.registerContract(instance, TreasureHuntContract.artifact);

  return wallet;
}

/** Try to reconnect a previously saved embedded account */
export async function reconnectEmbedded(nodeUrl: string): Promise<EmbeddedConnectorResult | null> {
  const config = getNetworkConfig();
  const wallet = await initWallet(nodeUrl);
  const address = await wallet.connectExistingAccount();
  if (!address) return null;
  return {
    wallet,
    address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}

/** Create a new embedded account and connect */
export async function createEmbeddedAccount(nodeUrl: string): Promise<EmbeddedConnectorResult> {
  const config = getNetworkConfig();
  const wallet = await initWallet(nodeUrl);
  const address = await wallet.createAccountAndConnect();
  return {
    wallet,
    address,
    contractAddress: AztecAddress.fromString(config.contractAddress),
  };
}
