# Google Form Copy Deck

Generated at 2026-04-15T02:54:12.515Z

## Project name

Warrant — Proof-gated Liquidity Agents on X Layer

## One-line description

Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.

## Project intro

Warrant helps owners delegate Uniswap concentrated liquidity management to AI agents without giving them blind authority. The owner defines a strategy once, the Scout Agent proposes a move, the verifier binds the proof to the exact execution parameters, and only then can the Executor Agent touch the LiquidityVault.

## Architecture overview

Owner strategy compiled from natural language -> StrategyRegistry stores guardrails and per-day budgets -> Scout Agent proposes a rebalance and commits both a proposalHash and an executionHash -> ProofVerifier validates the warrant packet and binds it to the strategy id + execution hash -> LiquidityVault recomputes the execution hash on-chain from the RebalanceAction struct and consumes the warrant once -> Treasury Agent records the reward epoch via access-controlled RewardSplitter.

## Onchain OS / Uniswap usage

Every Scout proposal exercises 7 Skill modules (12 live calls): six Uniswap v3 periphery contracts (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02) for live pool state + execution-path simulation, and the Onchain OS okx-dex-swap Skill for HMAC-signed DEX Aggregator cross-venue quotes. Orchestrated across four role-separated agent wallets (Owner, Scout, Executor, Treasury) via the StrategyRegistry → ProofVerifier → LiquidityVault → RewardSplitter pipeline.

## X Layer positioning

Warrant is designed as a native X Layer agentic DeFi application. It depends on low-friction onchain coordination, observable agent behavior, and warrant-backed execution traces that are easy for judges to inspect.

## Demo flow

Compile strategy -> Generate scout proposal -> Verify warrant -> Execute rebalance -> Show reward epoch -> Show blocked move.

