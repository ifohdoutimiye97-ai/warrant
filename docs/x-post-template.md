# X Post Template

Paste-ready copy for the Build X Season 2 #XLayerHackathon post.

Rules to follow (per the hackathon brief):

- Must include `#XLayerHackathon`
- Should `@XLayerOfficial`
- Must include project name in the post body
- Must attach image or video
- Submit the link to the Google Form

## Option A · Main post (live on mainnet — **use this**)

```
🚀 Warrant is live on @XLayerOfficial mainnet.

Proof-gated liquidity agents: no warrant, no move. Capital cannot
leave the vault until a warrant clears the on-chain verifier. One
warrant = one execution.

• 5 contracts on X Layer chainId 196
• 4 role-separated agent wallets
• 7 Skill modules integrated (6 Uniswap + 1 Onchain OS), 12 live RPC
  calls per Scout proposal

🔗 warrant-xi.vercel.app
📝 github.com/<TBD_GITHUB_HANDLE>/warrant

#XLayerHackathon
```

Character count: ~460. Over 280, so needs X Premium or thread it out.

## Option B · Short main post (fits 280-char free tier)

```
🚀 Warrant: proof-gated liquidity agents on @XLayerOfficial.

No warrant, no move — capital can't leave the vault until a warrant
clears the verifier. 5 contracts live on chainId 196, 7 Skill
modules integrated.

warrant-xi.vercel.app

#XLayerHackathon
```

Character count: ~269. Safe for the free tier.

## Thread continuation (4 tweets — recommended)

**Tweet 2 — the 7 Skill modules**:
```
Every Scout proposal fires 7 Skill modules in one pass:

🦄 Uniswap (6):
 • UniswapV3Pool  (slot0, liquidity, token0/1, fee, tickSpacing)
 • QuoterV2       (quoteExactInputSingle)
 • TickLens       (getPopulatedTicksInWord)
 • V3Factory      (getPool — canonical address check)
 • NFPM           (positions inventory)
 • SwapRouter02   (exactInputSingle staticCall)

🟡 Onchain OS (1):
 • okx-dex-swap   (DEX Aggregator /api/v5/dex/aggregator/quote,
                   HMAC-signed)

12 live calls per click. All real X Layer mainnet.
```

**Tweet 3 — proof binding**:
```
Every warrant binds BOTH:
 • proposalHash   — what the scout asked for
 • executionHash  = keccak256(pool, lowerTick, upperTick,
                     liquidityDelta, recipient)

LiquidityVault recomputes executionHash on-chain and reverts on any
drift. The executor has zero wiggle room once the warrant is signed.
```

**Tweet 4 — the four agents**:
```
Four role-separated wallets, each with a minimal on-chain permission
surface:

 • Owner — creates strategies
 • Scout — reads pools, signs warrants
 • Executor — the ONLY caller allowed into vault.executeRebalance
 • Treasury — records reward epochs via RewardSplitter

One key compromised ≠ the whole system broken.
```

**Tweet 5 — CTA**:
```
Try it:
 → warrant-xi.vercel.app/terminal
 → Click "⚡ Live scout (X Layer Uniswap v3)"
 → Watch 12 skill calls fire against mainnet in real time

Source + demo: github.com/<TBD_GITHUB_HANDLE>/warrant
Demo video:    <TBD_VIDEO_LINK>

@XLayerOfficial #XLayerHackathon
```

## Image / video options (pick ONE for the main tweet)

1. **Most engaging**: 6–8 second GIF of clicking Live Scout →
   Live Warrant card populates with all 7 Skill pills. Record with
   QuickTime, convert via gifski.
2. **Easiest, still strong**: landscape screenshot of Live Warrant
   card showing the 7 Skill tags + block number. Crop 16:9.
3. **Most cinematic**: the demo video itself (1–3 min) attached
   directly as a tweet video.

If you film Option 1 or 3, the same asset doubles as the Google Form
video submission, so you only record once.

## Targeting

- **Handle**: `@XLayerOfficial`
- **Mandatory hashtag**: `#XLayerHackathon`
- **Optional**: `#Uniswap`, `#OnchainOS`, `#DeFi`, `#AIAgents`

## Timing

Post in the 2026-04-14 → 2026-04-15 window, ideally after the demo
video is live. Aim for a 14:00–16:00 UTC window (peak Asia-Pac +
Europe overlap for DeFi audiences).

## After posting

1. Copy the tweet permalink.
2. Paste it into:
   - `README.md` (Team / Submission Links section — replace `TBD_SOCIAL_LINK`)
   - `submission/FINAL_PACKET.md` (Submission Links table)
   - The Google Form under the social-post field
3. Run `pnpm submission:bundle` to regenerate the packet.
