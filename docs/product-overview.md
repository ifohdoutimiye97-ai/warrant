# Warrant · Product Overview

*Proof-gated liquidity agents on X Layer.*

---

## One-sentence pitch

**Warrant is a "proof-before-capital" infrastructure for AI DeFi agents**:
owners delegate liquidity management to autonomous agents, but every
single capital-moving action must first clear a warrant — a proof that
the action stays within the owner-declared policy — or the vault
refuses to open.

**No warrant, no move.** This is not a slogan, it is a literal on-chain
mechanism: the very first line of `LiquidityVault.executeRebalance()`
calls `ProofVerifier.consumeProof()`. No proof, immediate `revert`.

---

## The problems we solve

AI in DeFi is not new. Gelato, Brahma, Hyperliquid Vaults, Gamma,
Arrakis, dozens of yield bots — they all dance around the same
unanswered question:

> **How does the owner know the agent did not step outside its mandate?**

### Problem 1 · Trust boundaries collapse into a single key

Every AI yield bot today follows the same shape: the owner hands a
private key (or a blanket signing delegation) to an off-chain process,
and that process decides when and what to trade.

What happens when something goes wrong? The key is leaked, the agent
is compromised, the process is running a forked buggy build, the
transaction encoded the wrong parameters?

The owner finds out **after the fact**. A transaction lands on-chain,
funds are gone, and explorer inspection reveals something the owner
never authorized.

**Warrant's answer**: the vault only recognizes one document — the
warrant. The Scout agent proposes actions, but the proposal is bound
to two hashes:

- **proposalHash** — *what* the agent wants to do (the intent)
- **executionHash** — *exactly* what parameters it will use (pool,
  lowerTick, upperTick, liquidityDelta, recipient)

The vault **re-computes executionHash on-chain** from the
`RebalanceAction` calldata, compares it against what the warrant was
signed over, and reverts on any mismatch:

```solidity
// contracts/LiquidityVault.sol:116–148
function executeRebalance(
    uint256 vaultId,
    bytes32 proofId,
    RebalanceAction calldata action
) external onlyExecutor {
    bytes32 executionHash = keccak256(abi.encode(
        action.pool, action.lowerTick, action.upperTick,
        action.liquidityDelta, action.recipient
    ));
    // This is the literal implementation of "no warrant, no move":
    proofVerifier.consumeProof(proofId, position.strategyId, executionHash);
    strategyRegistry.consumeRebalance(position.strategyId);
    ...
}
```

Executor key compromised? It holds no warrant-signing power; without a
Scout-signed warrant, the vault stays shut. Scout key compromised? It
holds no executor address authority; calling the vault directly is
rejected by `onlyExecutor`.

### Problem 2 · The Uniswap v3 management grind

Concentrated liquidity made Uniswap v3 10–100× more capital-efficient
than v2, at the cost of making LPs do continuous manual work:

- Price drifts out of range → your capital stops earning fees
- Volatility regime shifts → you need a wider or narrower range
- Do you modify the existing position, or open a new one?

Delegating this to AI is the natural move — except Problem 1 makes
that a leap of faith. Today's options are binary: manage it yourself
(efficiency cost), or trust a branded agent (Gamma, Arrakis) based on
reputation — which is still an *after-the-fact* accountability model,
not a *before-the-fact* prevention one.

**Warrant's answer**: the owner declares the strategy in plain
language, once:

> *"Run a medium-risk xETH/USDT0 strategy on X Layer with 2 rebalances per day."*

The compiler turns that prompt into `StrategyRegistry.createStrategy()`
calldata, which lands on-chain as a **hard constraint**:

- `allowedPool` — only this pool is actionable
- `maxRebalancesPerDay` — 2 per UTC day, no exceptions
- `riskLevel` — medium, which determines the Scout's tick width

These constraints live in the contract, not in the frontend. If the
Scout tries a third rebalance in the same day,
`StrategyRegistry.consumeRebalance()` reverts. If it targets a
different pool, the `allowedPool` check reverts. Policy is enforced
by state, not by good intentions.

### Problem 3 · Automation without auditability

"I need to read the contract to trust anything" is the hidden tax on
every on-chain AI agent today. Contracts are sprawling, events are
sparse, IDs are inconsistent, and there is no uniform proof format
for evaluators, regulators, or owners to reason about.

**Warrant's answer**: every action is tied to a unique **proofId**
(`bytes32`), which binds together:

- The strategy ID that authorized it
- `proposalHash` — what the Scout asked for
- `executionHash` — the exact parameters executed
- The public-inputs hash the verifier checked
- A `verified` flag and a `consumed` flag (one-shot)

From a single `proofId` an evaluator (or an owner, or a regulator)
can replay the complete chain on any block explorer:

```
StrategyRegistry.createStrategy      (tx 1)
  ↓
ProofVerifier.submitProof            (tx 2)
  ↓
LiquidityVault.executeRebalance      (tx 3 — consumes the warrant)
  ↓
RewardSplitter.recordEpoch           (tx 4 — Treasury accounting)
```

### Problem 4 · The single-wallet blast radius

Most AI agents today run as a *single private key* that creates
strategies, reads pools, signs transactions, and collects fees. One
leak and everything is gone.

**Warrant's answer**: **four role-separated wallets**, each with a
minimum on-chain permission surface:

| Role | Permission (strictly bounded) |
|---|---|
| **Owner** `0x99334FEF...` | Creates strategies; owns vaults |
| **Scout** `0x86b0E1c4...` | Signs warrants — **cannot move funds, cannot call the vault** |
| **Executor** `0x4F5A8Bf1...` | The *only* address allowed to call `vault.executeRebalance` — **cannot create strategies, cannot sign warrants** |
| **Treasury** `0x9A71fB83...` | Writes `RewardSplitter.recordEpoch` — **cannot touch principal** |

Lose one key, and the blast radius stops at whatever that key was
allowed to do. This is the principle of least privilege encoded
directly into the wallet topology.

### Problem 5 · Best-execution is usually an afterthought

The owner's strategy says "LP on xETH/USDT0". A rebalance typically
needs a swap leg to shift token balances — which DEX should that swap
route through?

A Uniswap-only agent goes to Uniswap and stops thinking. In reality,
X Layer hosts several DEXs (OKXSwap, iZUMi, Butter, SushiSwap), and
cross-venue aggregation routinely finds better fills.

**Warrant's answer**: the OKX Onchain OS Skill `okx-dex-swap` is
embedded in the Scout proposal path. Every proposal surfaces **two
quotes side by side**:

- Uniswap QuoterV2 — single-venue, exact pool math
- OKX DEX Aggregator — cross-venue best route, HMAC-signed REST

The UI renders whichever quote is stronger. The Scout is no longer a
naive "Uniswap-only" agent — it is a multi-venue decision surface.

---

## Value by stakeholder

### For LP owners (capital providers)
- **Automation you can sleep through**: AI manages the position, but
  policy breaches revert on-chain
- **Natural-language strategies**: no need to read the v3 docs —
  describe the policy in plain English
- **Hard daily caps**: "2 rebalances per UTC day" is a contract-level
  limit, not a promise
- **Full-chain traceability**: every `proofId` maps to a complete
  on-chain audit trail
- **Role-separated custody**: a single compromised key is not a total
  loss

### For AI-agent builders
- **A ready-made authorization framework**: stop re-inventing proof
  gates from scratch
- **Pluggable verifiers**: ship with ECDSA today
  (`AttestationVerifier`), swap in Groth16 tomorrow with no migration
- **Event standard**: `RebalanceExecuted` carries every parameter
  indexed — downstream agents (Treasury, indexers, subgraphs) subscribe
  and go
- **Plug-and-play wallet topology**: the 4-role model is drop-in

### For DeFi protocols
- **Compliance-ready**: every capital action carries a verifiable
  authorization receipt
- **Indexer-friendly**: critical events use indexed topics so The
  Graph / subgraphs read efficiently
- **Composable**: other protocols can build secondary authorization on
  top of `ProofVerifier.isVerified(proofId)` — e.g., warrant-gated
  flash loans

### For the X Layer ecosystem
- **A trust anchor for "AI + DeFi"**: demonstrates that X Layer can
  host primitive-level infrastructure, not just yet-another-yield-bot
- **A Skill integration reference**: 7 Skill modules (6 Uniswap +
  1 Onchain OS) genuinely exercised, not just name-dropped

---

## How Warrant differs from existing approaches

| Approach | Permission model | Proof mechanism | Role separation | Skill depth |
|---|---|---|---|---|
| **Traditional AI yield bot** | Single-key, full authority | None | None | 1–2 |
| **Gamma / Arrakis** | Protocol permissions + whitelisted strategies | Off-chain reputation | Partial | 2–3 |
| **Gelato / Powerloom** | Task-triggered | Off-chain signatures | Trigger vs. execute | Trigger framework |
| **Brahma Console** | Multisig + preset intents | Intent submission | Submit vs. execute | ~5 |
| **Warrant** | **Dual-hash warrant + 4 wallets** | **ECDSA / zk-SNARK pluggable** | **4 strictly-separated roles** | **7 (incl. Onchain OS)** |

The defining difference: **Warrant makes "proof" — not "signature" —
the necessary condition for capital to move**. Existing approaches
leave a crack open between the protocol and the agent (e.g., keepers
in Gelato have bounded but non-zero execution freedom). Warrant
shrinks that freedom to zero: whatever parameters the Scout committed
to, those are the *only* parameters the Executor can push through.
Any other input, the vault reverts.

---

## Use cases

### Use case 1 · Individual LP owner
Alice has $10k she wants to LP on xETH/USDT0. In Warrant:
> *"medium risk, max 3 moves per day, keep above $5k TVL"*

The strategy lands on-chain. The Scout reads the pool hourly, only
submits a warrant when price drifts more than 30% outside the current
range, and the Executor rebalances automatically. 3-per-day cap is
enforced in the contract. Alice sleeps, travels, works a day job — no
monitoring needed.

### Use case 2 · DAO treasury
A DAO wants 500k USDC deployed as conservative LP on xBTC/USDT0 0.3%.
A 2/3 multisig holds the Owner wallet. Scout runs "low risk, 1 move
per day". Treasury accounting is fully transparent — any DAO member
reads `RewardSplitter` and sees every fee allocation, per epoch.

### Use case 3 · Agent-as-a-Service
A builder offers "Scout signals" as a subscription service. Every time
the Scout signs a warrant, subscribers are notified. Each subscriber
independently decides whether to let their Executor consume the
warrant. The `proofId` becomes the service's product unit.

### Use case 4 · Regulated institutional DeFi
A VC or fund wants to LP on-chain, but compliance requires a
verifiable authorization receipt for every capital move. A Warrant
packet (ECDSA signature + public inputs + consumption state) is that
receipt. Upgrading the verifier to zk-SNARK later even hides sensitive
strategy parameters from public inspection, without changing the
audit trail.

---

## What we have working today

| Capability | Status | Where to look |
|---|---|---|
| 5 contracts deployed on X Layer mainnet (chainId 196) | ✅ Live | `deployments/xlayer-196.json` |
| 4 role-separated agent wallets | ✅ Live | README (explorer links included) |
| Dual-hash warrant binding | ✅ | `contracts/LiquidityVault.sol:116–148` |
| UTC-day budget hard-cap | ✅ | `contracts/StrategyRegistry.sol` |
| Pluggable ECDSA verifier | ✅ | `contracts/AttestationVerifier.sol` |
| Reward-split invariant (`sum ≤ grossFees`) | ✅ | `contracts/RewardSplitter.sol:67` |
| 6 Uniswap Skill modules integrated in depth | ✅ | `lib/uniswap/` (6 files) |
| Onchain OS Skill `okx-dex-swap` (HMAC-signed REST) | ✅ | `lib/okx/dex-aggregator.ts` |
| Production Treasury agent (event listener + on-chain settlement) | ✅ | `agents/treasury-agent.ts` |
| Natural-language strategy compiler | ✅ | `components/demo-provider.tsx` |
| Full product UI: terminal, dashboard, proof center, yield, activity | ✅ | Run `pnpm dev`, open `/terminal` |
| End-to-end happy-path runner (7-Skill depth audit included) | ✅ | `scripts/run-happy-path.ts` |

Per-proposal integration depth (measured live against X Layer mainnet):
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

---

## One-line summary

> **Warrant turns AI-managed DeFi from a trust game into a proof game.
> Owners no longer have to choose between efficiency and safety —
> they get both.**

---

## References

- Repo README: [`README.md`](../README.md)
- Architecture deep-dive: [`docs/architecture.md`](./architecture.md)
- Demo script (90–120 s): [`docs/demo-script.md`](./demo-script.md)
- X post templates: [`docs/x-post-template.md`](./x-post-template.md)
- Submission packet: [`submission/FINAL_PACKET.md`](../submission/FINAL_PACKET.md)
- Live deployment: [`deployments/xlayer-196.json`](../deployments/xlayer-196.json)
- Build X Hackathon: <https://web3.okx.com/vi/xlayer/build-x-hackathon>
- Onchain OS: <https://web3.okx.com/zh-hans/onchainos>
- X Layer network info: <https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information>
