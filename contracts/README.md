<div align="center">
  <a href="https://aztec.network">
    <img src="https://cdn.prod.website-files.com/6847005bc403085c1aa846e0/6847514dc37a9e8cfe8a66b8_aztec-logo.svg" alt="Aztec Protocol Logo" width="300">
  </a>
</div>

# Treasure Hunt - An Aztec Game

A two-player treasure hunt game that showcases **why Aztec's private state is fundamentally different from commit-reveal schemes**.

<div align="center">

[![GitHub Repo stars](https://img.shields.io/github/stars/AztecProtocol/aztec-starter?logo=github&color=yellow)](https://github.com/AztecProtocol/aztec-starter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AztecProtocol/aztec-starter?logo=github&color=blue)](https://github.com/AztecProtocol/aztec-starter/network/members)
[![License](https://img.shields.io/github/license/AztecProtocol/aztec-starter)](https://github.com/AztecProtocol/aztec-starter/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/discord-join%20chat-5B5EA6)](https://discord.gg/aztec)

</div>

---

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

- **Node.js v22.15.0**
- **Docker** (for Aztec tooling)

### Install Aztec Tooling

```bash
bash -i <(curl -s https://install.aztec.network)
```

Install the correct version:

```bash
export VERSION=3.0.0-devnet.20251212
aztec-up && docker pull aztecprotocol/aztec:$VERSION && docker tag aztecprotocol/aztec:$VERSION aztecprotocol/aztec:latest
```

### Install Dependencies

```bash
yarn install
```

### Compile & Generate TypeScript

```bash
yarn compile && yarn codegen
```

### Start Local Network

```bash
aztec start --local-network
```

### Run Tests

```bash
yarn test
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
yarn compile          # Compile Noir contracts
yarn codegen          # Generate TypeScript interfaces
yarn test             # Run all tests
yarn test:js          # Run TypeScript e2e tests only
yarn test:nr          # Run Noir TXE tests only
yarn clean            # Remove compiled artifacts
yarn clear-store      # Clear PXE data (after network restart)
```

### Devnet Deployment

Append `::devnet` to any command:

```bash
yarn deploy::devnet
yarn test::devnet
```

### Important Notes

- Delete `./store` directory after restarting the local network
- Tests have long timeouts (600s) due to proof generation

---

## Resources

- [Aztec Documentation](https://docs.aztec.network/)
- [Noir Language](https://noir-lang.org/docs)
- [Aztec Discord](https://discord.gg/aztec)

---

## License

MIT
