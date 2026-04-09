# Treasure Hunt Frontend

React/Vite client for the Treasure Hunt game. Contract compilation and deployment happen in [`/contracts`](../contracts); this app consumes the generated artifacts and the `client/.env*` files written by the deploy script.

## Install

```sh
npm install
```

## Deploy contracts first

Run these commands from [`/contracts`](../contracts):

```sh
npm run compile
npm run codegen

# Local / devnet
npm run deploy
npm run deploy::devnet

# Testnet / Mainnet — requires an L1 account with ETH for gas
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::mainnet
```

Local and devnet use SponsoredFPC. Testnet and mainnet now deploy and fund a project-sponsored FPC as well, so embedded wallets can transact without asking end users to bridge their own Fee Juice.

## Wallet support

| Network | Embedded Wallet | Azguard | Notes |
|---------|-----------------|---------|-------|
| Local | Yes | Yes | Uses local SponsoredFPC |
| Devnet | Yes | Yes | Uses devnet SponsoredFPC |
| Testnet | Yes | Yes | Uses project-sponsored FPC written by deploy script |
| Mainnet | Planned | Planned | Same env shape as testnet |

## Environment files

The deploy script writes one frontend env file per network:

| Network | Generated file | How to use it |
|---------|----------------|---------------|
| Local | `.env.local` | Picked up automatically by `npm run dev` |
| Devnet | `.env.devnet` | Copy to `.env.local` before `npm run dev` |
| Testnet | `.env.testnet` | Copy to `.env.local` before `npm run dev` |
| Mainnet | `.env.mainnet` | Copy to `.env.local` before `npm run dev` |

Examples:

```sh
# Local
npm run dev

# Devnet / testnet / mainnet
cp .env.devnet .env.local      # or .env.testnet / .env.mainnet
npm run dev
```

Important:

- Vite gives `.env.local` priority over `.env` during `npm run dev`.
- If you switch from local/devnet to testnet/mainnet, replace `.env.local` or remove the old one first.
- The generated env files include the contract deployment metadata used by the client and Azguard: contract address, deployer, admin, deployment salt, node URL, and when available the SponsoredFPC address and salt.

The dev server runs on [http://localhost:3001](http://localhost:3001).

## Notes

- `contracts/scripts/deploy_contract.ts` currently copies contract artifacts into `client/src/artifacts` only on local deploy. Remote deploys update the env file but skip artifact copying.
- `npm run build` creates the production bundle.
- `npm run typecheck` runs the TypeScript build check.
- `npm run lint` runs the Prettier check used by this frontend.
- The app is desktop-first; mobile and tablet currently show a not-supported screen.
