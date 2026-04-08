import { Fr } from '@aztec/aztec.js/fields';
import {
  getContractInstanceFromInstantiationParams,
  type ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { LogFn } from '@aztec/foundation/log';
import { SponsoredFPCContract, SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getAztecNodeUrl } from '../../config/config.js';

export const CANONICAL_SPONSORED_FPC_SALT = new Fr(0);
export const REMOTE_SPONSORED_FPC_SALT = new Fr(SPONSORED_FPC_SALT);

export async function getSponsoredFPCInstance(
  salt: Fr = CANONICAL_SPONSORED_FPC_SALT
): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
    salt,
  });
}

export async function getSponsoredFPCAddress(salt: Fr = CANONICAL_SPONSORED_FPC_SALT) {
  return (await getSponsoredFPCInstance(salt)).address;
}

export async function setupSponsoredFPC(
  deployer: Wallet,
  log: LogFn,
  salt: Fr = CANONICAL_SPONSORED_FPC_SALT,
  fromAddress?: AztecAddress
) {
  const instance = await getSponsoredFPCInstance(salt);
  const node = createAztecNodeClient(getAztecNodeUrl());
  const existing = await node.getContract(instance.address);

  if (existing) {
    log(`SponsoredFPC already deployed: ${instance.address}`);
    return instance;
  }

  const from = fromAddress ?? (await deployer.getAccounts())[0]?.item;
  if (!from) {
    throw new Error('No deployed account available to deploy SponsoredFPC.');
  }

  const deployed = await SponsoredFPCContract.deploy(deployer)
    .send({
      from,
      contractAddressSalt: salt,
      universalDeploy: true,
    });

  void deployed;
  log(`SponsoredFPC deployed: ${instance.address}`);
  return instance;
}
