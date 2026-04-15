# Warrant Architecture

## Product thesis

Warrant focuses on verifiable execution for autonomous liquidity
management on X Layer. The core guarantee is simple: **No warrant, no
move.**

- Owners declare strategy constraints once, in plain language.
- Agents propose and execute liquidity moves on Uniswap v3.
- Capital cannot move until a warrant verifier has signed off on BOTH
  the strategy policy AND the exact execution parameters the executor
  is about to run.

## MVP boundaries

This repo intentionally limits scope to a single-pool, single-strategy
demo so the entire proof pipeline is inspectable end-to-end.

- one owner policy
- one X Layer Uniswap v3 pool (default: `xETH / USDT0 0.05%`)
- one warrant gate for every rebalance
- one readable audit trail

## Contract surface

| Contract | Responsibility |
| --- | --- |
| `StrategyRegistry` | Stores owner-declared constraints and enforces a real per-day rebalance budget that resets at UTC midnight. |
| `ProofVerifier` | Accepts warrant submissions, binds each to BOTH `proposalHash` and `executionHash`, and exposes a single-use consume gate. Delegates the actual signature/proof check to an external `IZkVerifier` contract so the underlying crypto can be swapped without migrations. |
| `AttestationVerifier` | Default `IZkVerifier` implementation Warrant ships with. Accepts an ECDSA signature from a pre-authorized signer over `keccak256(strategyId, proposalHash, executionHash)`. Future versions can swap in a groth16/plonk verifier via `ProofVerifier.setVerifier(...)`. |
| `LiquidityVault` | Holds capital. Only executes a rebalance after consuming a warrant bound to an execution hash that matches the parameters it was asked to run. |
| `RewardSplitter` | Records per-epoch reward attribution. Only authorized recorders may write, and enforces `scoutReward + executorReward + treasuryReward ≤ grossFees`. |

## Warrant binding model

The critical security invariant — that an executor cannot substitute
different runtime parameters than the scout committed to — is enforced
through a **dual-hash commitment**:

1. When the Scout calls `ProofVerifier.submitProof(proofId, strategyId, proposalHash, executionHash, publicInputs, proofData)`:
   - `proposalHash` — a human-readable commitment describing WHAT the
     scout is proposing (risk level, tick context, pool id).
   - `executionHash` — `keccak256(abi.encode(pool, lowerTick, upperTick, liquidityDelta, recipient))`.
   - `proofData` — an ECDSA signature over `keccak256(strategyId, proposalHash, executionHash)` produced by the attestation signer (or a future zk-SNARK).
2. The Executor later calls `LiquidityVault.executeRebalance(vaultId, proofId, RebalanceAction)`:
   - The vault **recomputes** `keccak256(abi.encode(action.*))` on-chain.
   - It passes the recomputed hash to `ProofVerifier.consumeProof`.
   - The verifier reverts on any mismatch with the stored `executionHash`.
3. The warrant is marked `consumed` and can never be replayed.

Result: the executor has zero room to deviate from the parameters the
scout committed to. If the scout's proposed lower tick is 199000, the
executor cannot execute anything else.

## Skill integration — the actual pipeline

Warrant's **Uniswap Skill** integration is not just a label in the
submission packet. The concrete call path is:

1. `lib/uniswap/pool-reader.ts` opens an `ethers.JsonRpcProvider` against
   X Layer mainnet and calls 7 view methods on a Uniswap v3 pool:
   `slot0()`, `liquidity()`, `token0()`, `token1()`, `fee()`,
   `tickSpacing()`, `observe()`. For known tokens it also uses
   `symbol()` and `decimals()` via the ERC20 metadata view path.
2. `lib/uniswap/scout.ts` converts the pool snapshot into a concrete
   `RebalanceAction` (pool/lowerTick/upperTick/liquidityDelta/recipient)
   under the declared risk profile.
3. `lib/uniswap/scout.ts` then computes `executionHash` the same way
   `LiquidityVault` will recompute it on-chain.
4. `agents/scout-agent.ts` (the `ScoutAgent` class) wraps the above
   with typed input validation.
5. `app/api/scout/propose/route.ts` exposes a server-side POST endpoint
   that the frontend terminal hits whenever the user clicks the Live
   Scout button. No RPC hops are done from the browser — the scout
   agent runs inside Next.js' server runtime.
6. On mainnet the executor will use
   `NonfungiblePositionManager.mint` / `decreaseLiquidity` on X Layer's
   canonical Uniswap v3 deployment. Addresses live in `config/uniswap.ts`
   and are automatically written into the deployment manifest by the
   deploy script.

## Agent flow

1. The owner creates a strategy in natural language via `/strategy`.
2. The frontend compiles that intent into `StrategyRegistry.createStrategy`
   parameters (`allowedPool`, `maxRebalancesPerDay`, `riskLevel`, `metadataHash`).
3. The Scout Agent runs the Uniswap v3 read pipeline above and builds a
   concrete `RebalanceAction` struct.
4. The Scout signs `(strategyId, proposalHash, executionHash)` with the
   attestation signer key.
5. `ProofVerifier.submitProof(...)` stores the dual commitment. Access
   control: the strategy must exist and be active.
6. The Executor Agent calls `LiquidityVault.executeRebalance(vaultId, proofId, action)`.
7. The Vault recomputes the execution hash on-chain, consumes the
   warrant, burns one daily slot, and emits a structured event.
8. The Treasury Agent records the reward epoch via
   `RewardSplitter.recordEpoch`, which enforces the split invariant.

## Why this framing

Warrant doesn't try to prove optimality or non-collusion. It proves a
narrower, more credible claim:

> the rebalance followed owner-declared constraints before capital moved

That claim is easy to explain, easy to verify, and after the Phase 2
security fixes it is what the contracts actually enforce on-chain.
