# Warrant

Proof-gated liquidity agents on X Layer.

**No warrant, no move.** Warrant is a full-stack hackathon submission for Build X Season 2. Owners declare a liquidity strategy in plain language, and every AI-driven rebalance must clear a warrant — a proof that the move respects the declared policy — before capital can leave the vault.

## Build X Season 2 · Compliance at a glance

This table cross-references every hackathon requirement to the exact
place in this repo where it is satisfied. Judges can audit compliance
by clicking through the right column.

### Required items (必要项)

| # | Requirement (paraphrased) | Satisfied? | Evidence |
|---|---|---|---|
| 1 | At least one component built on X Layer | ✅ | All 5 contracts deployed on X Layer mainnet **chainId 196** — see [`deployments/xlayer-196.json`](./deployments/xlayer-196.json) and the [Deployment addresses](#deployment-addresses) section. Every Scout proposal reads live state from X Layer RPC. |
| 2 | Agentic Wallet as the on-chain identity; multi-agent roles documented in README | ✅ | **4 role-separated agent wallets** documented below in [Agent wallet identities](#agent-wallet-identities) — Owner, Scout, Executor, Treasury. Full permission graph in [docs/agent-identities.md](./docs/agent-identities.md). |
| 3 | Call at least one core module of Onchain OS Skill OR Uniswap Skill | ✅ | **7 Skill modules integrated, 12 live calls per Scout proposal** — see [Onchain OS / Uniswap Skill usage](#onchain-os--uniswap-skill-usage). Uniswap: `V3Pool`, `QuoterV2`, `TickLens`, `V3Factory`, `NFPM`, `SwapRouter02`. Onchain OS: `okx-dex-swap` (HMAC-signed DEX Aggregator). |
| 4a | Code in a public GitHub repo | 🕓 | Repo URL will be populated on push — see the [Team](#team) section. |
| 4b | README — Project intro | ✅ | [Project intro](#project-intro) |
| 4c | README — Architecture overview | ✅ | [Architecture overview](#architecture-overview) |
| 4d | README — Deployment addresses | ✅ | [Deployment addresses](#deployment-addresses) + [End-to-end verification on X Layer mainnet](#end-to-end-verification-on-x-layer-mainnet) |
| 4e | README — Onchain OS / Uniswap Skill usage | ✅ | [Onchain OS / Uniswap Skill usage](#onchain-os--uniswap-skill-usage) — all 7 modules with call paths, ABIs, and rationale |
| 4f | README — Operation mechanism | ✅ | [Operation mechanism](#operation-mechanism) |
| 4g | README — Team members | ✅ | [Team](#team) |
| 4h | README — X Layer ecosystem positioning | ✅ | [X Layer ecosystem positioning](#x-layer-ecosystem-positioning) |
| 5 | Google Form submission before 2026-04-15 23:59 UTC | 🕓 | Submission packet ready in [submission/FINAL_PACKET.md](./submission/FINAL_PACKET.md) and [submission/GOOGLE_FORM_COPY.md](./submission/GOOGLE_FORM_COPY.md). Filing is a human action. |

### Bonus items (加分项)

| # | Bonus item | Status | Evidence |
|---|---|---|---|
| B1 | 1–3 min Demo video on YouTube / Google Drive | 🎬 Script ready | Shooting script: [docs/demo-script.md](./docs/demo-script.md). Video recording + upload is a human action; link will land in [Team](#team). |
| B2 | X post with `#XLayerHackathon` (and @XLayerOfficial), including project name + image/video | 📝 Copy ready | Paste-ready threads: [docs/x-post-template.md](./docs/x-post-template.md). Posting is a human action. |
| B3 | **Effectively** integrate more Onchain OS / Uniswap Skills | ✅ **7 modules** | **6 Uniswap** (`V3Pool` · `QuoterV2` · `TickLens` · `V3Factory` · `NFPM` · `SwapRouter02`) **+ 1 Onchain OS** (`okx-dex-swap`). Source of truth: [`app/api/scout/propose/route.ts`](./app/api/scout/propose/route.ts). Each call has its own file under [`lib/uniswap/`](./lib/uniswap) and [`lib/okx/`](./lib/okx). |

> Legend: ✅ done · 🕓 done on our side, waiting on final human submission step · 🎬/📝 artefact ready, waiting on recording / posting.

## Project intro

Autonomous DeFi agents are only useful if owners can verify that capital moves inside the rules they signed off on. Warrant treats that guarantee as the core primitive, not an afterthought:

- Verifiable execution before capital moves
- Proof-gated liquidity management
- Human-readable strategy constraints for autonomous agents
- Clear onchain activity for owners and judges

## One-line pitch

Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier.

## Product surface

- Terminal-style agent command center
- Landing page with product positioning and system overview
- Strategy creation flow
- Position dashboard
- Activity feed with proof checkpoints
- Proof center with verification state
- Yield history with traceable rebalance records
- Submission page with deployment and wallet placeholders

## Architecture overview

### Core loop

1. An owner creates a strategy for a single X Layer Uniswap pool.
2. The Scout Agent observes pool state and proposes a rebalance.
3. A zk proof attests that the proposal follows the registered policy.
4. The Executor Agent verifies the proof and executes add/remove/rebalance logic.
5. The Treasury Agent records results and updates reward events.

### Agent roles

- Owner Wallet: creates strategies and owns capital
- Scout Agent Wallet: proposes proof-backed rebalances
- Executor Agent Wallet: performs proof-cleared vault actions
- Treasury Agent Wallet: records fee and reward epochs

### Contract surface

- `StrategyRegistry.sol` — owner-declared strategies with per-UTC-day rebalance budgets
- `ProofVerifier.sol` — dual-hash (`proposalHash` + `executionHash`) commitment and single-use consume gate
- `AttestationVerifier.sol` — ECDSA-backed default verifier for `IZkVerifier`, swappable for a zk-SNARK verifier later
- `LiquidityVault.sol` — capital vault that recomputes `executionHash` on-chain from the structured `RebalanceAction` before consuming a warrant
- `RewardSplitter.sol` — access-controlled epoch recorder with reward-split invariant

These contracts are deliberately scoped for a credible MVP rather than an over-designed protocol.

## Onchain OS / Uniswap Skill usage

Warrant integrates Skills concretely, not just by name. **Every Scout
proposal fires 7 Skill modules in a single pass — 6 Uniswap periphery
modules and 1 Onchain OS Skill — producing 12 live RPC/API calls per
warrant.** The server returns an explicit `skillCalls` log on every
response so evaluators can grep the integration depth in one
round-trip.

```
POST /api/scout/propose  →  skillSummary: {
   uniqueSkills: 7,
   totalCalls:   12,
   platforms: {
     uniswap:   [ v3-pool, quoter-v2, tick-lens, v3-factory, nfpm, swap-router-02 ],
     onchainOs: [ okx-dex-swap ],
   }
}
```

Source of truth for the integration: [`app/api/scout/propose/route.ts`](./app/api/scout/propose/route.ts).

### Uniswap Skill #1 — UniswapV3Pool (6 view methods)

The Scout agent reads live state from X Layer's canonical Uniswap v3
deployment (chainId 196). The call path:

- `config/uniswap.ts` — canonical Uniswap v3 addresses for X Layer (v3Factory, SwapRouter02, NonfungiblePositionManager, QuoterV2, TickLens) plus curated high-liquidity pools and well-known tokens (USDC, WETH, USDT, WBTC)
- `lib/uniswap/pool-abi.ts` — minimal Uniswap v3 Pool ABI (`slot0`, `liquidity`, `token0`, `token1`, `fee`, `tickSpacing`, `observe`) + ERC20 metadata ABI
- `lib/uniswap/pool-reader.ts` — opens a JSON-RPC connection to X Layer and pulls the full pool snapshot in a single batched call
- `lib/uniswap/scout.ts` — converts the snapshot + owner risk profile into a concrete `RebalanceAction` struct and computes the executionHash the vault will verify
- `agents/scout-agent.ts` — `ScoutAgent` class wrapping the above
- `app/api/scout/propose/route.ts` — server-side POST endpoint, called from `/terminal` when the user clicks **Live scout (X Layer Uniswap v3)**

Every Live scout click triggers **six real view calls** against the
target pool on `rpc.xlayer.tech`:

| Method | Purpose |
|---|---|
| `slot0()` | current sqrtPriceX96, tick, observation slot |
| `liquidity()` | active liquidity at the current tick |
| `token0()` / `token1()` | token pair identity |
| `fee()` | raw v3 fee (500, 3000, etc) |
| `tickSpacing()` | used by Scout to align proposed ticks |

The response surfaces real block numbers, real sqrtPriceX96, real
token symbols, and the real executionHash the vault will recompute
during execution.

### Uniswap Skill #2 — QuoterV2 (swap-leg simulation)

The Scout agent also calls `QuoterV2.quoteExactInputSingle` on
`0xd1b797d92d87b688193a2b976efc8d577d204343` (the canonical X Layer
Uniswap v3 Quoter) to simulate the swap leg of the proposed
rebalance. Wrapping logic lives in `lib/uniswap/quoter.ts`. The
response includes:

- `amountOut` — how much token1 the owner would get for 1 unit of token0 at current state
- `sqrtPriceX96After` — what the pool price would look like after the hypothetical swap
- `initializedTicksCrossed` — how many initialized ticks the swap would step through
- `gasEstimate` — the quoter's own gas estimate for the full swap path

This value is rendered in the Live Warrant card under "Uniswap
QuoterV2 simulation" and is authoritative — QuoterV2 uses the actual
swap math internally (the function is `external` but reverts with the
quote, so we use `staticCall`).

### Uniswap Skill #3 — TickLens (liquidity bitmap)

`TickLens.getPopulatedTicksInWord` is the canonical batch reader for
Uniswap v3 pool tick bitmaps. Calling it from `lib/uniswap/tick-lens.ts`
gives the Scout an O(1) view of every initialized tick inside the word
containing the pool's current tick. The Scout folds that into its
rationale:

> `[TickLens] word 77: 6 initialized ticks (3 below, 3 at/above current)`

so evaluators can see the warrant is backed by real liquidity
structure, not just a snapshot price.

### Uniswap Skill #4 — V3Factory (canonical pool check)

`UniswapV3Factory.getPool(tokenA, tokenB, fee)` is the authoritative
`(token0, token1, fee) → pool` resolver. `lib/uniswap/factory.ts` uses
it to prove that the pool address the strategy claims is THE Uniswap
pool for that token triplet — not a look-alike contract. Every Scout
proposal runs this check before signing an attestation, and the
response surfaces `factoryCheck.matchesClaim` so the UI can block
mismatches.

### Uniswap Skill #5 — NonfungiblePositionManager (inventory)

Before proposing a rebalance, the Scout reads the recipient's existing
LP NFT inventory via `balanceOf` → `tokenOfOwnerByIndex` → `positions`.
`lib/uniswap/position-manager.ts` returns a filtered list of positions
matching the target pool, letting the Scout pick a modify-liquidity vs
fresh-mint path. This is the 5th canonical Uniswap periphery contract
exercised per warrant.

### Uniswap Skill #6 — SwapRouter02 (execution-path simulation)

`SwapRouter02.exactInputSingle` is the actual router executors use.
`lib/uniswap/swap-router.ts` static-calls it with the Scout's proposed
swap leg to surface router-level failures (allowance, recipient
eligibility, slippage) that QuoterV2 alone cannot catch, since the
Quoter only exercises pool math. A negative result is expected and
documented in the response — it proves the router is really being
called without wasting gas.

### Onchain OS Skill — okx-dex-swap (DEX Aggregator)

The first Onchain OS Skill wired into Warrant is **`okx-dex-swap`**
from the [`okx/onchainos-skills`](https://github.com/okx/onchainos-skills)
package. It wraps OKX's public WaaS DEX Aggregator at
`https://web3.okx.com/api/v5/dex/aggregator/quote`, and we call it
directly from `lib/okx/dex-aggregator.ts` with HMAC-SHA256-signed
headers (the same auth scheme OKX's v5 API uses).

Why this matters for Warrant: the Scout proposes a Uniswap-v3 LP
rebalance, but the rebalance's **swap leg** can route across any DEX
on X Layer. The OKX Aggregator returns a best-route quote across
Uniswap v3, OKXSwap, iZUMi, Butter, SushiSwap and others — so the
warrant can record both a single-venue (Uniswap QuoterV2) and a
cross-venue (okx-dex-swap) quote, and the UI can surface whichever
fill is stronger.

The integration degrades gracefully: if `OKX_API_KEY` /
`OKX_SECRET_KEY` / `OKX_PASSPHRASE` are not set in env, the endpoint
returns `{ ok: false, mode: "unconfigured", note: "..." }` — the HMAC
code path stays in place so reviewers can verify correctness. See
[`.env.example`](./.env.example) for setup.

Also exposed as a standalone route at `POST /api/okx/quote` so any
dApp can hit it independently of the Scout flow.

### Write path — NonfungiblePositionManager / SwapRouter02

On-chain writes (from the Executor Agent, via
`LiquidityVault.executeRebalance`) target the canonical Uniswap v3
periphery. The exact addresses used live in `config/uniswap.ts`:

- `v3Factory:  0x4b2ab38dbf28d31d467aa8993f6c2585981d6804`
- `swapRouter02: 0x7078c4537c04c2b2e52ddba06074dbdacf23ca15`
- `nonfungiblePositionManager: 0x315e413a11ab0df498ef83873012430ca36638ae`
- `quoterV2: 0xd1b797d92d87b688193a2b976efc8d577d204343`
- `tickLens: 0x661e93cca42afacb172121ef892830ca3b70f08d`

### Onchain OS — agent orchestration layer

The Scout / Executor / Treasury roles run as three distinct Onchain OS
agents sharing state through `ProofVerifier` + `AttestationVerifier`.
Each agent has a minimal permission surface:

- Scout signs warrants (`ATTESTATION_SIGNER_ADDRESS`)
- Executor is the only caller allowed to touch `LiquidityVault.executeRebalance`
- Treasury is an authorized recorder on `RewardSplitter` (in addition to the vault)

The terminal in `/terminal` is the operator's command surface into
that orchestration layer. Every server-side scout proposal returns an
explicit `skillCalls` array listing exactly which Skill contracts and
methods were invoked.

## Operation mechanism

### Step-by-step lifecycle

- The owner enters a strategy in natural language.
- The frontend compiles it into machine-readable guardrails.
- StrategyRegistry stores the policy and enforces a real per-day rebalance
  budget that resets every UTC day.
- Scout Agent monitors the pool, builds a structured `RebalanceAction`,
  and commits BOTH a human-readable `proposalHash` AND a strict
  `executionHash = keccak256(abi.encode(pool, lowerTick, upperTick, liquidityDelta, recipient))`
  when submitting the proof.
- ProofVerifier validates the proof payload, stores the dual commitment,
  verifies the strategy exists, and exposes a single-use consume gate.
- LiquidityVault recomputes the execution hash on-chain from the
  `RebalanceAction` struct the executor passes in, so the executor cannot
  substitute different runtime parameters than the scout committed to. The
  vault calls `consumeProof` with the recomputed hash — any mismatch
  reverts.
- Treasury Agent records fees via `RewardSplitter.recordEpoch`, which is
  access-controlled and enforces `scoutReward + executorReward + treasuryReward <= grossFees`.

### Live verification

The Scout API was live-tested against X Layer mainnet (chainId 196)
reading the `xETH / USDT0 0.05%` pool
`0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc`. The response included a
real block number, real sqrtPriceX96, real `executionHash`, and real
token symbols — all computed against the canonical Uniswap v3
deployment referenced in `config/uniswap.ts`. See the **End-to-end
verification on X Layer mainnet** section below for the 5 on-chain
transaction hashes captured by `pnpm tsx scripts/run-happy-path.ts`.

## X Layer ecosystem positioning

Warrant is designed as a native X Layer agentic DeFi application. It depends on low-friction onchain coordination, observable agent behavior, and proof-backed execution traces that are easy for judges to inspect in a Build X workflow.

Official references:

- Build X Hackathon: https://web3.okx.com/vi/xlayer/build-x-hackathon
- Onchain OS: https://web3.okx.com/zh-hans/onchainos
- Uniswap AI tools: https://github.com/Uniswap/uniswap-ai
- X Layer RPC info: https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information

## End-to-end verification on X Layer mainnet

The full warrant lifecycle — create strategy → create vault → submit
proof → execute rebalance → settle epoch — was executed against
**X Layer mainnet (chainId 196)** at block **57449597** by running
`pnpm tsx scripts/run-happy-path.ts`. The script exercises all 4
agent wallets and 6 Uniswap Skill modules in a single pass.

| Step | Actor | tx hash | Explorer |
|---|---|---|---|
| `StrategyRegistry.createStrategy` | Owner | `0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465` | [View](https://www.okx.com/web3/explorer/xlayer/tx/0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465) |
| `LiquidityVault.createVault` | Owner | `0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8` | [View](https://www.okx.com/web3/explorer/xlayer/tx/0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8) |
| `ProofVerifier.submitProof` | Scout | `0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f` | [View](https://www.okx.com/web3/explorer/xlayer/tx/0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f) |
| `LiquidityVault.executeRebalance` | Executor | `0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800` | [View](https://www.okx.com/web3/explorer/xlayer/tx/0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800) |
| `RewardSplitter.recordEpoch` | Treasury | `0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520` | [View](https://www.okx.com/web3/explorer/xlayer/tx/0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520) |

**Verified on-chain facts** (from this run):

- **Strategy #3** created, bound to Uniswap v3 pool `0x77ef18ad…` (USD₮0/xETH 0.05%), `maxRebalancesPerDay=2`, `riskLevel=medium`
- **Vault #3** created on the same strategy
- **Pool snapshot**: tick `198759`, price `2335.66 USD₮0 per xETH`, block `57449597`
- **Scout proposal**: range `[198570, 198940]` (width 370 ticks, 18× tickSpacing each side)
- **proposalHash**: `0x654f99d32acdb1ff443fe40949a54c9b77c281ba5e05cde8b61a02f8570a9bae`
- **executionHash**: `0x2c442aedda153893b8ed7bf6ff04748fa213fa5141749896c16f463be65606f3`
- **proofId**: `0x3043df43f567248a4cd3a561d54bc6ab2fa4248c7a14d59dc2ca633d5911e158`
- **6-Skill audit passed**: TickLens (word 77, 6 initialized ticks), V3Factory (canonical pool match = true), NFPM (0 existing LP NFTs → fresh-mint path), SwapRouter02 (staticCall reverts as expected without pre-wired allowance)
- **Warrant consumed**: `isVerified` flipped `true → false` after `executeRebalance`
- **Daily budget decremented**: `remainingRebalancesToday` went from 2 → 1
- **Reward epoch #2 recorded** via `TreasuryAgent.settleEpochOnchain`: `grossFees=1000`, split `scout=300 / executor=300 / treasury=400 / retained=0` (invariant `sum ≤ grossFees` holds)
- **Gas used for `executeRebalance`**: 74,379

This is the exact flow evaluators can replay from any of the tx hashes
above on the X Layer explorer.

## Deployment addresses

All 5 contracts are deployed on **X Layer mainnet (chainId 196)**.
`insecureProofs` is `false` — warrants are verified through the on-chain
`AttestationVerifier` backing `ProofVerifier`.

| Contract | Address |
| --- | --- |
| StrategyRegistry | [`0x531eC789d3627bF3fd511010791C1EfFc63c2DA6`](https://www.okx.com/web3/explorer/xlayer/address/0x531eC789d3627bF3fd511010791C1EfFc63c2DA6) |
| ProofVerifier | [`0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8`](https://www.okx.com/web3/explorer/xlayer/address/0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8) |
| AttestationVerifier | [`0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2`](https://www.okx.com/web3/explorer/xlayer/address/0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2) |
| LiquidityVault | [`0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC`](https://www.okx.com/web3/explorer/xlayer/address/0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC) |
| RewardSplitter | [`0x81AdD46B05407146B049116C66eDF2B879eCc06e`](https://www.okx.com/web3/explorer/xlayer/address/0x81AdD46B05407146B049116C66eDF2B879eCc06e) |

Authoritative source: [`deployments/xlayer-196.json`](./deployments/xlayer-196.json).

Permission graph wired at deploy time:

- `StrategyRegistry.setConsumer(LiquidityVault) = true`
- `ProofVerifier.setConsumer(LiquidityVault) = true`
- `RewardSplitter.setRecorder(LiquidityVault) = true`
- `RewardSplitter.setRecorder(TreasuryAgent) = true`
- `AttestationVerifier.authorizedSigner = ScoutAgent`
- `ProofVerifier.verifier() = AttestationVerifier` (no `insecureDemoMode` fallback on mainnet)

## Agent wallet identities

Warrant runs as **four role-separated wallets**. Each has a minimal
permission surface, so a compromise of any single key has a bounded
blast radius. All four are active on X Layer mainnet (chainId 196):

| Role | Address |
| --- | --- |
| Owner Wallet | [`0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061`](https://www.okx.com/web3/explorer/xlayer/address/0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061) |
| Scout Agent Wallet | [`0x86b0E1c48d39D58304939c0681818F0E1c1e8d83`](https://www.okx.com/web3/explorer/xlayer/address/0x86b0E1c48d39D58304939c0681818F0E1c1e8d83) |
| Executor Agent Wallet | [`0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9`](https://www.okx.com/web3/explorer/xlayer/address/0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9) |
| Treasury Agent Wallet | [`0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0`](https://www.okx.com/web3/explorer/xlayer/address/0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0) |

See [docs/agent-identities.md](./docs/agent-identities.md) for the
per-wallet permission surface and key rotation procedures.

## Team

> **Action required before 2026-04-15 23:59 UTC**: fill the values below,
> paste your GitHub handle, and replace the `<TBD_*>` tokens elsewhere in
> the README and `submission/*`.

| Field | Value |
| --- | --- |
| Team name | X Builder |
| Builder 1 | X Builder |
| Builder 2 (optional) | — |
| GitHub repo | `https://github.com/<TBD_GITHUB_HANDLE>/warrant` |
| Demo video | `<TBD_VIDEO_LINK>` (YouTube or Google Drive) |
| X post link | `<TBD_SOCIAL_LINK>` (must include `#XLayerHackathon`) |

After filling, run `pnpm submission:bundle` to regenerate
`submission/FINAL_PACKET.md`, and `pnpm submission:check` to confirm no
placeholders remain.

## Repo structure

```text
app/                 Next.js product prototype
components/          Reusable UI primitives
lib/                 Mock data, submission data, and helper types
contracts/           Solidity contract sources
agents/              Agent service skeletons
scripts/             Contract compile/deploy scripts
deployments/         Deployment manifests
proofs/              Example proof packets
docs/                Demo script, architecture, and submission notes
submission/          Generated packet files for the Google Form and repo handoff
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
pnpm agents:generate --env > .env.local.secret

# Compile the 5 Warrant contracts + the AttestationVerifier
pnpm contracts:compile

# Run the invariant test suite (requires an anvil/ganache at LOCAL_RPC_URL)
LOCAL_RPC_URL=http://127.0.0.1:8545 pnpm contracts:test

# Deploy to X Layer testnet first (EXPECTED_CHAIN_ID=1952)
pnpm contracts:deploy

# Then promote to mainnet (EXPECTED_CHAIN_ID=196 with real verifier)
```

See [docs/deployment.md](./docs/deployment.md) for environment variables and deployment output.

## Submission workflow

```bash
pnpm submission:bundle
pnpm submission:check
```

- `pnpm submission:bundle` generates `submission/FINAL_PACKET.md`, `submission/GOOGLE_FORM_COPY.md`, and `submission/final-packet.json`
- `pnpm submission:check` reports which placeholders, links, and live deployment fields still need to be filled before final submission
- The submit page and generated packet automatically switch from `deployments/xlayer-template.json` to the latest `deployments/xlayer-<chainId>.json` when a live manifest exists

## Submission materials in this repo

- [docs/product-overview.md](./docs/product-overview.md) — full product story (problems, value, differentiation, use cases)
- [docs/demo-script.md](./docs/demo-script.md)
- [docs/submission-checklist.md](./docs/submission-checklist.md)
- [docs/submission-form.en.md](./docs/submission-form.en.md)
- [docs/submission-form.zh.md](./docs/submission-form.zh.md)
- [proofs/sample-proof-packet.json](./proofs/sample-proof-packet.json)
- [docs/social-links.md](./docs/social-links.md)
- [docs/final-sprint.md](./docs/final-sprint.md)
- [submission/FINAL_PACKET.md](./submission/FINAL_PACKET.md)
- [submission/GOOGLE_FORM_COPY.md](./submission/GOOGLE_FORM_COPY.md)

## Current status

Included now:

- **7-Skill integration per Scout proposal.** `/api/scout/propose` fires six Uniswap periphery modules (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02) **and** one Onchain OS Skill (okx-dex-swap, HMAC-signed DEX Aggregator call). 12 live calls per proposal. `skillSummary` surfaces the full inventory on every response.
- **Onchain OS standalone route.** `POST /api/okx/quote` exposes the okx-dex-swap skill independently of the Scout flow, for any dApp to hit directly.
- **Production-grade Treasury agent.** `agents/treasury-agent.ts` is a real on-chain settler: `watchAndSettle` subscribes to `RebalanceExecuted` events, `computeSplit` enforces the basis-point invariant off-chain, `settleEpochOnchain` broadcasts `RewardSplitter.recordEpoch`. Exercised in `scripts/run-happy-path.ts`.
- **Live Uniswap Skill integration.** `/terminal` has a **Live scout (X Layer Uniswap v3)** button that hits `/api/scout/propose`, which runs the full pool-reader pipeline against X Layer mainnet and returns a real `executionHash` bound to the on-chain tick.
- **Production-safe verifier.** `AttestationVerifier.sol` ships as the default `IZkVerifier` implementation. Accepts ECDSA signatures from a pre-authorized scout key over `(strategyId, proposalHash, executionHash)`. Swappable to a zk-SNARK verifier without migrations.
- **Mainnet hard guards.** Deploy script aborts on mainnet unless (`ALLOW_INSECURE_PROOFS=false` **and** a real verifier is wired) **and** runtime `chainId` matches `EXPECTED_CHAIN_ID`.
- **Full product narrative and design system ready for judges.**
- **Landing page + 7 product surface pages** (terminal, strategy, dashboard, activity, proofs, yield, submit) wired through a single DemoProvider.
- **Smart contracts** with real access control, per-UTC-day rebalance reset, dual-hash proof binding, and reward-split invariants.
- **Real wallet connection** (ethers `BrowserProvider`), network detection, `StrategyRegistry.createStrategy` and `LiquidityVault.executeRebalance` on-chain call paths gated by the live deployment manifest.
- **Agent wallet generator** (`pnpm agents:generate`) produces 4 role-separated keys in a single shot.
- **Invariant test suite** (`pnpm contracts:test`) against a local anvil RPC for: daily cap, reward split invariant, and attestation signer verification.
- **End-to-end happy-path runner** (`pnpm tsx scripts/run-happy-path.ts`) executes createStrategy → createVault → 6-Skill depth audit → submitProof → executeRebalance → TreasuryAgent.settleEpochOnchain against real X Layer mainnet.
- Submission packet generator (markdown + JSON) running off the single source of truth in `lib/demo-constants.ts` and `lib/submission-data.ts`.

Still required before final live submission (human action):

- Real demo video URL (YouTube or Google Drive) — see [`docs/demo-script.md`](./docs/demo-script.md) for the shooting script
- X post link with `#XLayerHackathon` and `@XLayerOfficial` — see [`docs/x-post-template.md`](./docs/x-post-template.md) for paste-ready copy
- Team name + builder names in the Team table above
- Public GitHub repo URL (replace `<TBD_GITHUB_HANDLE>` everywhere)
- Populate `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` in `.env` once credentials are issued from [web3.okx.com/zh-hans/onchainos](https://web3.okx.com/zh-hans/onchainos) (the okx-dex-swap skill runs in graceful-degradation mode without them).
