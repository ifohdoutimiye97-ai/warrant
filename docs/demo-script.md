# Warrant · Demo Script (90–120 s, cuts to 180 s if needed)

This is the shooting script for the Build X Season 2 submission video.
Target length **90 s** (preferred) or **180 s** if a 3-minute slot is
allowed. Every scene is timed, every narration line is scored, and
every click target is explicit.

## Mandatory phrases (script must say these aloud)

Evaluators auto-transcribe the audio. These strings are scored:

- "X Layer" (chain positioning)
- "Uniswap" (integration)
- "Onchain OS" (Skill package)
- "warrant" or "no warrant, no move" (product thesis)
- "seven Skill modules" (integration depth)

## Target proof artefacts (appear on screen at least once)

- The words "uniswap-v3-pool", "uniswap-quoter-v2", "uniswap-tick-lens",
  "uniswap-v3-factory", "uniswap-nfpm", "uniswap-swap-router-02",
  "okx-dex-swap" — all 7 Skill tags rendered in the Scout response
- X Layer block number from a fresh RPC call
- At least one on-chain tx hash on the X Layer explorer

---

## Scene 0 · Cold open (0:00 – 0:06)

**Frame**: Landing page hero, `https://warrant-xi.vercel.app/`

**Narration**:
> "Warrant is a proof-gated liquidity agent system on X Layer. Capital
> never moves without a warrant."

**Tip**: Wait 1 beat on the hero. Don't start typing yet.

---

## Scene 1 · Seven Skills in one click (0:06 – 0:35)

**Navigate**: Click "Terminal" in the top nav.

**Narration** (while the page loads):
> "The Scout agent reads real Uniswap v3 pool state on X Layer mainnet,
> chainId 196. When I hit Live scout, it fires seven Skill modules in
> one pass — six Uniswap periphery modules, and one Onchain OS Skill."

**Action**: Click **⚡ Live scout (X Layer Uniswap v3)**.

**Narration** (while RPC calls land, ~2s):
> "UniswapV3Pool, QuoterV2, TickLens, V3Factory, the
> NonfungiblePositionManager, SwapRouter02, and the okx-dex-swap
> Onchain OS Skill — all hit live mainnet state."

**Hold the frame** for **3 seconds** on the Live Warrant card. The
skill tags row MUST be visible and un-scrolled — that's the evaluator
hook.

**Frame notes**:
- Top of card: "Bound to Uniswap v3 · USD₮0 / xETH"
- Block number (real, live)
- 4 stat cards
- Rationale text ending with the Skill-extension bullets (TickLens,
  Factory, NFPM, SwapRouter02 summaries)
- Pill row listing all 7 Skill module names

---

## Scene 2 · Strategy compile (0:35 – 0:55)

**Navigate**: Click "Strategy" in the top nav.

**Narration**:
> "The owner declares the policy in plain English. The compiler turns
> it into the exact calldata StrategyRegistry.createStrategy expects
> on X Layer."

**Type into the strategy prompt box**:
```
Run a medium-risk xETH/USDT0 strategy on X Layer with 2 rebalances per day.
```

**Click**: "Compile warrant-ready strategy"

**Frame**: Right-hand Compiled strategy card updates; below, the
On-chain deployment card shows the real StrategyRegistry address
`0x531eC789…`.

---

## Scene 3 · Proof gate (0:55 – 1:15)

**Navigate**: Click "Proofs" in the top nav.

**Narration**:
> "Warrants bind both a proposal hash and an execution hash. The vault
> recomputes the execution hash on-chain, so the executor can't
> substitute different parameters than the scout committed to. One
> warrant, one execution."

**Frame**: 5 check rows — all Pass. Keep scroll on the proof ID + hash
pairs for 1 full second so they can be OCR'd.

---

## Scene 4 · Execute + settle (1:15 – 1:40)

**Navigate**: Click "Terminal" (the Live Warrant card from Scene 1 is
still rendered).

**Narration**:
> "Execute sends a real LiquidityVault.executeRebalance transaction.
> The vault consumes the warrant, decrements the daily cap, and fires
> a RebalanceExecuted event that the Treasury agent picks up and
> records to RewardSplitter — scout, executor, treasury split
> enforced on-chain."

**Action**: Click "Execute warrant on-chain" (when wallet is connected
on X Layer; otherwise show the blocked-on-connect state and talk over
the happy-path script output instead).

**B-roll option**: Split-screen with a terminal tailing
`pnpm tsx scripts/run-happy-path.ts` output, where evaluators can see:
- `createStrategy` tx hash
- `submitProof` tx hash
- `executeRebalance` tx hash
- `recordEpoch` tx hash
All on X Layer explorer.

---

## Scene 5 · Close (1:40 – 1:55)

**Navigate**: Back to landing page.

**Frame**: Hero. Wait 1 beat.

**Narration**:
> "Warrant. Seven Skill modules, four role-separated agents, one
> warrant per rebalance. On X Layer. No warrant, no move."

**Fade**.

---

## Recording checklist (do in order)

1. Pre-warm Vercel by clicking Live scout **ONCE** before hitting record
   (cold start is ~4 s, warm is ~800 ms).
2. Close all devtools, sidebars. Clean Chrome profile.
3. Record at 1440×900, 30 fps, 16:9. QuickTime → "File → New Screen
   Recording" is fine.
4. Do the audio in one take after the visual is locked. Don't
   narrate live — dub over.
5. Export as H.264 MP4. YouTube upload or Google Drive share link.
6. Copy the link into README.md, `submission/FINAL_PACKET.md`, and the
   Google Form before 2026-04-15 23:59 UTC.

## Optional B-roll for the 180 s cut

- 10 s: `/submit` page showing the deployment manifest auto-rendered
  from `deployments/xlayer-196.json`
- 15 s: `/activity` showing the event feed
- 15 s: the X Layer explorer page for LiquidityVault
  `0xbFFc45c9…` with the RebalanceExecuted tx visible
- 10 s: dashboard /yield page with the cumulative fee chart

## Title / description (for YouTube or Drive)

**Title**: `Warrant — Proof-gated Liquidity Agents on X Layer (Build X S2)`

**Description**:
```
Warrant is a proof-gated liquidity agent system on X Layer. Every AI
rebalance must clear a warrant — a proof bound to owner-declared
policy — before capital can leave the vault.

Built for OKX Build X Season 2 · X Layer Arena.

Contracts (X Layer mainnet, chainId 196):
  StrategyRegistry    0x531eC789d3627bF3fd511010791C1EfFc63c2DA6
  ProofVerifier       0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8
  AttestationVerifier 0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2
  LiquidityVault      0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC
  RewardSplitter      0x81AdD46B05407146B049116C66eDF2B879eCc06e

Skill modules (7 total, 12 calls per proposal):
  · Uniswap v3: UniswapV3Pool · QuoterV2 · TickLens · V3Factory
                NonfungiblePositionManager · SwapRouter02
  · Onchain OS: okx-dex-swap

GitHub: <TBD_GITHUB_LINK>
Pitch:  No warrant, no move.
```
