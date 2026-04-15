# Demo Guide · User wallet with 0.2 OKB

This is the ops-side companion to [`docs/demo-script.md`](./demo-script.md).
The script covers what to *say* on camera; this guide covers what the
user wallet is actually *allowed* to do on-chain, so the demo stays
honest and avoids any "why didn't that button work?" moments.

## Hard constraint: user wallet ≠ agent wallet

Warrant's product thesis is **role-separated wallets**. Four agents, each
with a bounded on-chain permission surface. A *user* wallet (the one the
owner connects via OKX Wallet / MetaMask) is purposefully NOT any of the
four — it represents the liquidity owner coming in cold.

| Action | Signer required | Can user wallet sign it? |
|---|---|---|
| `StrategyRegistry.createStrategy` | anyone | ✅ yes |
| `LiquidityVault.createVault` | strategy owner | ✅ yes |
| Scout attestation signing | Scout agent key (`0x86b0E1c4…`) | ❌ no — backend only |
| `ProofVerifier.submitProof` | Scout (authorized signer) | ❌ no — backend only |
| `LiquidityVault.executeRebalance` | Executor agent key (`0x4F5A8Bf1…`, `onlyExecutor` modifier) | ❌ **reverts on-chain** |
| `RewardSplitter.recordEpoch` | Treasury agent (authorized recorder) | ❌ no — backend only |

**This is a feature, not a bug.** Evaluators who grasp the product thesis
will see the separation as the differentiator. Evaluators who get
confused usually are comparing against single-wallet yield bots — this
guide is here to prevent that comparison.

## Recommended demo flow

### Setup

- OKX Wallet (or MetaMask) installed, with a fresh wallet holding **0.2
  OKB on X Layer mainnet** (chainId 196).
- `http://localhost:49809` open (run `pnpm dev` first) or the Vercel
  production URL if pushed.
- Terminal ready in the project directory for the split-screen scene.

### 2-minute double-screen version

#### Scene 0 · Hero (0:00 – 0:08)
- Landing page. Point out the live banner: `LIVE ON X LAYER MAINNET · chainId 196`.
- Narration: *"Warrant: proof-gated liquidity agents on X Layer. No warrant, no move."*

#### Scene 1 · Live Scout — seven Skills (0:08 – 0:35)
- Click **Terminal** → **⚡ Live scout (X Layer Uniswap v3)**.
- Hold on the Live Warrant card + the 12-pill skillCalls row for
  **3 seconds** (this is the integration-depth beat).
- Narration: *"One click, seven Skill modules against X Layer mainnet
  — six Uniswap periphery, plus the OKX Onchain OS DEX Aggregator.
  Twelve live RPC calls."*
- **No wallet signing yet.** This is pure read.

#### Scene 2 · Connect user wallet (0:35 – 0:50)
- Switch to **Strategy** page → **Connect Wallet**.
- Approve the connection in OKX Wallet; if the extension prompts a
  network switch, approve X Layer (chainId 196).
- Narration: *"I'm connecting a brand-new user wallet with 0.2 OKB.
  This is NOT one of the four agent wallets — I'm the owner, coming in
  cold."*

#### Scene 3 · Sign createStrategy (0:50 – 1:20)
- Type: `Run a medium-risk xETH/USDT0 strategy on X Layer with 2 rebalances per day.`
- Click **Compile warrant-ready strategy** → compiled card updates.
- Click **Deploy on-chain** → **wallet prompt** → confirm → ~5 s wait.
- UI shows "Success: strategyId=X, tx 0x…".
- Optionally cut to the X Layer explorer showing the tx: **from = user wallet, to = StrategyRegistry `0x531eC789…`**.
- Narration: *"My wallet, signing directly against StrategyRegistry.
  One transaction, around one milliOKB of gas. The policy is now a
  hard constraint on-chain."*

#### Scene 4 · Split-screen backend closure (1:20 – 1:50)
- Terminal: `pnpm tsx scripts/run-happy-path.ts`
- Run live alongside the browser.
- After ~20 s, the script prints 5 tx hashes + 6-Skill audit + epoch
  recorded.
- Narration: *"Meanwhile, the Scout, Executor, and Treasury agents —
  each with minimal permissions — run the rest of the loop. Dual-hash
  warrant, on-chain execution-hash re-check, single-use consumption.
  This happens today, on X Layer mainnet."*

#### Scene 5 · Close (1:50 – 2:05)
- Dashboard → 4 stat cards + 3-agent state card.
- Return to landing hero.
- Narration: *"Seven Skills. Four agents. One warrant per rebalance.
  On X Layer. No warrant, no move."*

### 90-second single-screen version

Drop Scene 4 (split-screen). Replace with 10 s of voiceover:

> *"The remaining steps — Scout attestation, Executor consumption,
> Treasury settlement — are handled by four role-separated agent
> wallets documented in our README, each with strictly scoped
> permissions. This separation IS the product. See the 'End-to-end
> verification on X Layer mainnet' section of our README for the five
> real transaction hashes we executed today."*

## Gotchas to avoid during recording

1. **Gas budget**: 0.2 OKB is comfortable for **20–30 `createStrategy`
   signings**. Don't rehearse more than ~5 times or pre-budget another
   0.05 OKB buffer.
2. **Network switch prompt**: the first connection may prompt X Layer
   network addition. If the user rejects, the UI will say "wrong
   network" — reconnect and approve.
3. **Don't pretend the user signs Execute**: `onlyExecutor` reverts
   any user-wallet call to `executeRebalance`. Trying it on camera
   (and getting a revert) looks like a broken product. Evaluators read
   the Solidity; be honest.
4. **Scout attestation is server-side**: the Scout Agent key lives in
   `.wallets.json` on the backend. The user cannot produce a valid
   `submitProof` payload without it — that's the whole point of
   role-separation.
5. **One-shot proof**: once `executeRebalance` consumes a warrant,
   `isVerified(proofId)` flips to `false`. Re-running the same Scout
   proposal without a fresh `proofId` will revert — so in demo
   rehearsals, use fresh proofIds (the happy-path script already does
   this via `keccak256(…Date.now())`).

## If you want to record without a wallet at all

Skip Scenes 2 and 3. Do:

- Scene 0 · Hero
- Scene 1 · Live Scout (no wallet needed, pure read)
- Scene 4 · Full happy-path in terminal (no wallet connection in UI,
  but the 4 agent wallets sign real tx in the backend)
- Scene 5 · Close

This is a 100%-honest "no user wallet connected" demo that still shows
all the on-chain activity through the happy-path script. The README's
"End-to-end verification on X Layer mainnet" section already links the
5 tx hashes for evaluators to click through.
