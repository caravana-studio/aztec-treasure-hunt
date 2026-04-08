import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { getNetworkConfig } from '../../config/network';

export async function getSponsoredFpcInstance() {
  const config = getNetworkConfig();
  const salt = config.sponsoredFpcSalt
    ? Fr.fromString(config.sponsoredFpcSalt)
    : new Fr(0);

  const deterministicInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt }
  );

  if (
    config.sponsoredFpcAddress &&
    deterministicInstance.address.toString() !== config.sponsoredFpcAddress
  ) {
    console.warn(
      `Configured SponsoredFPC address ${config.sponsoredFpcAddress} does not match the deterministic instance ${deterministicInstance.address.toString()}. Falling back to the configured address.`
    );
    return {
      ...deterministicInstance,
      address: AztecAddress.fromString(config.sponsoredFpcAddress),
    };
  }

  return deterministicInstance;
}
