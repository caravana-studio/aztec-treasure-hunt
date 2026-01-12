# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Aztec Protocol project featuring a **Treasure Hunt** two-player game that demonstrates why Aztec's private state is fundamentally different from commit-reveal schemes.

### Why Aztec (Not Commit-Reveal)?

This game cannot be built with commit-reveal because:
- **Golden Shovel**: Move treasures AFTER game starts (state changes invisibly)
- **Traps**: Added dynamically during gameplay (not in initial commit)
- **Power inventory**: Consumed over time without revealing which powers remain
- **Opponent uncertainty**: No visible re-commits when state changes

## Common Commands

```bash
# Install dependencies
yarn install

# Compile Noir contracts
yarn compile

# Generate TypeScript artifacts from compiled contracts
yarn codegen

# Full build workflow
yarn compile && yarn codegen

# Start local Aztec network (required before running tests/scripts)
aztec start --local-network

# Run all tests (TypeScript e2e + Noir TXE tests)
yarn test

# Run only TypeScript e2e tests
yarn test:js

# Run only Noir TXE tests
yarn test:nr

# Deploy contract to local network
yarn deploy

# Deploy to devnet (append ::devnet to any script)
yarn deploy::devnet
yarn test::devnet

# Clean compiled artifacts
yarn clean

# Clear PXE store (required after restarting local network)
yarn clear-store
```

## Architecture

### Contract Structure (Noir)

- `src/main.nr` - Main TreasureHunt contract with all game functions
- `src/treasure_note.nr` - Private note for treasure positions (can change with shovel)
- `src/trap_note.nr` - Private note for trap positions (added dynamically)
- `src/power_note.nr` - Private note for power inventory (consumed over time)
- `src/game.nr` - Public Game struct (players, turns, treasures found)
- `src/test/` - Noir TXE (Testing eXecution Environment) tests

The contract uses Aztec's hybrid public/private execution model:
- Private functions (`place_treasures`, `use_shovel`, `use_trap`) operate on private notes
- Public functions (`create_game`, `join_game`, `dig`) modify public state
- Private-to-public calls via `self.enqueue()` bridge the two domains

### TypeScript Structure

- `src/artifacts/` - Generated contract interfaces (from `yarn codegen`)
- `src/test/e2e/` - Integration tests using Jest
- `src/utils/` - Account management, wallet setup, fee payment helpers
- `scripts/` - Deployment and interaction scripts
- `config/` - Environment configuration (local-network.json, devnet.json)

### Environment Configuration

The `AZTEC_ENV` variable controls which network to use:
- Default: `local-network` (uses `config/local-network.json`)
- Devnet: Set `AZTEC_ENV=devnet` or use `::devnet` script suffix

### Key Dependencies

- `@aztec/aztec.js` - Core Aztec.js SDK
- `@aztec/accounts` - Account management
- `@aztec/noir-contracts.js` - Standard library contracts (e.g., SponsoredFPC)
- `@aztec/test-wallet` - TestWallet for e2e tests

## Development Notes

- Use Node.js v22
- Use 4 spaces for indentation in TypeScript
- Do not commit `src/artifacts/`, `target/`, or `store/` directories
- Delete `./store` directory after restarting the local network to avoid PXE errors
- Tests have long timeouts (600s) due to proof generation time

## Aztec Contract Development Reference

Documentation: https://docs.aztec.network/developers/docs/tutorials/contract_tutorials/token_contract

### Storage Types

- **PublicMutable<T>**: Transparent state visible to all, use for public game state
- **Map<K, V>**: Key-value storage for collections
- **PrivateSet<T>**: Encrypted notes visible only to owners (used for `TreasureNote`, `TrapNote`, `PowerNote`)
- **Owned<T>**: Wrapper for owner-scoped private storage

### Function Decorators

```noir
#[initializer]              // Runs once at deployment (constructor)
#[external("public")]       // On-chain execution, modifies public state
#[external("private")]      // Client-side execution, creates ZK proofs
#[only_self]                // Restrict to internal contract calls only
#[external("utility")]      // Read-only queries (with unconstrained)
```

### Execution Model

- Private functions execute client-side and create zero-knowledge proofs
- Public functions execute on-chain after private functions complete
- Use `self.enqueue()` to call public functions from private context
- Transaction reverts atomically if any public check fails

### Note-Based Privacy (UTXO Model)

Private balances use notes that are "nullified" (marked spent) when consumed and new notes created for recipients. The network sees only state changes, not transaction details.

### Access Control Pattern

For cross-context authorization:
1. Create a public helper marked `#[only_self]`
2. Private function enqueues the helper via `self.enqueue()`
3. Public helper validates ownership/permissions
4. Transaction reverts if validation fails

## Noir Language Reference

Documentation: https://noir-lang.org/docs

### Data Types

```noir
// Primitives
Field                    // Fundamental ZK field element
u8, u32, u64            // Unsigned integers
bool                     // Boolean
str<N>                   // Fixed-size string

// Compound types
[T; N]                   // Fixed-size array
(T1, T2)                 // Tuple
struct MyStruct { }      // Custom struct

// Visibility in function signatures
fn main(x: u32, y: pub u32) -> pub u32  // x is private, y and return are public
```

### Functions

```noir
// Basic function (last expression is return value)
fn add(x: Field, y: Field) -> Field {
    x + y
}

// Visibility modifiers
pub fn public_function() {}        // Visible outside package
pub(crate) fn crate_function() {}  // Visible within crate only

// Methods via impl blocks
impl MyStruct {
    fn new() -> Self { ... }
}

// Lambdas
let f = |x, y| x + y;
```

### Control Flow

```noir
// If/else (parentheses optional)
if condition {
    // ...
} else {
    // ...
}

// For loops (bounds must be known at compile time)
for i in 0..10 { }      // Exclusive: 0 to 9
for i in 0..=10 { }     // Inclusive: 0 to 10

// break, continue, while, loop - ONLY in unconstrained code
unconstrained fn flexible() {
    while condition { break; }
}
```

### Key Constraints

- **No early returns**: Functions must have a single exit point
- **Static loop bounds**: For loops in constrained code require compile-time known iteration counts
- **Dynamic control flow**: `break`, `continue`, `while`, `loop` only work in `unconstrained` functions
- **All values are Field elements**: Everything compiles down to field arithmetic for ZK circuits
