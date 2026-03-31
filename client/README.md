# Treasure Hunt Frontend

React/Vite client for the Treasure Hunt game. Contract compilation and deployment happen in [`/contracts`](../contracts); this app consumes the generated artifacts and the `client/.env*` files written by the deploy script.

## Install

```sh
yarn install
```

## Deploy contracts first

Run these commands from [`/contracts`](../contracts):

```sh
yarn compile
yarn codegen

# Local / devnet
yarn deploy
yarn deploy::devnet

# Testnet / Mainnet — requires an L1 account with ETH for gas
L1_PRIVATE_KEY=0x<your-ethereum-private-key> yarn deploy::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> yarn deploy::mainnet
```

Local and devnet use SponsoredFPC. Testnet and mainnet create the `AccountManager` first, bridge Fee Juice from L1 to its deterministic L2 address, deploy the account with that claim, and then deploy the contract.

## Environment files

The deploy script writes one frontend env file per network:

| Network | Generated file | How to use it |
|---------|----------------|---------------|
| Local | `.env.local` | Picked up automatically by `yarn dev` |
| Devnet | `.env.devnet` | Copy to `.env` before `yarn dev` |
| Testnet | `.env.testnet` | Copy to `.env` before `yarn dev` |
| Mainnet | `.env.mainnet` | Copy to `.env` before `yarn dev` |

Examples:

```sh
# Local
yarn dev

# Devnet / testnet / mainnet
cp .env.devnet .env      # or .env.testnet / .env.mainnet
yarn dev
```

The dev server runs on [http://localhost:3001](http://localhost:3001).

## Notes

- `contracts/scripts/deploy_contract.ts` currently copies contract artifacts into `client/src/artifacts` only on local deploy. Remote deploys update the env file but skip artifact copying.
- `yarn build` creates the production bundle.
- `yarn lint` runs the Prettier check used by this frontend.
