# Build X Submission Draft

## Project name

Warrant — Proof-gated Liquidity Agents on X Layer

## One-line description

Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.

## Project intro

Warrant helps owners delegate Uniswap concentrated liquidity management to AI agents without giving them blind authority. The owner defines a strategy once, the Scout Agent proposes a move and commits both a proposal hash and a concrete execution hash, the verifier binds the warrant to those commitments, and only then can the Executor Agent rebalance the LiquidityVault — under exactly the parameters the scout signed off on.

## Architecture overview

- Owner strategy compiled from natural language
- StrategyRegistry stores guardrails and enforces a per-day rebalance budget that resets at UTC midnight
- Scout Agent proposes a rebalance and commits both `proposalHash` and `executionHash`
- ProofVerifier validates the warrant packet and binds it to the strategy id + execution hash
- LiquidityVault recomputes the execution hash on-chain from the `RebalanceAction` struct and consumes the warrant exactly once before executing the move
- Treasury Agent records fee and reward events via an access-controlled RewardSplitter

## Onchain OS / Uniswap usage

Warrant integrates **two distinct Uniswap Skill modules** plus the
Onchain OS agent orchestration layer. Every Scout proposal fires:

- **UniswapV3Pool** (6 view methods: `slot0`, `liquidity`, `token0`, `token1`, `fee`, `tickSpacing`) against the selected X Layer v3 pool
- **QuoterV2.quoteExactInputSingle** at `0xd1b797d92d87b688193a2b976efc8d577d204343` to simulate the swap leg of the proposed rebalance

All calls are made from the server-side `/api/scout/propose` endpoint,
which returns an explicit `skillCalls` log with the exact contract and
method for each invocation. Onchain OS orchestrates the three agents
(Scout, Executor, Treasury) through `ProofVerifier` + `AttestationVerifier`.

## X Layer positioning

Warrant is designed as a native X Layer agentic DeFi application. It depends on low-friction onchain coordination, observable agent behavior, and warrant-backed execution traces that are easy for judges to inspect. The Scout agent reads live state from the canonical X Layer Uniswap v3 deployment, not a testnet fork.

## Deployment addresses

All 5 contracts are live on **X Layer mainnet (chainId 196)**. See
`deployments/xlayer-196.json` for the authoritative manifest.

- StrategyRegistry:   `0x531eC789d3627bF3fd511010791C1EfFc63c2DA6`
- ProofVerifier:      `0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8`
- AttestationVerifier: `0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2`
- LiquidityVault:     `0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC`
- RewardSplitter:     `0x81AdD46B05407146B049116C66eDF2B879eCc06e`

## Agent wallet roles (live on X Layer mainnet)

- Owner Wallet: `0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061` — owns policy and capital
- Scout Agent Wallet: `0x86b0E1c48d39D58304939c0681818F0E1c1e8d83` — proposes warrant-backed rebalances and signs AttestationVerifier payloads
- Executor Agent Wallet: `0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9` — the only address allowed to call `LiquidityVault.executeRebalance`
- Treasury Agent Wallet: `0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0` — authorized recorder on `RewardSplitter`

## Demo flow

1. Compile strategy from terminal
2. Generate scout proposal
3. Verify warrant
4. Execute rebalance
5. Show reward epoch and blocked move
