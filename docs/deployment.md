# Deployment

## Environment

Copy `.env.example` to `.env` and fill in:

### Required

- `EXPECTED_CHAIN_ID` — `196` for X Layer mainnet, `1952` for X Layer testnet.
- `XLAYER_RPC_URL` — RPC endpoint. Mainnet: `https://rpc.xlayer.tech`. Testnet: `https://testrpc.xlayer.tech/terigon`.
- `DEPLOYER_PRIVATE_KEY` — Private key of the wallet that deploys all contracts.
- `EXECUTOR_ADDRESS` — The only address allowed to call `LiquidityVault.executeRebalance`.

### Recommended

- `SCOUT_AGENT_ADDRESS` — Scout agent wallet (default for attestation signer).
- `TREASURY_AGENT_ADDRESS` — Optional additional recorder on `RewardSplitter`.

### Warrant verifier backend — choose ONE

**Option A** — existing verifier contract:
- `PROOF_SYSTEM_VERIFIER_ADDRESS` — address of a pre-deployed verifier implementing `IZkVerifier.verify(bytes, bytes32[])`.

**Option B** — auto-deploy `AttestationVerifier.sol` (default on mainnet):
- `ATTESTATION_SIGNER_ADDRESS` — the only address whose ECDSA signature will be accepted. Defaults to `SCOUT_AGENT_ADDRESS`.
- Leave `PROOF_SYSTEM_VERIFIER_ADDRESS` empty.

### Insecure override (testnet only)

- `ALLOW_INSECURE_PROOFS=true` — makes `ProofVerifier` accept any non-empty
  payload. The deploy script **aborts** if this is set while
  `EXPECTED_CHAIN_ID=196`.

## Mainnet hard guards

The deploy script refuses to run on `EXPECTED_CHAIN_ID=196` unless ALL
of the following are true:

1. `ALLOW_INSECURE_PROOFS=false`
2. Either `PROOF_SYSTEM_VERIFIER_ADDRESS` is set **or** `ATTESTATION_SIGNER_ADDRESS` is set
3. The connected RPC reports `chainId=196`

Any mismatch aborts the deploy before any transaction is broadcast.
There is no workaround — if you want to demo without a real verifier,
deploy to testnet (`EXPECTED_CHAIN_ID=1952`).

## Commands

```bash
# Generate agent wallets (optional, run once)
pnpm agents:generate --env > .env.local.secret

# Compile contracts
pnpm contracts:compile

# Run the invariant test suite (requires LOCAL_RPC_URL env)
# LOCAL_RPC_URL=http://127.0.0.1:8545 pnpm contracts:test

# Deploy all 5 contracts to the target chain
pnpm contracts:deploy
```

## Output

- ABI and bytecode artifacts are written to `artifacts/contracts/`
- Deployment manifests are written to `deployments/xlayer-<chainId>.json`
- The `network` field is filled in from the chainId-to-network mapping in
  `config/networks.ts`, not hardcoded. A testnet deploy will correctly
  record `"X Layer testnet"`, not mainnet.
- The Uniswap v3 deployment addresses for the target chain are
  automatically embedded in the manifest under `uniswap` when deploying
  to mainnet.

## What the deploy script does

1. Validates `EXPECTED_CHAIN_ID` matches what the RPC reports.
2. Enforces the mainnet hard guards (no insecure mode, verifier required).
3. If no external verifier is supplied and an attestation signer is set,
   deploys `AttestationVerifier.sol` automatically.
4. Deploys `StrategyRegistry` (owner = deployer).
5. Deploys `ProofVerifier(verifierAddress, strategyRegistryAddress, allowInsecureProofs)`.
6. Deploys `LiquidityVault(strategyRegistryAddress, proofVerifierAddress, executorAddress)`.
7. Deploys `RewardSplitter` (owner = deployer).
8. Authorizes `LiquidityVault` as a consumer of `StrategyRegistry` and `ProofVerifier`.
9. Authorizes `LiquidityVault` as a recorder on `RewardSplitter`.
10. If `TREASURY_AGENT_ADDRESS` is set, also authorizes it as a recorder.
11. Writes the full deployment manifest to `deployments/xlayer-<chainId>.json`.

## Notes

- `ProofVerifier` binds each warrant to BOTH `proposalHash` AND
  `executionHash`. `LiquidityVault.executeRebalance` recomputes the
  execution hash from a `RebalanceAction` struct on-chain, so the
  executor cannot substitute parameters after the warrant is issued.
- `StrategyRegistry.consumeRebalance` resets the daily counter whenever
  it observes a new UTC day. `maxRebalancesPerDay` means what it says.
- `RewardSplitter.recordEpoch` is access-controlled. The deploy script
  automatically authorizes the deployed `LiquidityVault` and (if set)
  the `TREASURY_AGENT_ADDRESS` as recorders.
- The Vault also requires the caller of `createVault` to be the owner
  of the referenced strategy. No unrelated address can bind a vault to
  somebody else's daily budget.
