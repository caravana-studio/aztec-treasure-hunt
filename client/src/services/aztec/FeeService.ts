import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr } from '@aztec/foundation/curves/bn254';
import type { PXE } from '@aztec/pxe/client/lazy';

export interface SponsoredFPCContract {
  instance: Awaited<ReturnType<typeof getContractInstanceFromInstantiationParams>>;
  artifact: any;
}

/**
 * Service for managing fee payment methods.
 */
export class FeeService {
  private static sponsoredFPCContract: SponsoredFPCContract | null = null;

  /**
   * Get the Sponsored FPC contract for fee payment.
   * Caches the result for subsequent calls.
   */
  static async getSponsoredFPCContract(): Promise<SponsoredFPCContract> {
    if (this.sponsoredFPCContract) {
      return this.sponsoredFPCContract;
    }

    const { SponsoredFPCContractArtifact } = await import(
      '@aztec/noir-contracts.js/SponsoredFPC'
    );

    const instance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    this.sponsoredFPCContract = {
      instance,
      artifact: SponsoredFPCContractArtifact,
    };

    return this.sponsoredFPCContract;
  }

  /**
   * Create a sponsored fee payment method.
   */
  static async createSponsoredFeePaymentMethod(): Promise<SponsoredFeePaymentMethod> {
    const contract = await this.getSponsoredFPCContract();
    return new SponsoredFeePaymentMethod(contract.instance.address);
  }

  /**
   * Register the Sponsored FPC contract with a PXE instance.
   */
  static async registerWithPXE(pxe: PXE): Promise<void> {
    const contract = await this.getSponsoredFPCContract();
    await pxe.registerContract(contract);
  }

  /**
   * Reset cached contract (useful for testing or network switching).
   */
  static reset(): void {
    this.sponsoredFPCContract = null;
  }
}
