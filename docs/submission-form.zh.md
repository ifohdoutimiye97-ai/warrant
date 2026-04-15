# Build X 提交文案草稿

## 项目名称

Warrant — Proof-gated Liquidity Agents on X Layer

## 一句话介绍

Warrant 是一个部署在 X Layer 上的 proof-gated AI 流动性代理系统。每一次 AI 调仓都必须先通过一张 warrant（证明凭证），证明该操作遵守 Owner 预设策略后，资金才能动。No warrant, no move.

## 项目简介

Warrant 解决的是 AI Agent 管理 DeFi 流动性时的"可验证执行"问题。Owner 用自然语言定义策略后，Scout Agent 负责观察池子、提出调仓建议，并同时提交 `proposalHash`（做什么）和 `executionHash`（以什么参数做）。Verifier 把 warrant 绑定到这两个哈希，只有执行时提交的实际参数能在合约里重算出同一个 `executionHash`，LiquidityVault 才会放行。Treasury Agent 之后在权限受控的 RewardSplitter 中记录手续费和奖励 epoch。

## 架构概述

- 自然语言策略输入
- StrategyRegistry 上链登记规则，并强制执行按 UTC 日自动归零的每日调仓上限
- Scout Agent 生成调仓提议，同时承诺 `proposalHash` 与 `executionHash`
- ProofVerifier 校验 warrant 并将其与 strategy id + execution hash 绑定
- LiquidityVault 在链上用 `RebalanceAction` 结构体重新计算执行哈希，确认无误后**一次性消费** warrant 再执行 add / remove / rebalance
- Treasury Agent 通过权限受控的 RewardSplitter 记录收益与奖励

## Onchain OS / Uniswap 使用情况

Warrant 集成了**两个独立的 Uniswap Skill 核心模块** + Onchain OS 的
Agent 编排层。每一次 Scout 提案都会触发：

- **UniswapV3Pool**（6 个 view 方法：`slot0`、`liquidity`、`token0`、`token1`、`fee`、`tickSpacing`）对选定的 X Layer v3 pool
- **QuoterV2.quoteExactInputSingle**（合约地址 `0xd1b797d92d87b688193a2b976efc8d577d204343`）模拟提案的 swap 腿

所有调用都在服务端 `/api/scout/propose` 路由中完成，响应里会显式
返回 `skillCalls` 数组，记录这次请求命中了哪些 Skill 合约和方法。
Onchain OS 通过 `ProofVerifier` + `AttestationVerifier` 串联 Scout、
Executor、Treasury 三个 agent 的状态流转。

## X Layer 生态定位

Warrant 是一个原生面向 X Layer 的 agentic DeFi 应用。它强调链上可观察 Agent 行为、低摩擦执行，以及 warrant-backed 的可验证执行路径，完美契合 Build X 的评审逻辑。Scout agent 读取的是 X Layer 主网上正式的 Uniswap v3 部署，不是 testnet fork。

## 部署地址

5 个合约均已上线 **X Layer 主网（chainId 196）**。权威 manifest：
`deployments/xlayer-196.json`。

- StrategyRegistry:    `0x531eC789d3627bF3fd511010791C1EfFc63c2DA6`
- ProofVerifier:       `0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8`
- AttestationVerifier: `0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2`
- LiquidityVault:      `0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC`
- RewardSplitter:      `0x81AdD46B05407146B049116C66eDF2B879eCc06e`

## Agent 钱包身份（均已上链 X Layer 主网）

- Owner Wallet：`0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061` — 拥有策略和资金
- Scout Agent Wallet：`0x86b0E1c48d39D58304939c0681818F0E1c1e8d83` — 提交 warrant 提案并签署 AttestationVerifier payload
- Executor Agent Wallet：`0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9` — 唯一有权调用 `LiquidityVault.executeRebalance` 的地址
- Treasury Agent Wallet：`0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0` — `RewardSplitter` 授权记录者

## Demo 流程

1. 在 terminal 中编译策略
2. 生成 scout proposal
3. 验证 warrant
4. 执行 rebalance
5. 展示收益记录和被策略拦截的场景
