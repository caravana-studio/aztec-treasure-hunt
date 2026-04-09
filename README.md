<h1 align="center">Aztec Treasure Hunt</h1>

<p align="center">
  <img src="img/game.jpg" alt="Treasure Hunt gameplay" />
</p>

Treasure Hunt is a two-player strategy game built on Aztec. Each player hides treasures on an 8x8 board and races to find the opponent's first.

What makes it interesting is not the board itself, but the information model:

- some actions are public
- some actions are private
- some private actions are intentionally indistinguishable from each other

That lets the game create real uncertainty during play. Your opponent can know that something changed without knowing what changed.

## Demo

- Original demo video: [YouTube](https://www.youtube.com/watch?v=idaOl2Ocqg0)
- Live app: [aztec-treasure-hunt.vercel.app](https://aztec-treasure-hunt.vercel.app/)

## Why Aztec Matters Here

Most onchain games that want privacy end up in one of two places:

1. Everything is public.
2. They use commit-reveal.

Commit-reveal can hide a fixed initial state, but it does not handle dynamic private strategy well. As soon as players need to secretly move pieces, add hidden elements mid-match, or consume private inventory over time, the model starts leaking information or becomes impractical.

Aztec gives the game something much stronger:

- private treasure positions
- private trap positions
- private power inventory
- private state transitions during the match

That is what enables mechanics like:

- **Golden Shovel**: move one of your treasures without revealing where it went
- **Trap**: place a hidden trap during the game
- **Private inventory**: consume powers without exposing your remaining count to the opponent

## Game Design

Each player:

- hides 3 treasures
- receives a limited set of powers
- wins by finding 2 of the opponent's 3 treasures first

### Powers

| Power | Quantity | Effect |
| --- | --- | --- |
| Radar | 3 | Scans a 3x3 area and returns how many treasures are inside |
| Compass | 2 | Returns the distance to the nearest treasure |
| Golden Shovel | 1 | Moves one of your treasures |
| Trap | 2 | If the opponent digs there, they lose their next turn |

### Public vs private actions

- **Public**: turn order, dig results, radar usage, compass usage
- **Private**: treasure positions, trap positions, shovel moves, trap placement, private power state

The interesting part is that from the outside, some private actions can look identical. The opponent may know you used a hidden action, but not whether you moved a treasure or planted a trap.

## Current Status

The project now supports:

- local network development
- testnet deployment
- Azguard
- embedded wallets
- Aztec Accelerator with embedded wallets
- Sponsored FPC for app-sponsored embedded wallet fees

Current next step:

- mainnet deployment

## Wallet Support by Network

| Network | Embedded Wallet | Azguard | Fee model |
| --- | --- | --- | --- |
| Local | Yes | Yes | Sponsored FPC |
| Devnet | Yes | Yes | Sponsored FPC |
| Testnet | Yes | Yes | Project-sponsored FPC |
| Mainnet | Planned | Planned | Project-sponsored FPC |

## Repository Layout

```text
.
├── contracts/   # Noir contracts, deployment scripts, tests
└── client/      # React/Vite frontend
```

## Prerequisites

- Node.js 22+
- npm 10+ recommended
- Aztec `4.2.0-aztecnr-rc.2`

Install Aztec:

```bash
bash -i <(curl -s https://install.aztec.network)
PATH="$HOME/.aztec/bin:$PATH" aztec-up install 4.2.0-aztecnr-rc.2
```

## Local Development

### 1. Install dependencies

```bash
cd contracts
npm install

cd ../client
npm install
```

### 2. Start the local Aztec network

```bash
cd contracts
npm run aztec:start
```

Wait until the node is listening on `http://localhost:8080`.

To stop it later:

```bash
cd contracts
npm run aztec:stop
```

### 3. Compile and deploy contracts

In another terminal:

```bash
cd contracts
npm run compile
npm run codegen
npm run deploy
```

Local deploy does all of this:

- deploys the game account
- deploys `TreasureHunt`
- copies artifacts into `client/src/artifacts`
- writes `client/.env.local`

### 4. Start the frontend

In a third terminal:

```bash
cd client
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Running Tests

From `contracts/`:

```bash
npm test
npm run test:js
npm run test:nr
```

From `client/`:

```bash
npm run typecheck
npm run build
```

## Deploying to Networks

If you changed contract code:

```bash
cd contracts
npm run compile
npm run codegen
```

Then deploy from `contracts/`:

```bash
# Local
npm run deploy

# Devnet
npm run deploy::devnet

# Testnet / Mainnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::mainnet
```

### Network behavior

| Network | Command | Fee model | Generated frontend env |
| --- | --- | --- | --- |
| Local | `npm run deploy` | Sponsored FPC | `client/.env.local` |
| Devnet | `npm run deploy::devnet` | Sponsored FPC | `client/.env.devnet` |
| Testnet | `L1_PRIVATE_KEY=0x... npm run deploy::testnet` | Project-sponsored FPC | `client/.env.testnet` |
| Mainnet | `L1_PRIVATE_KEY=0x... npm run deploy::mainnet` | Project-sponsored FPC | `client/.env.mainnet` |

### Remote deploy flow

For testnet and mainnet, the deploy script:

1. creates and deploys the admin account
2. deploys a `SponsoredFPC`
3. funds that sponsor from L1
4. writes the frontend env with:
   - `VITE_CONTRACT_ADDRESS`
   - `VITE_DEPLOYER_ADDRESS`
   - `VITE_ADMIN_ADDRESS`
   - `VITE_DEPLOYMENT_SALT`
   - `VITE_AZTEC_NODE_URL`
   - `VITE_SPONSORED_FPC_ADDRESS`
   - `VITE_SPONSORED_FPC_SALT`

That means embedded wallets in the frontend can transact without asking end users to bridge their own Fee Juice.

## Running the Frontend Against a Remote Deployment

The deploy script writes one env file per network. Vite gives `.env.local` priority during local development, so the simplest way to switch networks is:

```bash
cd client
cp .env.testnet .env.local
npm run dev
```

You can do the same for `.env.devnet` or `.env.mainnet`.

If you are switching away from a previous network, replace `.env.local` or remove it first.

## Refilling the Sponsored FPC

Testnet and mainnet use an app-sponsored fee payer. When its Fee Juice balance runs low, refill it from `contracts/`:

```bash
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run refill-sponsored-fpc::testnet
```

Mainnet:

```bash
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run refill-sponsored-fpc::mainnet
```

Optional env vars:

```bash
SPONSORED_FPC_REFILL_AMOUNT=1000000000000000000000
SPONSORED_FPC_BOOTSTRAP_AMOUNT=50000000000000000000
```

## Frontend Notes

- The app is currently designed for desktop browsers.
- Embedded wallets and Azguard are both supported.
- Audio, settings, accelerator controls, and wallet state live entirely in the client.
- The frontend expects generated artifacts under `client/src/artifacts`.

## Troubleshooting

### Local network restarted and the app broke

Redeploy locally and clear the PXE store:

```bash
cd contracts
npm run clear-store
npm run deploy
```

### `aztec --version` fails with `shopt: inherit_errexit: invalid shell option name`

macOS ships with Bash 3.2, but the Aztec CLI expects a newer Bash.

```bash
brew install bash
```

If needed:

```bash
sudo sh -c 'echo /opt/homebrew/bin/bash >> /etc/shells'
chsh -s /opt/homebrew/bin/bash
```

The repo wrappers also help avoid direct CLI issues:

```bash
cd contracts
npm run aztec:start
npm run compile
npm run codegen
npm run deploy
```

## Creators

<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="33%"><a href="https://caravana.studio"><img src="img/caravana.png" width="100px;" alt="Caravana Studio"/><br /><sub><b>Caravana Studio</b></sub></a></td>
      <td align="center" valign="top" width="33%"><a href="https://x.com/dub_zn"><img src="img/dub_zn.png" width="100px;" alt="dub_zn"/><br /><sub><b>@dub_zn</b></sub></a></td>
      <td align="center" valign="top" width="33%"><a href="https://x.com/dpinoness"><img src="img/dpinoness.png" width="100px;" alt="dpinoness"/><br /><sub><b>@dpinoness</b></sub></a></td>
    </tr>
  </tbody>
</table>
