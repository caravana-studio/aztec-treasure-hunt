<h1 align="center">Aztec – Treasure Hunt</h1>

<p align="center">
  <img src="img/game.jpg" />
</p>

**Treasure Hunt** is a two-player strategy game built on the **Aztec network**.
The goal is simple: **find your opponent's hidden treasures before they find yours**.


## <img width="24" height="24" alt="image" src="https://github.com/user-attachments/assets/1a035f51-9b5c-4772-9d18-bf7b44767adc" /> [Demo Video](https://www.youtube.com/watch?v=idaOl2Ocqg0)

Aztec supports **private state** and **private actions**, which enables game mechanics that are not possible in traditional on-chain games.

Your opponent just did something.  
You don’t know what.

Did they move a treasure?  
Did they place a trap where you’re about to dig?

There is no way to know. You only know that *something* changed.

That kind of genuine uncertainty does not exist in other on-chain games.

---

## The problem with privacy in blockchain games

Most blockchain games that want privacy end up with one of these two approaches — and both have major downsides:

### 1) Everything is public
Imagine playing Battleship while your opponent can see exactly where your ships are.  
There is no strategy, no bluffing, no mind games.

### 2) Commit–reveal
You publish a hash of your state at the start of the game.

This works for fixed setups, but it has a fundamental limitation: **your strategy becomes frozen**.

You cannot:
- Move pieces secretly
- Add hidden elements during the match
- Adapt your strategy mid-game

If you re-commit, you leak that something changed (and often *what* changed).

So if you want a game where players can adapt privately during the match, commit–reveal doesn’t work.

---

## Treasure Hunt: a game with real privacy

Treasure Hunt is a two-player game:

- Each player hides **3 treasures** on an **8×8** board
- Players take turns digging on the opponent’s board
- The first player to find **2 treasures** wins

At first glance, it sounds like Battleship. The difference is **powers**:

| Power | What it does |
|------|--------------|
| **Radar** | Scans a 3×3 area and reveals how many treasures are inside (not their positions) |
| **Compass** | Reveals the distance to the closest treasure |
| **Golden Shovel** | Moves one of your treasures to another tile |
| **Trap** | If the opponent digs there, they lose their next turn |

### Public vs private actions

- **Radar** and **Compass** are **public**: when you use them, your opponent knows.
- **Golden Shovel** and **Trap** are **private**: your opponent only sees that you “used an invisible action”.

From the outside, **moving a treasure** and **placing a trap look exactly the same**.

---

## A single turn can change everything

Imagine this situation:

```text
Your treasure is at (5,5).
Your opponent uses Compass → "Distance: 3"
They are getting close.

You use Golden Shovel → move the treasure to (1,1)
Your opponent only sees: "invisible action used"

Next turn, they dig at (5,5) → Empty.
````

Did they miscalculate the distance?
Or did you move the treasure?

They cannot know.

Each private action adds real uncertainty:

* Is the treasure still there?
* Was a trap placed?
* Did nothing happen at all?

The information is truly private, not just hidden temporarily.

---

## Why commit–reveal cannot do this

With commit–reveal, you publish something like:

```text
hash(initial_positions + salt)
```

That locks your state in place.

| What you want to do                      | Commit–reveal                            | Aztec                          |
| ---------------------------------------- | ---------------------------------------- | ------------------------------ |
| Move treasures mid-game                  | Requires re-commit (reveals a change)    | Fully invisible                |
| Place traps during the match             | Not possible (not in the initial commit) | Works naturally                |
| Make different actions indistinguishable | Different actions leak different signals | Shovel and Trap look identical |

---

## Selective privacy

Not everything in Treasure Hunt is private.
The game intentionally mixes **public and private information**:

```text
PUBLIC                               PRIVATE
─────────────────────────────────    ─────────────────────────────────
• Whose turn it is                   • Treasure positions
• Dig results                        • Trap positions
• When Radar or Compass is used      • Was it Shovel or Trap?
```

This creates interesting gameplay:

* Radar and Compass are **deducible** (their usage is public and limited)
* Golden Shovel and Trap remain **ambiguous until the end**

---

## Run locally

### Prerequisites

This repository uses **Aztec `4.2.0-aztecnr-rc.2`** (developer SDK), compatible with Alpha (Mainnet) node `4.1.2`.

```bash
# Node.js 22+
# Yarn 1.22+

# Install Aztec version manager
bash -i <(curl -s https://install.aztec.network)

# Install the exact toolchain used by this repo
PATH="$HOME/.aztec/bin:$PATH" aztec-up install 4.2.0-aztecnr-rc.2
```

### 1. Install dependencies

```bash
cd contracts && yarn install
cd ../client && yarn install
```

### 2. Start the local Aztec network

```bash
cd contracts
yarn aztec:start
```

Wait until you see `Aztec Server listening on port 8080` before continuing. To stop it later: `yarn aztec:stop`.

### 3. Compile and deploy the contracts

In a second terminal:

```bash
cd contracts
yarn compile
yarn codegen
yarn deploy
```

`yarn deploy` will:
- deploy a Schnorr account (fees paid via SponsoredFPC)
- deploy the `TreasureHunt` contract
- copy generated artifacts into `client/src/artifacts`
- write `client/.env.local` with the deployed addresses and deployment metadata

### 4. Start the client

In a third terminal:

```bash
cd client
yarn dev
```

Then open [http://localhost:3001](http://localhost:3001).

---

## Deploy to networks

If contract code changed, compile first:

```bash
cd contracts
yarn compile
yarn codegen
```

Then deploy from `contracts/`:

```bash
# Local / devnet — same flow as before
yarn deploy
yarn deploy::devnet

# Testnet / Mainnet — requires an L1 account with ETH for gas
L1_PRIVATE_KEY=0x<your-ethereum-private-key> yarn deploy::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> yarn deploy::mainnet
```

| Network | Command | Fee payment | Client env file |
|---------|---------|-------------|-----------------|
| Local | `yarn deploy` | SponsoredFPC | `client/.env.local` |
| Devnet | `yarn deploy::devnet` | SponsoredFPC | `client/.env.devnet` |
| Testnet (Sepolia) | `L1_PRIVATE_KEY=0x... yarn deploy::testnet` | Fee Juice bridged from L1 | `client/.env.testnet` |
| Mainnet (Alpha) | `L1_PRIVATE_KEY=0x... yarn deploy::mainnet` | Fee Juice bridged from L1 | `client/.env.mainnet` |

> **Compatibility:** local, testnet, and mainnet use SDK `4.2.0-aztecnr-rc.2`. Devnet still runs `4.0.0-devnet.2-patch.1`, so expect possible incompatibilities.

### Testnet / Mainnet flow

For `yarn deploy::testnet` and `yarn deploy::mainnet`, the script:

1. Creates the `AccountManager` first, so it gets a deterministic L2 address without deploying it yet
2. Bridges 1000 Fee Juice from your L1 account to that L2 address
3. Deploys the account using the bridge claim to pay the first fees
4. Deploys the `TreasureHunt` contract, which is then paid automatically by that funded account

To run the client against a non-local deployment:

```bash
cd client
cp .env.devnet .env.local    # or .env.testnet / .env.mainnet
yarn dev
```

`client/.env.local` has priority over `client/.env` in Vite. If you switch networks, make sure `.env.local` matches the network you want to use, or remove it before starting `yarn dev`.

Remote env files now include:

- `VITE_CONTRACT_ADDRESS`
- `VITE_DEPLOYER_ADDRESS`
- `VITE_ADMIN_ADDRESS`
- `VITE_DEPLOYMENT_SALT`
- `VITE_AZTEC_NODE_URL`

---

## Troubleshooting

### `aztec --version` fails with `shopt: inherit_errexit: invalid shell option name`

macOS ships with Bash 3.2, but the Aztec CLI requires Bash 4.4+. Fix:

```bash
brew install bash
```

Then optionally set it as default (open a new terminal after):

```bash
sudo sh -c 'echo /opt/homebrew/bin/bash >> /etc/shells'
chsh -s /opt/homebrew/bin/bash
```

Alternatively, the repo-local wrapper bypasses the global `aztec` command:

```bash
cd contracts
yarn aztec:start  # instead of aztec start --local-network
yarn compile
yarn codegen
yarn deploy
```

### I restarted the local network and the app stopped working

Redeploy the contracts and clear the PXE store:

```bash
cd contracts
yarn clear-store
yarn deploy
```

---

## Creators ✨

<table>
  <tbody>
    <tr>
            <td align="center" valign="top" width="33%"><a href="https://caravana.studio"><img src="img/caravana.png" width="100px;" alt="Caravana Studio"/><br /><sub><b>Caravana Studio</b></sub></a></td>
      <td align="center" valign="top" width="33%"><a href="https://x.com/dub_zn"><img src="img/dub_zn.png" width="100px;" alt="dub_zn"/><br /><sub><b>@dub_zn</b></sub></a></td>
      <td align="center" valign="top" width="33%"><a href="https://x.com/dpinoness"><img src="img/dpinoness.png" width="100px;" alt="dpinoness"/><br /><sub><b>@dpinoness</b></sub></a></td>
    </tr>
  </tbody>
</table>
