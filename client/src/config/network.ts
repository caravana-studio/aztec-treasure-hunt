export interface NetworkConfig {
  nodeUrl: string;
  contractAddress: string;
  deployerAddress: string;
  adminAddress?: string;
  deploymentSalt: string;
  proverEnabled: boolean;
}

export function usesSponsoredFeePayment(nodeUrl: string): boolean {
  return (
    nodeUrl.includes('localhost') ||
    nodeUrl.includes('127.0.0.1') ||
    nodeUrl.includes('devnet')
  );
}

export function supportsEmbeddedWallet(nodeUrl: string): boolean {
  return !!nodeUrl;
}

export function getDefaultL1RpcUrl(l1ChainId: number): string | null {
  if (l1ChainId === 11155111) {
    return 'https://ethereum-sepolia-rpc.publicnode.com';
  }

  if (l1ChainId === 1) {
    return 'https://ethereum.publicnode.com';
  }

  if (l1ChainId === 31337) {
    return 'http://127.0.0.1:8545';
  }

  return null;
}

export function getNetworkConfig(): NetworkConfig {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const deployerAddress = import.meta.env.VITE_DEPLOYER_ADDRESS;
  const adminAddress = import.meta.env.VITE_ADMIN_ADDRESS;
  const deploymentSalt = import.meta.env.VITE_DEPLOYMENT_SALT;
  const nodeUrl = import.meta.env.VITE_AZTEC_NODE_URL || 'http://localhost:8080';
  const proverEnabled = import.meta.env.VITE_PROVER_ENABLED === 'true';

  if (!contractAddress) {
    throw new Error('Missing VITE_CONTRACT_ADDRESS. Run yarn deploy-contracts first.');
  }

  if (!deployerAddress) {
    throw new Error('Missing VITE_DEPLOYER_ADDRESS. Run yarn deploy-contracts first.');
  }

  if (!deploymentSalt) {
    throw new Error('Missing VITE_DEPLOYMENT_SALT. Run yarn deploy-contracts first.');
  }

  return {
    nodeUrl,
    contractAddress,
    deployerAddress,
    adminAddress,
    deploymentSalt,
    proverEnabled,
  };
}
