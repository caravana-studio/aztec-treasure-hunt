# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A two-player Treasure Hunt game built on Aztec Protocol demonstrating private state capabilities that cannot be achieved with commit-reveal schemes:
- **Golden Shovel**: Move treasures after game starts (invisible state changes)
- **Traps**: Added dynamically during gameplay
- **Power inventory**: Consumed over time without revealing remaining powers

## Repository Structure

```
treasure-hunt-aztec/
├── contracts/          # Noir smart contracts + TypeScript deployment/tests
│   ├── src/            # Noir source (.nr files)
│   ├── scripts/        # Deployment scripts
│   └── src/test/e2e/   # TypeScript integration tests
├── client/             # React/Vite frontend
│   └── src/            # React components + Aztec SDK integration
```

## Prerequisites

- Node.js v22+
- Yarn 1.22+
- Aztec CLI: `curl -L https://install.aztec.network | bash && aztec-up`

## Common Commands

### Local Development Setup
```bash
# Terminal 1 - Start Aztec network (keep running)
aztec start --local-network

# Terminal 2 - Contracts
cd contracts
yarn install
yarn compile && yarn codegen
yarn deploy

# Terminal 3 - Client
cd client
yarn install
yarn dev
```

### Contracts (`contracts/`)

| Command | Description |
|---------|-------------|
| `yarn compile` | Compile Noir contracts |
| `yarn codegen` | Generate TypeScript artifacts |
| `yarn deploy` | Deploy to local network |
| `yarn deploy::devnet` | Deploy to devnet |
| `yarn test` | Run all tests (e2e + Noir) |
| `yarn test:js` | TypeScript e2e tests only |
| `yarn test:nr` | Noir TXE tests only |
| `yarn clean` | Remove compiled artifacts |
| `yarn clear-store` | Clear PXE store (required after network restart) |

### Client (`client/`)

| Command | Description |
|---------|-------------|
| `yarn dev` | Start dev server (port 3001) |
| `yarn build` | Production build |
| `yarn copy-artifacts` | Copy contract artifacts from contracts/ |
| `yarn lint` | Run prettier check |

## Architecture

### Contract Layer (Noir)
- `src/main.nr` - Main TreasureHunt contract
- `src/treasure_note.nr` - Private note for treasure positions
- `src/trap_note.nr` - Private note for dynamically added traps
- `src/power_note.nr` - Private note for power inventory
- `src/game.nr` - Public Game struct (players, turns, found treasures)

**Execution Model**:
- Private functions (`place_treasures`, `use_shovel`, `use_trap`) create ZK proofs client-side
- Public functions (`create_game`, `join_game`, `dig`) execute on-chain
- Use `self.enqueue()` to call public functions from private context

### Client Layer (React)
- `src/embedded-wallet.ts` - Wallet SDK integration for account management
- `src/App.tsx` - Main game UI
- `src/artifacts/` - Generated contract TypeScript interfaces (from `yarn codegen`)

## Environment Configuration

The `AZTEC_ENV` variable controls network selection:
- Default: `local-network` (uses `contracts/config/local-network.json`)
- Devnet: `AZTEC_ENV=devnet` or use `::devnet` script suffix

Client reads deployment info from `client/.env`:
```
VITE_PXE_URL=http://localhost:8080
VITE_CONTRACT_ADDRESS=<deployed address>
```

## Development Notes

- Use 4 spaces for indentation in TypeScript (contracts), 2 spaces in client
- Tests have long timeouts (200-600s) due to proof generation
- Set `PROVER_ENABLED=false` for faster local development
- Clear `./store` directory after restarting local network to avoid PXE errors
- Do not commit `src/artifacts/`, `target/`, or `store/` directories

## Aztec-Specific Patterns

See `contracts/AGENTS.md` for detailed Noir language reference and Aztec contract patterns including:
- Storage types (PublicMutable, PrivateSet, Map)
- Function decorators (#[external("public")], #[external("private")])
- Note-based privacy (UTXO model)
- Access control patterns for cross-context authorization
