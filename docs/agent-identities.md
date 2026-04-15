# Agent Identities

Warrant uses **four distinct wallets** as its on-chain identity. Each role
has a minimal permission surface, so if one key is compromised the
blast radius is bounded.

## Why four wallets?

The core security property Warrant offers to owners is:

> capital cannot move unless a warrant verifier signs off on the exact
> execution parameters the scout committed to.

That property only works if the *scout*, *executor*, and *treasury*
roles are actually separated. Collapsing them into a single hot wallet
would let one leaked key bypass every invariant.

## Wallet roles

| Role | What it does on-chain | Required funding |
|---|---|---|
| **Owner Wallet** | Deploys the 5 Warrant contracts (`StrategyRegistry`, `ProofVerifier`, `LiquidityVault`, `RewardSplitter`, `AttestationVerifier`), owns and configures them, creates strategies, funds vaults, and holds the LP capital. | ~0.1 OKB for the full deploy pipeline on X Layer mainnet (5 contract deployments + 3-4 wiring tx). **0.5 OKB is a generous buffer.** Add more only when you start funding vault notionals. |
| **Scout Agent Wallet** | Reads live Uniswap v3 pool state from X Layer (see `lib/uniswap/pool-reader.ts`), plans `RebalanceAction` structs, and signs the `(strategyId, proposalHash, executionHash)` tuple that `AttestationVerifier.verify(...)` accepts. Also submits proofs via `ProofVerifier.submitProof(...)`. | Micro — < 0.01 OKB per submitted proof. |
| **Executor Agent Wallet** | The only address allowed to call `LiquidityVault.executeRebalance(vaultId, proofId, RebalanceAction)`. Consumes the verified warrant and triggers the actual Uniswap v3 mint/burn/swap. | Micro — < 0.01 OKB per rebalance. |
| **Treasury Agent Wallet** | Authorized recorder on `RewardSplitter`. Writes fee-split records tied to each proof id after execution. Enforces the `scoutReward + executorReward + treasuryReward <= grossFees` invariant. | Micro — < 0.01 OKB per epoch. |

## Generating a fresh set

```bash
# Print to stdout (safe to read once, lose forever)
pnpm agents:generate

# Write to a 0600-permission JSON file
pnpm agents:generate --out .wallets.json

# Emit .env.example-ready lines (pipe into .env)
pnpm agents:generate --env >> .env
```

> The generator uses `ethers.Wallet.createRandom()` under the hood. No
> mnemonic is stored. Each key is fully independent.

## Post-deployment wiring

The deploy script automatically:

1. Authorizes `LiquidityVault` as a consumer of both `StrategyRegistry`
   and `ProofVerifier`.
2. Authorizes `LiquidityVault` as a recorder on `RewardSplitter`.
3. If `TREASURY_AGENT_ADDRESS` is set, also authorizes that wallet as an
   additional recorder, so the treasury agent can write epochs directly.
4. If `ATTESTATION_SIGNER_ADDRESS` is set (or defaults to
   `SCOUT_AGENT_ADDRESS`), auto-deploys `AttestationVerifier.sol` with
   that signer and passes its address to `ProofVerifier` at construction
   time — so the proof gate never falls back to insecure demo mode on
   mainnet.

## Address table

Replace these after running `pnpm contracts:deploy`. The readiness check
(`pnpm submission:check`) will warn about any wallet still at
`TBD_AFTER_DEPLOYMENT`.

| Role | Address | Explorer |
| --- | --- | --- |
| Owner Wallet | `0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061` | [explorer](https://www.okx.com/web3/explorer/xlayer/address/0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061) |
| Scout Agent Wallet | `0x86b0E1c48d39D58304939c0681818F0E1c1e8d83` | [explorer](https://www.okx.com/web3/explorer/xlayer/address/0x86b0E1c48d39D58304939c0681818F0E1c1e8d83) |
| Executor Agent Wallet | `0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9` | [explorer](https://www.okx.com/web3/explorer/xlayer/address/0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9) |
| Treasury Agent Wallet | `0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0` | [explorer](https://www.okx.com/web3/explorer/xlayer/address/0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0) |

## Key rotation

- `AttestationVerifier.setSigner(newSigner)` — swaps the scout signer
  without redeploying anything else. Onlyowner-gated.
- `AttestationVerifier.transferOwnership(newOwner)` — moves the admin
  key to cold storage after initial setup.
- `ProofVerifier.setVerifier(newVerifier)` — swap in a future zk
  verifier contract without migrating any strategies or vaults.
- `LiquidityVault.setExecutor(newExecutor)` — rotate the executor key
  if compromised. Vault owner only.
- `StrategyRegistry.setConsumer(oldVault, false)` + `setConsumer(newVault, true)` — migrate to a new vault.
