# Warrant — Proof-gated Liquidity Agents on X Layer

Generated at 2026-04-15T02:06:13.271Z

## Overview

- Track: X Layer Arena
- Pitch: Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.
- Target pool: xETH / USDT0 · Uniswap v3 0.05% · 0x77ef18ad…
- Integrations: X Layer (chainId 196), Uniswap Skills · 6 modules (V3Pool, QuoterV2, TickLens, V3Factory, NFPM, SwapRouter02), Onchain OS Skill · okx-dex-swap (DEX Aggregator, HMAC-signed)
- Manifest source: xlayer-196.json (live deployment)

## Deployment Manifest

| Contract | Address | Purpose |
| --- | --- | --- |
| StrategyRegistry | `0x531eC789d3627bF3fd511010791C1EfFc63c2DA6` | Stores owner-declared strategy constraints and enforces a per-UTC-day rebalance budget. |
| ProofVerifier | `0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8` | Binds warrants to (strategyId, proposalHash, executionHash) and exposes the single-use consume gate. |
| AttestationVerifier | `0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2` | ECDSA attestation verifier plugged into ProofVerifier. Accepts warrants signed by the authorized scout wallet. |
| LiquidityVault | `0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC` | Holds owner capital. Recomputes executionHash on-chain from the RebalanceAction struct before consuming a warrant. |
| RewardSplitter | `0x81AdD46B05407146B049116C66eDF2B879eCc06e` | Access-controlled epoch recorder. Enforces scoutReward + executorReward + treasuryReward ≤ grossFees. |

## Agent Wallets

| Agent | Address | Role |
| --- | --- | --- |
| Owner Wallet | `0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061` | Creates strategies and owns the vault policy. |
| Scout Agent Wallet | `0x86b0E1c48d39D58304939c0681818F0E1c1e8d83` | Observes pool state and submits proof-backed rebalance proposals. |
| Executor Agent Wallet | `0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9` | Verifies proof status and executes vault actions. |
| Treasury Agent Wallet | `0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0` | Records fee growth and reward epochs for the strategy. |

## End-to-end Verification on X Layer Mainnet

Full warrant lifecycle executed by `pnpm tsx scripts/run-happy-path.ts` at block 57449597 on chainId 196. Pool USD₮0 / xETH 0.05% (`0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc`). Strategy #3, vault #3, proofId `0x3043df43f567248a4cd3a561d54bc6ab2fa4248c7a14d59dc2ca633d5911e158`.

| Step | Actor | tx hash |
| --- | --- | --- |
| `StrategyRegistry.createStrategy` | Owner | [`0x16d759234fbc7080…`](https://www.okx.com/web3/explorer/xlayer/tx/0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465) |
| `LiquidityVault.createVault` | Owner | [`0xeda72f9fc66d6787…`](https://www.okx.com/web3/explorer/xlayer/tx/0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8) |
| `ProofVerifier.submitProof` | Scout | [`0x0b2e7e29e00bcdfb…`](https://www.okx.com/web3/explorer/xlayer/tx/0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f) |
| `LiquidityVault.executeRebalance` | Executor | [`0x475e0e22c55a22d1…`](https://www.okx.com/web3/explorer/xlayer/tx/0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800) |
| `RewardSplitter.recordEpoch` | Treasury | [`0x9afdacf816a50c86…`](https://www.okx.com/web3/explorer/xlayer/tx/0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520) |

Verified facts (from this run):

- Pool tick: 198759, price 2335.659122 USD₮0 per xETH
- Proposed range: [198570, 198940]
- proposalHash: `0x654f99d32acdb1ff443fe40949a54c9b77c281ba5e05cde8b61a02f8570a9bae`
- executionHash: `0x2c442aedda153893b8ed7bf6ff04748fa213fa5141749896c16f463be65606f3`
- Warrant consumed: isVerified flipped true → false after executeRebalance
- Daily budget decremented: remainingRebalancesToday 2 → 1
- Gas used for executeRebalance: 74,379
- Epoch #2 recorded via TreasuryAgent with split scout=300/executor=300/treasury=400/retained=0 (of grossFees=1000)

Skill modules exercised end-to-end:

- uniswap-v3-pool (6 view methods)
- uniswap-quoter-v2 (quoteExactInputSingle)
- uniswap-tick-lens (word 77, 6 initialized ticks)
- uniswap-v3-factory (canonical pool match = true)
- uniswap-nfpm (balance=0, fresh-mint path)
- uniswap-swap-router-02 (staticCall revert = expected without allowance)

## Proof Packet Snapshot

| Field | Value |
| --- | --- |
| proofId | `proof_0x91af...b17d` |
| strategyId | `1` |
| strategyHash | `0x14bd...1f2a` |
| proposalHash | `0xa912...4ef0` |
| executionHash | `0x5e08...7b11` |
| publicInputsHash | `0x7cd1...22ab` |
| allowedPool | `WETH / USDC` |
| riskLevel | `Medium` |
| maxRebalancesPerDay | `2` |
| remainingAfterMove | `1` |
| verifierStatus | `Accepted` |
| verifierBackend | `embedded-demo-mode` |
| consumed | `false` |

## Integration Notes

### Uniswap Skills (6 modules)

Every Scout proposal exercises six canonical Uniswap v3 periphery modules: UniswapV3Pool (slot0, liquidity, token0/1, fee, tickSpacing), QuoterV2 (quoteExactInputSingle), TickLens (getPopulatedTicksInWord), V3Factory (getPool canonical-address check), NonfungiblePositionManager (balanceOf + positions inventory), and SwapRouter02 (exactInputSingle static-call). Source: lib/uniswap/* + app/api/scout/propose/route.ts.

### Onchain OS Skill — okx-dex-swap

HMAC-signed calls to the OKX DEX Aggregator (/api/v5/dex/aggregator/quote) from lib/okx/dex-aggregator.ts, surfaced to the Scout flow and to a standalone /api/okx/quote route. This is the okx-dex-swap Skill from the okx/onchainos-skills package, giving warrants cross-venue best-route quotes (not just Uniswap-only).

### Onchain OS orchestration layer

Four role-separated agent wallets (Owner, Scout, Executor, Treasury) share state through StrategyRegistry + ProofVerifier + LiquidityVault + RewardSplitter. Scout signs warrants, Executor is the only caller on LiquidityVault.executeRebalance, Treasury listens to RebalanceExecuted events and calls RewardSplitter.recordEpoch via the production TreasuryAgent class (agents/treasury-agent.ts).

## Artifact Inventory

| Artifact | Path | Status |
| --- | --- | --- |
| StrategyRegistry artifact | `artifacts/contracts/StrategyRegistry.sol/StrategyRegistry.json` | Ready |
| ProofVerifier artifact | `artifacts/contracts/ProofVerifier.sol/ProofVerifier.json` | Ready |
| LiquidityVault artifact | `artifacts/contracts/LiquidityVault.sol/LiquidityVault.json` | Ready |
| RewardSplitter artifact | `artifacts/contracts/RewardSplitter.sol/RewardSplitter.json` | Ready |
| Deployment manifest template | `deployments/xlayer-template.json` | Ready |
| Sample proof packet | `proofs/sample-proof-packet.json` | Ready |

## Team

| Field | Value |
| --- | --- |
| Team name | X Builder |
| Builder 1 | X Builder |
| Builder 2 | — |

## Submission Links

| Field | Value |
| --- | --- |
| Demo video | TBD_VIDEO_LINK |
| GitHub repo | TBD_GITHUB_LINK |
| X or Moltbook post | TBD_SOCIAL_LINK |

## Google Form Copy

### Project name

Warrant — Proof-gated Liquidity Agents on X Layer

### One-line description

Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.

### Project intro

Warrant helps owners delegate Uniswap concentrated liquidity management to AI agents without giving them blind authority. The owner defines a strategy once, the Scout Agent proposes a move, the verifier binds the proof to the exact execution parameters, and only then can the Executor Agent touch the LiquidityVault.

### Architecture overview

Owner strategy compiled from natural language -> StrategyRegistry stores guardrails and per-day budgets -> Scout Agent proposes a rebalance and commits both a proposalHash and an executionHash -> ProofVerifier validates the warrant packet and binds it to the strategy id + execution hash -> LiquidityVault recomputes the execution hash on-chain from the RebalanceAction struct and consumes the warrant once -> Treasury Agent records the reward epoch via access-controlled RewardSplitter.

### Onchain OS / Uniswap usage

Every Scout proposal exercises 7 Skill modules (12 live calls): six Uniswap v3 periphery contracts (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02) for live pool state + execution-path simulation, and the Onchain OS okx-dex-swap Skill for HMAC-signed DEX Aggregator cross-venue quotes. Orchestrated across four role-separated agent wallets (Owner, Scout, Executor, Treasury) via the StrategyRegistry → ProofVerifier → LiquidityVault → RewardSplitter pipeline.

### X Layer positioning

Warrant is designed as a native X Layer agentic DeFi application. It depends on low-friction onchain coordination, observable agent behavior, and warrant-backed execution traces that are easy for judges to inspect.

### Demo flow

Compile strategy -> Generate scout proposal -> Verify warrant -> Execute rebalance -> Show reward epoch -> Show blocked move.

## Readiness Tasks

| Task | Status | Note |
| --- | --- | --- |
| Interactive terminal flow | Done | Owners can drive create, verify, execute, hold, reset, and the Live Scout flow (real Uniswap v3 read against X Layer) from a single terminal surface. |
| Submission-ready README | Done | README includes product intro, architecture, Skill integration details, operation mechanism, team placeholders, and X Layer positioning. |
| Contract compile and deploy scripts | Done | Local compile/deploy scripts + invariant test suite + agent wallet generator all in place. |
| Real verifier implementation | Done | AttestationVerifier.sol ships as the default IZkVerifier implementation. Accepts ECDSA signatures from a pre-authorized scout signer over (strategyId, proposalHash, executionHash). Swappable for a zk-SNARK verifier via ProofVerifier.setVerifier. |
| Uniswap Skill integration — 6 modules | Done | lib/uniswap/* wires six Uniswap v3 periphery contracts (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02). Every Scout proposal via /api/scout/propose exercises all six in a single pass, returning a skillCalls log. Live-tested against X Layer mainnet (USD₮0/xETH 0.05%). |
| Onchain OS Skill integration — okx-dex-swap | Done | lib/okx/dex-aggregator.ts + /api/okx/quote wire the okx-dex-swap Skill from okx/onchainos-skills via HMAC-SHA256 signed REST calls to /api/v5/dex/aggregator/quote. The HMAC auth path is fully implemented; it degrades gracefully to a structured 'unconfigured' response when OKX credentials are absent. |
| Production Treasury Agent | Done | agents/treasury-agent.ts ships a real class with settleEpochOnchain (broadcasts RewardSplitter.recordEpoch) and watchAndSettle (subscribes to RebalanceExecuted events). Exercised end-to-end in scripts/run-happy-path.ts. |
| Real X Layer deployment addresses | Done | Deployed to X Layer mainnet (chainId 196) on 2026-04-12. StrategyRegistry 0x531eC789, ProofVerifier 0xe157673b, AttestationVerifier 0x9c0AC1C1, LiquidityVault 0xbFFc45c9, RewardSplitter 0x81AdD46B. Manifest: deployments/xlayer-196.json. |
| Demo and social links | Pending | Video link and X or Moltbook link are still placeholders and must be recorded before submission. |

## Checklist

- Public GitHub repo
- README with intro, architecture, deployment info, integrations, mechanism, team, and X Layer fit
- Agent wallet identities documented
- X Layer deployment addresses filled in
- Demo video link
- X or Moltbook post link

## Useful Commands

- `pnpm build` — Generates the production-ready Next.js build judges can reproduce locally.
- `pnpm contracts:compile` — Refreshes artifacts for StrategyRegistry, ProofVerifier, LiquidityVault, and RewardSplitter.
- `pnpm submission:bundle` — Generates markdown and JSON packets under submission/ for the Google Form and repo handoff.
- `pnpm submission:check` — Flags remaining placeholders, missing deployment files, and still-pending live submission items.

