export interface NetworkConfig {
  nodeUrl: string;
  contractAddress: string;
  deployerAddress: string;
  deploymentSalt: string;
  proverEnabled: boolean;
}

export function getNetworkConfig(): NetworkConfig {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const deployerAddress = import.meta.env.VITE_DEPLOYER_ADDRESS;
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
    deploymentSalt,
    proverEnabled,
  };
}
