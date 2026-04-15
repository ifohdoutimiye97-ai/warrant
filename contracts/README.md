# Contracts

These Solidity files define the MVP contract surface for Warrant.

## Scope

- `StrategyRegistry.sol` stores owner-declared strategy constraints.
- `ProofVerifier.sol` records proof approvals and exposes the gate used by the executor.
- `LiquidityVault.sol` holds owner capital and only allows proof-gated liquidity actions.
- `RewardSplitter.sol` records fee snapshots and reward events.

## Design notes

- The current contracts are intentionally minimal and readable.
- They avoid heavyweight dependencies so the repo stays understandable during hackathon review.
- Real deployment work should replace placeholder proof checks with generated verifier logic and connect the vault to the chosen X Layer liquidity router path.
