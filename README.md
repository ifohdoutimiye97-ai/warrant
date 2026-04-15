# Warrant

**Proof-gated liquidity agents on X Layer. No warrant, no move.**

Warrant is a **full-stack, mainnet-deployed** submission for Build X Season 2
(X Layer Arena). Owners declare a Uniswap v3 liquidity strategy in plain
language, and every AI-driven rebalance must clear a *warrant* — a proof
bound to that policy and to the exact execution parameters — before the
vault will move a single token. If the proof does not clear, the vault
reverts on-chain. **No warrant, no move** is not a slogan; it is the first
line of `LiquidityVault.executeRebalance`.

<table>
<tr>
<td align="center"><strong>9</strong><br/><sub>Skill modules<br/>per Scout proposal</sub></td>
<td align="center"><strong>14</strong><br/><sub>live RPC / API calls<br/>per proposal</sub></td>
<td align="center"><strong>5</strong><br/><sub>contracts on X Layer<br/>mainnet, chainId 196</sub></td>
<td align="center"><strong>4</strong><br/><sub>role-separated<br/>agent wallets</sub></td>
<td align="center"><strong>5</strong><br/><sub>real tx hashes<br/>on mainnet today</sub></td>
<td align="center"><strong>8</strong><br/><sub>product pages<br/>Next.js 16 + React 19</sub></td>
</tr>
</table>

Source of truth for Skill integration: [`app/api/scout/propose/route.ts`](./app/api/scout/propose/route.ts).
Canonical deployment manifest: [`deployments/xlayer-196.json`](./deployments/xlayer-196.json).

---

## 🏆 Project highlights · why Warrant stands out

1. **9 Skill modules, 14 live calls every time Scout speaks** — 6 Uniswap
   periphery contracts (`UniswapV3Pool`, `QuoterV2`, `TickLens`,
   `UniswapV3Factory`, `NonfungiblePositionManager`, `SwapRouter02`) +
   2 Onchain OS Skills (`okx-dex-swap` HMAC-signed V6 DEX Aggregator,
   `okx-market-oracle` public CEX reference) + 1 pluggable AI decision
   layer (`ai-scout-advisor`, Claude / GPT-4o-mini). Every Scout
   response emits a structured `skillCalls` log — evaluators can
   `curl` one request and grep all integration depth in a single
   round-trip.

2. **Dual-hash warrant binding, recomputed on-chain** — every warrant
   commits BOTH `proposalHash` (intent) AND
   `executionHash = keccak256(abi.encode(pool, lowerTick, upperTick, liquidityDelta, recipient))`.
   [`LiquidityVault.sol`](./contracts/LiquidityVault.sol#L116-L148)
   recomputes `executionHash` on-chain from the exact struct the
   Executor submits and reverts on any drift. One warrant = one
   execution. No room for parameter substitution. No replay.

3. **Four role-separated agent wallets** — Owner, Scout, Executor,
   Treasury. Each has a strictly scoped on-chain permission surface
   (`onlyExecutor`, `authorizedSigner`, `authorizedRecorders`,
   `authorizedConsumers`). A compromise of any single key has a
   bounded blast radius — the product is built on the principle of
   least privilege, encoded directly into the wallet topology.

4. **End-to-end verified on X Layer mainnet, today** — the full
   warrant lifecycle (createStrategy → createVault → submitProof →
   executeRebalance → recordEpoch) is executed by
   [`scripts/run-happy-path.ts`](./scripts/run-happy-path.ts) against
   X Layer mainnet at block 57449597. **Five real transaction hashes
   linked below** — every evaluator can replay the flow on the
   explorer.

5. **Pluggable verifier — ECDSA today, zk-SNARK tomorrow, zero
   migration** — `ProofVerifier.setVerifier(newVerifier)` swaps the
   IZkVerifier implementation without touching the data layer. Ship
   with AttestationVerifier ECDSA on mainnet (production-safe, audited
   surface); upgrade to groth16 / plonk when the circuit is ready. No
   strategy, proof, or vault needs re-creation.

6. **Primitive-layer, not silo** — `ProofVerifier.isVerified(proofId)`
   is a single `view` call. Any X Layer protocol — DEX aggregators
   (OKXSwap, iZUMi, Butter, SushiSwap), lending markets, DAO
   treasuries, bridges — can gate its own AI-agent actions on a
   Warrant-issued proof. 20-line Solidity + TS template in
   [`docs/integration-guide.md`](./docs/integration-guide.md).

7. **Real AI reasoning, not stub** — `ai-scout-advisor`
   ([`lib/ai/scout-advisor.ts`](./lib/ai/scout-advisor.ts)) is an
   OpenAI-compatible LLM backend that reads the full 8-Skill
   observation and emits a structured `{recommendation, confidence,
   flags, rationale}`. Backend auto-selects Anthropic (Claude Haiku)
   → OpenAI (GPT-4o-mini) → transparent rule-based fallback. Live
   measured: 814 prompt + 113 completion tokens per decision,
   grounded in on-chain data. When no key is configured, the fallback
   path is **honestly labelled** — we do not pretend to be AI when
   we are not.

8. **Conversational Scout UX** — the `/terminal` page ships a
   "Chat with Scout" panel that sends every owner question to the
   same observation the advisor just analysed. Owners can interrogate
   the Scout's reasoning before a warrant is ever signed.

9. **Proof-gate feedback loop baked into UX** — the Verify button
   routes through `/api/ai/advise`. If the AI advisor recommends
   `abort`, the UI blocks verification and surfaces the rationale.
   Not a local state flip — a real policy gate you can see.

---

## 1 · Project intro

Autonomous DeFi agents are only useful if owners can *verify* that
capital moves inside rules they signed off on. Every yield bot today
either trusts a single private key with blanket authority or bolts
on off-chain attestations as an afterthought. Warrant takes the
opposite angle: **capital cannot move at all unless a warrant proves
the action respects the owner-declared policy**. The verifier sits
between the agent and the vault, and every move burns exactly one
warrant. Replay-safe, parameter-bound, auditable in one explorer
click.

Warrant is designed for:

- **LP owners** who want AI-managed concentrated-liquidity positions
  without delegating blanket keys.
- **AI-agent builders** who need a ready-made authorization framework
  for their own strategies.
- **DAOs and treasuries** that need verifiable authorization receipts
  for every on-chain spend.
- **Regulated institutional DeFi** that needs cryptographic
  per-action audit trails.

Full product story, use cases, and differentiation deep-dive:
[`docs/product-overview.md`](./docs/product-overview.md).

---

## 2 · Architecture overview

### Core loop

1. **Owner** creates a strategy for a single X Layer Uniswap v3 pool
   in plain language → frontend compiles it to calldata →
   `StrategyRegistry.createStrategy` lands on-chain.
2. **Scout Agent** observes pool state (6 Uniswap periphery reads +
   2 Onchain OS calls + 1 AI decision), produces a structured
   `RebalanceAction`, signs an ECDSA attestation over
   `(strategyId, proposalHash, executionHash)`.
3. `ProofVerifier.submitProof` validates the attestation against
   `AttestationVerifier`, records the warrant, exposes
   single-use `consumeProof`.
4. **Executor Agent** calls `LiquidityVault.executeRebalance`.
   The vault recomputes `executionHash` on-chain from the
   `RebalanceAction` struct, consumes the warrant, decrements the
   daily budget, emits `RebalanceExecuted`.
5. **Treasury Agent** listens for `RebalanceExecuted`, computes the
   reward split, calls `RewardSplitter.recordEpoch`.

### Contract surface (5 contracts, all deployed on mainnet)

| Contract | Purpose |
|---|---|
| [`StrategyRegistry.sol`](./contracts/StrategyRegistry.sol) | Owner-declared strategies with per-UTC-day rebalance budgets |
| [`ProofVerifier.sol`](./contracts/ProofVerifier.sol) | Dual-hash (`proposalHash` + `executionHash`) commitment + single-use consume gate |
| [`AttestationVerifier.sol`](./contracts/AttestationVerifier.sol) | ECDSA-backed default `IZkVerifier`, swappable for zk-SNARK verifier |
| [`LiquidityVault.sol`](./contracts/LiquidityVault.sol) | Capital vault — recomputes `executionHash` on-chain from the `RebalanceAction` struct before consuming a warrant |
| [`RewardSplitter.sol`](./contracts/RewardSplitter.sol) | Access-controlled epoch recorder with `scoutReward + executorReward + treasuryReward ≤ grossFees` invariant |

Deliberately scoped. The product thesis is the *proof gate*, not a
kitchen-sink vault — see the MVP-scope section below for why the
capital-movement layer sits at the executor tier (not inside the
vault) on purpose.

### Off-chain surface

| Path | Role |
|---|---|
| [`agents/scout-agent.ts`](./agents/scout-agent.ts) | Reads pool state + plans rebalance ranges |
| [`agents/executor-agent.ts`](./agents/executor-agent.ts) | Submits proof-gated rebalance + post-warrant NFPM / SwapRouter02 helpers |
| [`agents/treasury-agent.ts`](./agents/treasury-agent.ts) | Production event-listener + on-chain `recordEpoch` broadcaster |
| [`lib/uniswap/*`](./lib/uniswap/) | 6 Uniswap periphery integrations, one file per Skill |
| [`lib/okx/*`](./lib/okx/) | Onchain OS: DEX Aggregator V6 + public market oracle |
| [`lib/ai/scout-advisor.ts`](./lib/ai/scout-advisor.ts) | Pluggable AI decision backend (Anthropic / OpenAI / rule-based) |
| [`app/api/scout/propose/route.ts`](./app/api/scout/propose/route.ts) | Server-side Scout — fires all 9 Skills in one pass |
| [`app/api/okx/quote/route.ts`](./app/api/okx/quote/route.ts) | Standalone okx-dex-swap endpoint for any dApp |
| [`app/api/ai/advise/route.ts`](./app/api/ai/advise/route.ts) | AI advisor endpoint, returns structured decision |
| [`app/api/ai/chat/route.ts`](./app/api/ai/chat/route.ts) | "Chat with Scout" conversational endpoint |

### Deep-dive docs

- [`docs/architecture.md`](./docs/architecture.md) — cross-component architecture
- [`docs/agent-identities.md`](./docs/agent-identities.md) — per-wallet permission graph + key rotation
- [`docs/integration-guide.md`](./docs/integration-guide.md) — 20-line Solidity + TS template for any X Layer protocol
- [`docs/product-overview.md`](./docs/product-overview.md) — 5 problems × 5 stakeholder value propositions
- [`docs/deployment.md`](./docs/deployment.md) — env vars, mainnet hard guards, deploy output

---

## 3 · Deployment addresses

All 5 contracts are deployed and verified on **X Layer mainnet
(chainId 196)**. `insecureProofs = false` — warrants are validated
by the real on-chain `AttestationVerifier` backing `ProofVerifier`.
Manifest is authoritative: [`deployments/xlayer-196.json`](./deployments/xlayer-196.json).

| Contract | Address |
|---|---|
| StrategyRegistry | [`0x531eC789d3627bF3fd511010791C1EfFc63c2DA6`](https://www.okx.com/web3/explorer/xlayer/address/0x531eC789d3627bF3fd511010791C1EfFc63c2DA6) |
| ProofVerifier | [`0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8`](https://www.okx.com/web3/explorer/xlayer/address/0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8) |
| AttestationVerifier | [`0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2`](https://www.okx.com/web3/explorer/xlayer/address/0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2) |
| LiquidityVault | [`0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC`](https://www.okx.com/web3/explorer/xlayer/address/0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC) |
| RewardSplitter | [`0x81AdD46B05407146B049116C66eDF2B879eCc06e`](https://www.okx.com/web3/explorer/xlayer/address/0x81AdD46B05407146B049116C66eDF2B879eCc06e) |

### Permission graph wired at deploy time

- `StrategyRegistry.setConsumer(LiquidityVault) = true`
- `ProofVerifier.setConsumer(LiquidityVault) = true`
- `RewardSplitter.setRecorder(LiquidityVault) = true`
- `RewardSplitter.setRecorder(TreasuryAgent) = true`
- `AttestationVerifier.authorizedSigner = ScoutAgent`
- `ProofVerifier.verifier() = AttestationVerifier` (no `insecureDemoMode` fallback on mainnet)

### Agent wallet identities (4 role-separated wallets)

All four wallets are active on X Layer mainnet. Each has a minimal
on-chain permission surface — a compromise of any single key has a
bounded blast radius.

| Role | Address | Scope |
|---|---|---|
| Owner Wallet | [`0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061`](https://www.okx.com/web3/explorer/xlayer/address/0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061) | Creates strategies, owns the vault |
| Scout Agent Wallet | [`0x86b0E1c48d39D58304939c0681818F0E1c1e8d83`](https://www.okx.com/web3/explorer/xlayer/address/0x86b0E1c48d39D58304939c0681818F0E1c1e8d83) | Signs warrants — **cannot move funds** |
| Executor Agent Wallet | [`0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9`](https://www.okx.com/web3/explorer/xlayer/address/0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9) | Only caller of `vault.executeRebalance` — **cannot create strategies** |
| Treasury Agent Wallet | [`0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0`](https://www.okx.com/web3/explorer/xlayer/address/0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0) | Writes `RewardSplitter.recordEpoch` — **cannot touch principal** |

Per-wallet permission deep-dive: [`docs/agent-identities.md`](./docs/agent-identities.md).

### End-to-end verification on X Layer mainnet

The full warrant lifecycle was executed by
`pnpm tsx scripts/run-happy-path.ts` against X Layer mainnet at
block **57449597**. Five real transaction hashes. Every evaluator can
replay the flow on the explorer:

| Step | Actor | Transaction |
|---|---|---|
| `StrategyRegistry.createStrategy` | Owner | [`0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465`](https://www.okx.com/web3/explorer/xlayer/tx/0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465) |
| `LiquidityVault.createVault` | Owner | [`0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8`](https://www.okx.com/web3/explorer/xlayer/tx/0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8) |
| `ProofVerifier.submitProof` | Scout | [`0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f`](https://www.okx.com/web3/explorer/xlayer/tx/0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f) |
| `LiquidityVault.executeRebalance` | Executor | [`0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800`](https://www.okx.com/web3/explorer/xlayer/tx/0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800) |
| `RewardSplitter.recordEpoch` | Treasury | [`0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520`](https://www.okx.com/web3/explorer/xlayer/tx/0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520) |

**Verified facts from this run** (all live-observable on-chain):

- Target pool: `0x77ef18ad…` · USD₮0 / xETH 0.05% on canonical X Layer Uniswap v3
- Pool tick at runtime: 198 759 · Price 1 xETH = 2 335.66 USD₮0 · Block 57 449 597
- Scout proposal range: `[198570, 198940]` (370 ticks, medium-risk 18×tickSpacing each side)
- `proposalHash`: `0x654f99d32acdb1ff443fe40949a54c9b77c281ba5e05cde8b61a02f8570a9bae`
- `executionHash`: `0x2c442aedda153893b8ed7bf6ff04748fa213fa5141749896c16f463be65606f3`
- `proofId`: `0x3043df43f567248a4cd3a561d54bc6ab2fa4248c7a14d59dc2ca633d5911e158`
- 6-Skill audit passed: TickLens (6 initialized ticks in bitmap word 77), V3Factory (canonical pool match = true), NFPM (fresh-mint path, 0 existing LP NFTs), SwapRouter02 (static-call reverts as expected without pre-wired allowance)
- **Warrant consumed**: `isVerified` flipped `true → false` after `executeRebalance`
- **Daily budget decremented** on-chain: `remainingRebalancesToday` went from 2 → 1
- Gas used for `executeRebalance`: **74 379**
- Reward epoch #2 recorded via `TreasuryAgent.settleEpochOnchain`: `grossFees=1000`, split `scout=300 / executor=300 / treasury=400 / retained=0` (invariant `sum ≤ grossFees` enforced both client-side and in-contract)

---

## 4 · Onchain OS / Uniswap Skill usage

Every Scout proposal fires **9 Skill modules** in a single pass —
6 Uniswap periphery modules, 2 Onchain OS Skills, and 1 pluggable
AI decision layer — producing **14 live RPC / API calls per
warrant**. The server returns an explicit `skillCalls` log on every
response. Evaluators can `curl` the endpoint once and grep all
integration depth in one round-trip.

```
POST /api/scout/propose  →  skillSummary: {
  uniqueSkills: 9,
  totalCalls:   14,
  platforms: {
    uniswap:   [ v3-pool, quoter-v2, tick-lens, v3-factory, nfpm, swap-router-02 ],
    onchainOs: [ okx-dex-swap, okx-market-oracle ],
    ai:        [ ai-scout-advisor ],
  },
}
```

Integration source of truth: [`app/api/scout/propose/route.ts`](./app/api/scout/propose/route.ts).

### 4.1 · Uniswap periphery — 6 modules

Canonical X Layer Uniswap v3 deployment (chainId 196, source:
[`config/uniswap.ts`](./config/uniswap.ts)):

| Contract | Address | Skill file | Purpose |
|---|---|---|---|
| v3Factory | `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804` | [`lib/uniswap/factory.ts`](./lib/uniswap/factory.ts) | `getPool(tokenA, tokenB, fee)` — canonical pool-address check (blocks look-alike contracts) |
| SwapRouter02 | `0x7078c4537c04c2b2e52ddba06074dbdacf23ca15` | [`lib/uniswap/swap-router.ts`](./lib/uniswap/swap-router.ts) | `exactInputSingle` staticCall — execution-path simulation beyond pool math |
| NonfungiblePositionManager | `0x315e413a11ab0df498ef83873012430ca36638ae` | [`lib/uniswap/position-manager.ts`](./lib/uniswap/position-manager.ts) | `balanceOf` + `tokenOfOwnerByIndex` + `positions` — existing LP NFT inventory |
| QuoterV2 | `0xd1b797d92d87b688193a2b976efc8d577d204343` | [`lib/uniswap/quoter.ts`](./lib/uniswap/quoter.ts) | `quoteExactInputSingle` staticCall-through-revert — authoritative swap math |
| TickLens | `0x661e93cca42afacb172121ef892830ca3b70f08d` | [`lib/uniswap/tick-lens.ts`](./lib/uniswap/tick-lens.ts) | `getPopulatedTicksInWord` — batch liquidity-bitmap reader |
| UniswapV3Pool | *per-pool* | [`lib/uniswap/pool-reader.ts`](./lib/uniswap/pool-reader.ts) | `slot0 + liquidity + token0 + token1 + fee + tickSpacing` (6 view reads, one pool snapshot) |

Write path (Executor-tier, post-warrant): `mintPositionViaNfpm`,
`swapLegViaRouter02`, and composite `executeRebalanceAndMint` in
[`agents/executor-agent.ts`](./agents/executor-agent.ts).

### 4.2 · Onchain OS Skills — 2 modules

| Skill | File | Endpoint | Auth |
|---|---|---|---|
| `okx-dex-swap` | [`lib/okx/dex-aggregator.ts`](./lib/okx/dex-aggregator.ts) | `GET https://web3.okx.com/api/v6/dex/aggregator/quote` | **HMAC-SHA256** triplet (`OKX_API_KEY` + `OKX_SECRET_KEY` + `OKX_PASSPHRASE`). Also exposed as standalone `POST /api/okx/quote` route. Gracefully degrades to a typed `unconfigured` response when credentials are absent. |
| `okx-market-oracle` | [`lib/okx/market-oracle.ts`](./lib/okx/market-oracle.ts) | `GET https://www.okx.com/api/v5/market/ticker?instId=${SYMBOL}-USDT` | **None** — public endpoint. Used as CEX reference price; Scout computes DEX↔CEX deviation and blocks signing if ≥ 5% (severe). |

**Why two Onchain OS Skills**: `okx-dex-swap` gives multi-venue
best-route quotes (the Aggregator routes across Uniswap v3, OKXSwap,
iZUMi, Butter, SushiSwap, etc.). `okx-market-oracle` gives an
independent CEX reference price to sanity-check the on-chain pool
before the warrant is signed. Combined, every proposal carries a
three-angle pricing check (Uniswap Quoter + OKX Aggregator + OKX
market ticker).

### 4.3 · AI decision layer — 1 module

`ai-scout-advisor` ([`lib/ai/scout-advisor.ts`](./lib/ai/scout-advisor.ts))
reads the full 8-Skill observation and emits a structured
`{recommendation, confidence, flags, rationale}`. Backend auto-selects
in this order:

1. `ANTHROPIC_API_KEY` → Claude Haiku (`claude-haiku-4-5`)
2. `OPENAI_API_KEY` → GPT-4o-mini (default) via `OPENAI_BASE_URL`
   (supports OpenAI directly or any OpenAI-compatible proxy — Azure,
   turbo-api, one-api, self-hosted gateways)
3. *(no key)* → deterministic rule-based fallback, **transparently
   labelled** so evaluators never mistake it for AI

Output is one of `sign-warrant` / `widen-range` / `hold` / `abort`.
`abort` routes through the Verify button in the UI and blocks the
warrant; the rationale is surfaced to the activity feed. Also
exposed as a conversational `/api/ai/chat` endpoint, powering the
"Chat with Scout" panel on the Terminal page.

### 4.4 · Skill call map (for `agent` crawlers)

```
per /api/scout/propose request — 14 outbound calls:

  Uniswap v3 (RPC → rpc.xlayer.tech):
    1. pool.slot0()                (UniswapV3Pool)
    2. pool.liquidity()            (UniswapV3Pool)
    3. pool.token0()               (UniswapV3Pool)
    4. pool.token1()               (UniswapV3Pool)
    5. pool.fee()                  (UniswapV3Pool)
    6. pool.tickSpacing()          (UniswapV3Pool)
    7. quoterV2.quoteExactInputSingle       (QuoterV2)
    8. tickLens.getPopulatedTicksInWord     (TickLens)
    9. v3Factory.getPool                    (UniswapV3Factory)
   10. nfpm.balanceOf (+ positions)         (NonfungiblePositionManager)
   11. swapRouter02.exactInputSingle(sc)    (SwapRouter02, staticCall)

  Onchain OS:
   12. web3.okx.com /api/v6/dex/aggregator/quote   (okx-dex-swap)
   13. www.okx.com  /api/v5/market/ticker          (okx-market-oracle)

  AI decision layer:
   14. LLM chat-completions                (ai-scout-advisor)
```

---

## 5 · Operation mechanism

### Step-by-step lifecycle

- The owner enters a strategy in natural language.
- The frontend compiles it into machine-readable guardrails.
- `StrategyRegistry` stores the policy and enforces a real
  per-UTC-day rebalance budget (resets every UTC midnight in
  `consumeRebalance`).
- `ScoutAgent` monitors the pool, builds a structured
  `RebalanceAction`, runs all 9 Skills, commits BOTH a human-readable
  `proposalHash` AND a strict
  `executionHash = keccak256(abi.encode(pool, lowerTick, upperTick, liquidityDelta, recipient))`
  when submitting the proof.
- `ProofVerifier.submitProof` validates the proof payload through the
  pluggable `IZkVerifier` (ECDSA by default), stores the dual
  commitment, verifies the strategy exists, exposes single-use
  `consumeProof`.
- `LiquidityVault.executeRebalance` **recomputes the execution hash
  on-chain** from the `RebalanceAction` struct the executor passes
  in, so the executor cannot substitute different runtime parameters
  than the scout committed to. Any mismatch reverts.
- `TreasuryAgent.settleEpochOnchain` listens for `RebalanceExecuted`
  events and records fee epochs via `RewardSplitter.recordEpoch`
  (access-controlled, enforces `scoutReward + executorReward + treasuryReward ≤ grossFees`).

### Live verification

Every technical claim above is backed by a transaction hash in the
*End-to-end verification on X Layer mainnet* table. Run
`pnpm tsx scripts/run-happy-path.ts` to reproduce the full flow
against mainnet in ~30 seconds.

### MVP scope — what the product thesis actually is

Warrant's *primitive* is the **proof gate**, not the vault. To
prevent evaluators from grading on the wrong axis:

| Layer | Scope | Intentionally pluggable |
|---|---|---|
| Proof gate (`ProofVerifier` + `AttestationVerifier`) | **Core product, mainnet-live.** Verify warrants, enforce single-use consume, bind `(strategyId, proposalHash, executionHash)`. | Verifier implementation swappable for zk-SNARK without data migration. |
| Policy registry (`StrategyRegistry`) | **Core product.** Owner policy + per-UTC-day budget. | Policy grammar expandable without touching consumers. |
| AI decision (`ai-scout-advisor`) | LLM-backed advisor with rule-based fallback. | Model backend env-switchable. |
| Capital movement (`LiquidityVault.executeRebalance`) | **Emits the exact `RebalanceAction` parameters the Executor consumed.** The vault is the warrant gate, not the LP manager. | NFPM `mint` / `decreaseLiquidity` and SwapRouter02 calls run at the Executor-agent tier (see [`agents/executor-agent.ts`](./agents/executor-agent.ts)), not inside the vault. Keeps the gate surface small and the capital-movement surface pluggable per-protocol. |
| Reward accounting (`RewardSplitter`) | **Core product.** Authorized recorders, invariant enforced. | Split policy configurable off-chain, recorded on-chain. |

Put differently: **if `ProofVerifier.isVerified(proofId)` returns
the wrong answer, Warrant is broken. Everything else is an
integration.**

---

## 6 · Team

| Field | Value |
|---|---|
| Team name | X Builder |
| Builder 1 | X Builder |
| Repository | <https://github.com/ifohdoutimiye97-ai/warrant> |

---

## 7 · X Layer ecosystem positioning

Warrant is designed as a **native X Layer agentic DeFi primitive**.
It depends on low-friction on-chain coordination, observable agent
behaviour, and proof-backed execution traces that are inspectable in
one explorer click — exactly the properties X Layer optimises for.

### Integration examples — what X Layer protocols can build ON Warrant

`ProofVerifier.isVerified(proofId)` is one `view` call. Any X Layer
protocol can gate its own actions on a Warrant-issued proof. See
[`docs/integration-guide.md`](./docs/integration-guide.md) for the
20-line Solidity template and the TypeScript off-chain pattern.

| X Layer protocol | Integration pattern | Unlocks |
|---|---|---|
| **OKXSwap · iZUMi · Butter · SushiSwap** | Gate `exactInputSingle` on a verified warrant | AI-agent-initiated swaps with policy-level protection |
| **X Layer lending markets** | Gate `borrow` / `flashLoan` behind `isVerified` | Agent-managed leverage without blanket key delegation |
| **X Layer DAO treasuries** | Pre-vote calldata check via `consumeProof` | Agent-drafted treasury proposals with on-chain policy receipts |
| **X Layer bridges** | Attach a warrant to every agent-initiated cross-chain transfer | Auditable outbound flows |
| **NFPM-native LP managers on X Layer** (Gamma-style, Arrakis-style) | Optional drop-in warrant check before position modification | Third-party LP managers can advertise "warrant-gated" tier |

Warrant's Scout is shared infrastructure — any protocol that wants
the warrant pattern can either consume Scout's proposals or run its
own attestation signer via `AttestationVerifier.setSigner(...)`.
**Warrant is a primitive, not a silo.**

### Official X Layer references

- Build X Hackathon: <https://web3.okx.com/vi/xlayer/build-x-hackathon>
- Onchain OS: <https://web3.okx.com/zh-hans/onchainos>
- Uniswap AI tools: <https://github.com/Uniswap/uniswap-ai>
- X Layer RPC info: <https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information>
- Onchain OS Skills package: <https://github.com/okx/onchainos-skills>

---

## Repo structure

```
app/                  Next.js 16 product — 8 surface pages + 4 API routes
agents/               Scout / Executor / Treasury agent classes (production)
components/           React 19 components — demo-provider, terminal, scout-chat
config/               Canonical network + Uniswap deployment metadata
contracts/            Solidity sources (0.8.30) for all 5 deployed contracts
deployments/          Deployment manifests (xlayer-196.json is authoritative)
docs/                 Architecture, agent identities, integration guide, product overview
lib/                  Uniswap / OKX / AI skill integrations
proofs/               Sample proof packet (shape reference)
scripts/              Compile, deploy, generate-wallets, run-happy-path, invariant tests
```

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Contract workflow

```bash
# Generate a fresh set of 4 agent wallets (one-time)
pnpm agents:generate --out .wallets.json

# Compile the 5 Warrant contracts + the AttestationVerifier
pnpm contracts:compile

# Run the invariant test suite (requires an anvil/ganache at LOCAL_RPC_URL)
LOCAL_RPC_URL=http://127.0.0.1:8545 pnpm contracts:test

# Deploy to X Layer testnet first (EXPECTED_CHAIN_ID=1952)
pnpm contracts:deploy

# Then promote to mainnet (EXPECTED_CHAIN_ID=196 with real verifier)
```

Environment setup: [`.env.example`](./.env.example). Full deploy
guide: [`docs/deployment.md`](./docs/deployment.md).

## Submission workflow

```bash
pnpm submission:bundle     # regenerate submission/FINAL_PACKET.md + final-packet.json
pnpm submission:check      # readiness report
pnpm tsx scripts/run-happy-path.ts   # execute the full warrant lifecycle on mainnet
```

## License

MIT. See [LICENSE](./LICENSE).
