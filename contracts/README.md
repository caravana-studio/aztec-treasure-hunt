# Treasure Hunt Contracts

Noir contracts, deployment scripts, and end-to-end tests for Treasure Hunt.

This package contains the onchain and private-state logic that powers:

- hidden treasure placement
- hidden traps
- private power inventory
- post-start private state changes such as the Golden Shovel

If you want the full project overview and frontend setup, start from the repo root README.

## The Game

Two players compete on an **8x8 grid**. Each player:
- Hides **3 treasures** at secret locations
- Gets **8 powers** to use strategically
- Tries to find **2 of the opponent's 3 treasures** to win

### Powers

| Power | Quantity | Effect |
|-------|----------|--------|
| **Metal Detector** | x3 | Scan a 3x3 area, learn how many treasures are there |
| **Compass** | x2 | Get the distance to the nearest opponent treasure |
| **Golden Shovel** | x1 | **Move one of your treasures to a new location** |
| **Trap** | x2 | Place a hidden trap - opponent loses a turn if they dig there |

### Why This Game Needs Aztec

This game **cannot be built with commit-reveal** schemes (like hashing secrets in Solidity). Here's why:

#### Commit-Reveal: Static Secrets

```
Traditional approach:
1. commit(hash(secret))     → Store hash on-chain
2. reveal(secret)           → Verify hash, secret is now public

Problem: The secret is STATIC. Once committed, it cannot change.
```

#### Aztec: Dynamic Private State

```
Aztec approach:
1. Store encrypted data     → Only you can read it
2. Modify it privately      → Nobody sees the change
3. Use it in computations   → Prove results without revealing inputs
4. Optionally reveal later  → Or keep it private forever
```

### The Key Difference: Golden Shovel

The **Golden Shovel** power lets you **move your treasure** after the game starts:

```
With Commit-Reveal (Solidity):
┌─────────────────────────────────────────────────────────┐
│ 1. commit(hash(x=3, y=5))    → Treasure at (3,5)       │
│ 2. Opponent scans (3,5)      → You want to move!       │
│ 3. re-commit(hash(x=7, y=2)) → VISIBLE! Opponent sees  │
│                                 you changed something   │
└─────────────────────────────────────────────────────────┘

With Aztec:
┌─────────────────────────────────────────────────────────┐
│ 1. Store TreasureNote{x:3, y:5}  → Private note        │
│ 2. Opponent scans (3,5)          → You want to move!   │
│ 3. Update to {x:7, y:2}          → INVISIBLE! Opponent │
│                                    has no idea you moved│
└─────────────────────────────────────────────────────────┘
```

### More Features Impossible with Commit-Reveal

| Feature | Why Commit-Reveal Fails | How Aztec Solves It |
|---------|------------------------|---------------------|
| **Traps** | Added AFTER initial commit - would need new hash | Private notes can be created anytime |
| **Power inventory** | Consuming powers changes state | Notes consumed without revealing which |
| **Hidden power usage** | Re-committing is visible | Opponent doesn't know what powers you used |
| **Partial information** | Either reveal all or nothing | Scan returns count without positions |

---

## Architecture

### Private State (Per Player)

```
Your encrypted storage (only YOU can read):
├── treasures: [TreasureNote, TreasureNote, TreasureNote]
│              {x, y} - positions can CHANGE with shovel
├── traps: [TrapNote, ...]
│          {x, y} - added dynamically during game
└── powers: [PowerNote x8]
            {type} - consumed as you use them
```

### Public State (Everyone Sees)

```
Game state:
├── player1, player2 addresses
├── current_turn
├── treasures_found per player
└── game_status
```

### Contract Files

```
src/
├── main.nr           # Main contract with all game functions
├── treasure_note.nr  # Private note for treasure positions
├── trap_note.nr      # Private note for trap positions
├── power_note.nr     # Private note for power inventory
├── game.nr           # Public game state struct
└── test/             # Noir TXE tests
```

---

## Getting Started

### Prerequisites

- **Node.js 22+**
- **npm 10+** recommended
- **Aztec `4.2.0-aztecnr-rc.2`**

### Install Aztec Tooling

```bash
bash -i <(curl -s https://install.aztec.network)
```

Install the correct version:

```bash
PATH="$HOME/.aztec/bin:$PATH" aztec-up install 4.2.0-aztecnr-rc.2
```

### Install Dependencies

```bash
npm install
```

All commands below use `npm run`.

### Compile & Generate TypeScript

```bash
npm run compile
npm run codegen
```

### Start Local Network

```bash
npm run aztec:start
```

Wait until you see `Aztec Server listening on port 8080` before deploying. Stop it later with `npm run aztec:stop`.

### Deploy

```bash
# Local / devnet
npm run deploy
npm run deploy::devnet

# Testnet / Mainnet — requires an L1 account with ETH for gas
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run deploy::mainnet
```

Deploy outputs by network:

- `npm run deploy` uses SponsoredFPC and writes `../client/.env.local`
- `npm run deploy::devnet` uses SponsoredFPC and writes `../client/.env.devnet`
- `npm run deploy::testnet` deploys and funds a SponsoredFPC for app-sponsored embedded wallet fees and writes `../client/.env.testnet`
- `npm run deploy::mainnet` deploys and funds a SponsoredFPC for app-sponsored embedded wallet fees and writes `../client/.env.mainnet`

Each generated client env file includes:

- `VITE_CONTRACT_ADDRESS`
- `VITE_DEPLOYER_ADDRESS`
- `VITE_ADMIN_ADDRESS`
- `VITE_DEPLOYMENT_SALT`
- `VITE_AZTEC_NODE_URL`

For `deploy::testnet` and `deploy::mainnet`, the script:

1. Creates the `AccountManager` first to derive the deterministic L2 address
2. Funds and deploys the admin account
3. Deploys a `SponsoredFPC`
4. Bridges Fee Juice from L1 into that sponsor
5. Deploys the `TreasureHunt` contract with sponsored fee support for embedded wallets

To refill the sponsor later:

```bash
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run refill-sponsored-fpc::testnet
L1_PRIVATE_KEY=0x<your-ethereum-private-key> npm run refill-sponsored-fpc::mainnet
```

### Run Tests

```bash
npm test
```

Additional test commands:

```bash
npm run test:js
npm run test:nr
npm run test::devnet
```

---

## Game Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         SETUP PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. create_game(game_id)              [PUBLIC]                   │
│ 2. join_game(game_id)                [PUBLIC]                   │
│ 3. place_treasures(x1,y1,x2,y2,x3,y3) [PRIVATE] → Creates notes │
│    (Each player places 3 treasures + receives 8 powers)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         PLAY PHASE                               │
├─────────────────────────────────────────────────────────────────┤
│ Each turn, active player can:                                    │
│                                                                  │
│ • dig(x, y)              [PUBLIC]  → Try to find treasure       │
│   └── respond_dig()      [PRIVATE] → Opponent checks & responds │
│                                                                  │
│ • use_detector(x, y)     [PRIVATE] → Scan 3x3 area              │
│   └── respond_detector() [PRIVATE] → Returns treasure count     │
│                                                                  │
│ • use_compass(x, y)      [PRIVATE] → Get distance to nearest    │
│   └── respond_compass()  [PRIVATE] → Returns min distance       │
│                                                                  │
│ • use_shovel(old, new)   [PRIVATE] → MOVE your treasure!        │
│                                      (No opponent response)      │
│                                                                  │
│ • use_trap(x, y)         [PRIVATE] → Place hidden trap          │
│                                      (No opponent response)      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         WIN CONDITION                            │
├─────────────────────────────────────────────────────────────────┤
│ First player to find 2 of opponent's 3 treasures wins!          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Aztec?

### The Core Innovation

Aztec provides **encrypted persistent state** that belongs to users:

1. **Private Notes**: Encrypted data only the owner can read
2. **State Changes**: Modify private data without anyone knowing
3. **Selective Disclosure**: Reveal only what you choose, when you choose
4. **Computation on Secrets**: Process private data, output only results

### Compared to Other Approaches

| Approach | Can Hide | Can Modify | Can Prove Properties |
|----------|----------|------------|---------------------|
| Plain Solidity | No | N/A | N/A |
| Commit-Reveal | Yes (temporarily) | No (re-commit visible) | No |
| **Aztec** | **Yes (permanently)** | **Yes (invisibly)** | **Yes (ZK proofs)** |

### Real-World Applications

The same patterns used in this game apply to:

- **Private voting**: Vote without revealing your choice
- **Sealed auctions**: Bid without others seeing your amount
- **Private balances**: Transact without revealing your wealth
- **Hidden game state**: Any game with fog of war or hidden information

---

## Development

### Commands

```bash
npm run compile          # Compile Noir contracts
npm run codegen          # Generate TypeScript interfaces
npm run deploy           # Local deploy (SponsoredFPC)
npm run deploy::devnet   # Devnet deploy (SponsoredFPC)
npm run deploy::testnet  # Testnet deploy (requires L1_PRIVATE_KEY)
npm run deploy::mainnet  # Mainnet deploy (requires L1_PRIVATE_KEY)
npm test                 # Run all tests
npm run test:js          # Run TypeScript e2e tests only
npm run test:nr          # Run Noir TXE tests only
npm run clean            # Remove compiled artifacts
npm run clear-store      # Clear PXE data (after network restart)
```

### Important Notes

- Delete `./store` directory after restarting the local network
- `npm run test::devnet` is available for JS e2e tests against devnet
- Tests have long timeouts (600s) due to proof generation

---

## Resources

- [Aztec Documentation](https://docs.aztec.network/)
- [Noir Language](https://noir-lang.org/docs)
- [Aztec Discord](https://discord.gg/aztec)

---

## License

MIT
