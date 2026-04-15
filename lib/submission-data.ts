import {
  DEFAULT_MAX_REBALANCES_PER_DAY,
  DEFAULT_POOL,
  DEFAULT_RISK,
  SAMPLE_EXECUTION_HASH,
  SAMPLE_PROOF_ID,
  SAMPLE_PROPOSAL_HASH,
  SAMPLE_PUBLIC_INPUTS_HASH,
  SAMPLE_STRATEGY_HASH,
} from "@/lib/demo-constants";
import { X_LAYER_MAINNET } from "@/config/networks";

export const submissionOverview = {
  projectName: "Warrant — Proof-gated Liquidity Agents on X Layer",
  shortPitch:
    "Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.",
  category: "X Layer Arena",
  primaryIntegrations: [
    "X Layer (chainId 196)",
    "Uniswap Skills · 6 modules (V3Pool, QuoterV2, TickLens, V3Factory, NFPM, SwapRouter02)",
    "Onchain OS Skill · okx-dex-swap (DEX Aggregator, HMAC-signed)",
  ],
  targetPool: "xETH / USDT0 · Uniswap v3 0.05% · 0x77ef18ad…",
  skillIntegrationDepth: {
    uniqueSkills: 7,
    callsPerProposal: 12,
    platforms: {
      uniswap: [
        "uniswap-v3-pool",
        "uniswap-quoter-v2",
        "uniswap-tick-lens",
        "uniswap-v3-factory",
        "uniswap-nfpm",
        "uniswap-swap-router-02",
      ],
      onchainOs: ["okx-dex-swap"],
    },
  },
};

export const agentIdentities = [
  {
    name: "Owner Wallet",
    role: "Creates strategies and owns the vault policy.",
    address: "0x99334FEFCc30E33F4D29302fbb18E5b6B7e68061",
  },
  {
    name: "Scout Agent Wallet",
    role: "Observes pool state and submits warrant-backed rebalance proposals. Also the authorized AttestationVerifier signer.",
    address: "0x86b0E1c48d39D58304939c0681818F0E1c1e8d83",
  },
  {
    name: "Executor Agent Wallet",
    role: "The only address allowed to call LiquidityVault.executeRebalance.",
    address: "0x4F5A8Bf1A3F38E1a336cD4ce2da023715492a7B9",
  },
  {
    name: "Treasury Agent Wallet",
    role: "Authorized recorder on RewardSplitter alongside the vault.",
    address: "0x9A71fB837afFb66348250BC8F74b3A6b4F122EE0",
  },
];

export const deploymentManifest = {
  network: X_LAYER_MAINNET.name,
  chainId: X_LAYER_MAINNET.chainId,
  rpc: X_LAYER_MAINNET.rpc,
  blockExplorer: X_LAYER_MAINNET.blockExplorer,
  contracts: [
    {
      name: "StrategyRegistry",
      address: "0x531eC789d3627bF3fd511010791C1EfFc63c2DA6",
      purpose: "Stores owner-declared strategy constraints and per-UTC-day move caps.",
    },
    {
      name: "ProofVerifier",
      address: "0xe157673b3FC3C7f02655982F1EfA32eC7383dFe8",
      purpose: "Binds warrants to (strategyId, proposalHash, executionHash) and exposes the single-use consume gate.",
    },
    {
      name: "AttestationVerifier",
      address: "0x9c0AC1C1997a8129E62A8fF60Eae4F23AB345cB2",
      purpose: "ECDSA attestation verifier plugged into ProofVerifier. Accepts warrants signed by the Scout Agent.",
    },
    {
      name: "LiquidityVault",
      address: "0xbFFc45c976D0518E2B023c1f6e68fDD4339d76FC",
      purpose: "Holds owner capital. Recomputes executionHash on-chain from the RebalanceAction struct before consuming a warrant.",
    },
    {
      name: "RewardSplitter",
      address: "0x81AdD46B05407146B049116C66eDF2B879eCc06e",
      purpose: "Access-controlled epoch recorder with scoutReward + executorReward + treasuryReward \u2264 grossFees invariant.",
    },
  ],
};

export const artifactInventory = [
  {
    name: "StrategyRegistry artifact",
    path: "artifacts/contracts/StrategyRegistry.sol/StrategyRegistry.json",
    status: "Ready",
  },
  {
    name: "ProofVerifier artifact",
    path: "artifacts/contracts/ProofVerifier.sol/ProofVerifier.json",
    status: "Ready",
  },
  {
    name: "LiquidityVault artifact",
    path: "artifacts/contracts/LiquidityVault.sol/LiquidityVault.json",
    status: "Ready",
  },
  {
    name: "RewardSplitter artifact",
    path: "artifacts/contracts/RewardSplitter.sol/RewardSplitter.json",
    status: "Ready",
  },
  {
    name: "Deployment manifest template",
    path: "deployments/xlayer-template.json",
    status: "Ready",
  },
  {
    name: "Sample proof packet",
    path: "proofs/sample-proof-packet.json",
    status: "Ready",
  },
];

export const skillUsage = [
  {
    name: "Uniswap Skills (6 modules)",
    detail:
      "Every Scout proposal exercises six canonical Uniswap v3 periphery modules: UniswapV3Pool (slot0, liquidity, token0/1, fee, tickSpacing), QuoterV2 (quoteExactInputSingle), TickLens (getPopulatedTicksInWord), V3Factory (getPool canonical-address check), NonfungiblePositionManager (balanceOf + positions inventory), and SwapRouter02 (exactInputSingle static-call). Source: lib/uniswap/* + app/api/scout/propose/route.ts.",
  },
  {
    name: "Onchain OS Skill — okx-dex-swap",
    detail:
      "HMAC-signed calls to the OKX DEX Aggregator (/api/v5/dex/aggregator/quote) from lib/okx/dex-aggregator.ts, surfaced to the Scout flow and to a standalone /api/okx/quote route. This is the okx-dex-swap Skill from the okx/onchainos-skills package, giving warrants cross-venue best-route quotes (not just Uniswap-only).",
  },
  {
    name: "Onchain OS orchestration layer",
    detail:
      "Four role-separated agent wallets (Owner, Scout, Executor, Treasury) share state through StrategyRegistry + ProofVerifier + LiquidityVault + RewardSplitter. Scout signs warrants, Executor is the only caller on LiquidityVault.executeRebalance, Treasury listens to RebalanceExecuted events and calls RewardSplitter.recordEpoch via the production TreasuryAgent class (agents/treasury-agent.ts).",
  },
];

export const proofPacket = {
  proofId: SAMPLE_PROOF_ID,
  strategyId: 1,
  strategyHash: SAMPLE_STRATEGY_HASH,
  proposalHash: SAMPLE_PROPOSAL_HASH,
  executionHash: SAMPLE_EXECUTION_HASH,
  publicInputsHash: SAMPLE_PUBLIC_INPUTS_HASH,
  allowedPool: DEFAULT_POOL,
  riskLevel: DEFAULT_RISK,
  maxRebalancesPerDay: DEFAULT_MAX_REBALANCES_PER_DAY,
  remainingAfterMove: DEFAULT_MAX_REBALANCES_PER_DAY - 1,
  verifierStatus: "Accepted",
  verifierBackend: "embedded-demo-mode",
  consumed: false,
};

export const teamTemplate = [
  {
    field: "Team name",
    value: "X Builder",
  },
  {
    field: "Builder 1",
    value: "X Builder",
  },
  {
    field: "Builder 2",
    value: "—",
  },
];

export const submissionLinks = [
  {
    field: "Demo video",
    value: "TBD_VIDEO_LINK",
  },
  {
    field: "GitHub repo",
    value: "https://github.com/ifohdoutimiye97-ai/warrant",
  },
  {
    field: "X or Moltbook post",
    value: "TBD_SOCIAL_LINK",
  },
];

export const submissionChecklist = [
  "Public GitHub repo",
  "README with intro, architecture, deployment info, integrations, mechanism, team, and X Layer fit",
  "Agent wallet identities documented",
  "X Layer deployment addresses filled in",
  "Demo video link",
  "X or Moltbook post link",
];

/**
 * Real on-chain transactions executed by `pnpm tsx scripts/run-happy-path.ts`
 * against X Layer mainnet (chainId 196, block 57449597, 2026-04-15).
 * Every hash is a live, inspectable record of the warrant lifecycle.
 */
export const happyPathTransactions = [
  {
    step: "StrategyRegistry.createStrategy",
    actor: "Owner",
    txHash: "0x16d759234fbc708056c198e4ef9dde431b248d2fa1595c852381a2a026bf1465",
  },
  {
    step: "LiquidityVault.createVault",
    actor: "Owner",
    txHash: "0xeda72f9fc66d6787a30ac2c6c6f00266c10b3dd3c57a772a3deed58d8bd126c8",
  },
  {
    step: "ProofVerifier.submitProof",
    actor: "Scout",
    txHash: "0x0b2e7e29e00bcdfb25bdc6a26f4168d05bc675a29bdf287b54f7f642561e735f",
  },
  {
    step: "LiquidityVault.executeRebalance",
    actor: "Executor",
    txHash: "0x475e0e22c55a22d16b837d9e552784c41402a2fecf186c6f920a5deacb326800",
  },
  {
    step: "RewardSplitter.recordEpoch",
    actor: "Treasury",
    txHash: "0x9afdacf816a50c861226883ebd2ef323cfa2dbab22dc277c1b09f0961f40d520",
  },
];

export const happyPathVerifiedFacts = {
  chainId: 196,
  block: 57449597,
  pool: "0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc",
  poolLabel: "USD₮0 / xETH 0.05%",
  strategyId: 3,
  vaultId: 3,
  currentTick: 198759,
  priceToken1InToken0: "2335.659122 USD₮0 per xETH",
  proposedRangeLowerTick: 198570,
  proposedRangeUpperTick: 198940,
  proposalHash: "0x654f99d32acdb1ff443fe40949a54c9b77c281ba5e05cde8b61a02f8570a9bae",
  executionHash: "0x2c442aedda153893b8ed7bf6ff04748fa213fa5141749896c16f463be65606f3",
  proofId: "0x3043df43f567248a4cd3a561d54bc6ab2fa4248c7a14d59dc2ca633d5911e158",
  gasUsedExecuteRebalance: 74379,
  epochId: 2,
  rewardSplit: { scout: 300, executor: 300, treasury: 400, retained: 0, grossFees: 1000 },
  skillAuditPassed: [
    "uniswap-v3-pool (6 view methods)",
    "uniswap-quoter-v2 (quoteExactInputSingle)",
    "uniswap-tick-lens (word 77, 6 initialized ticks)",
    "uniswap-v3-factory (canonical pool match = true)",
    "uniswap-nfpm (balance=0, fresh-mint path)",
    "uniswap-swap-router-02 (staticCall revert = expected without allowance)",
  ],
};

export const submissionFormCopy = [
  {
    field: "Project name",
    value: "Warrant — Proof-gated Liquidity Agents on X Layer",
  },
  {
    field: "One-line description",
    value:
      "Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move until a warrant clears the verifier. No warrant, no move.",
  },
  {
    field: "Project intro",
    value:
      "Warrant helps owners delegate Uniswap concentrated liquidity management to AI agents without giving them blind authority. The owner defines a strategy once, the Scout Agent proposes a move, the verifier binds the proof to the exact execution parameters, and only then can the Executor Agent touch the LiquidityVault.",
  },
  {
    field: "Architecture overview",
    value:
      "Owner strategy compiled from natural language -> StrategyRegistry stores guardrails and per-day budgets -> Scout Agent proposes a rebalance and commits both a proposalHash and an executionHash -> ProofVerifier validates the warrant packet and binds it to the strategy id + execution hash -> LiquidityVault recomputes the execution hash on-chain from the RebalanceAction struct and consumes the warrant once -> Treasury Agent records the reward epoch via access-controlled RewardSplitter.",
  },
  {
    field: "Onchain OS / Uniswap usage",
    value:
      "Every Scout proposal exercises 7 Skill modules (12 live calls): six Uniswap v3 periphery contracts (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02) for live pool state + execution-path simulation, and the Onchain OS okx-dex-swap Skill for HMAC-signed DEX Aggregator cross-venue quotes. Orchestrated across four role-separated agent wallets (Owner, Scout, Executor, Treasury) via the StrategyRegistry → ProofVerifier → LiquidityVault → RewardSplitter pipeline.",
  },
  {
    field: "X Layer positioning",
    value:
      "Warrant is designed as a native X Layer agentic DeFi application. It depends on low-friction onchain coordination, observable agent behavior, and warrant-backed execution traces that are easy for judges to inspect.",
  },
  {
    field: "Demo flow",
    value: "Compile strategy -> Generate scout proposal -> Verify warrant -> Execute rebalance -> Show reward epoch -> Show blocked move.",
  },
];

export const submissionCommands = [
  {
    name: "Build app",
    command: "pnpm build",
    note: "Generates the production-ready Next.js build judges can reproduce locally.",
  },
  {
    name: "Compile contracts",
    command: "pnpm contracts:compile",
    note: "Refreshes artifacts for StrategyRegistry, ProofVerifier, LiquidityVault, and RewardSplitter.",
  },
  {
    name: "Bundle submission packet",
    command: "pnpm submission:bundle",
    note: "Generates markdown and JSON packets under submission/ for the Google Form and repo handoff.",
  },
  {
    name: "Run readiness check",
    command: "pnpm submission:check",
    note: "Flags remaining placeholders, missing deployment files, and still-pending live submission items.",
  },
];

export const readinessTasks = [
  {
    title: "Interactive terminal flow",
    status: "Done",
    note: "Owners can drive create, verify, execute, hold, reset, and the Live Scout flow (real Uniswap v3 read against X Layer) from a single terminal surface.",
  },
  {
    title: "Submission-ready README",
    status: "Done",
    note: "README includes product intro, architecture, Skill integration details, operation mechanism, team placeholders, and X Layer positioning.",
  },
  {
    title: "Contract compile and deploy scripts",
    status: "Done",
    note: "Local compile/deploy scripts + invariant test suite + agent wallet generator all in place.",
  },
  {
    title: "Real verifier implementation",
    status: "Done",
    note: "AttestationVerifier.sol ships as the default IZkVerifier implementation. Accepts ECDSA signatures from a pre-authorized scout signer over (strategyId, proposalHash, executionHash). Swappable for a zk-SNARK verifier via ProofVerifier.setVerifier.",
  },
  {
    title: "Uniswap Skill integration — 6 modules",
    status: "Done",
    note: "lib/uniswap/* wires six Uniswap v3 periphery contracts (UniswapV3Pool, QuoterV2, TickLens, V3Factory, NonfungiblePositionManager, SwapRouter02). Every Scout proposal via /api/scout/propose exercises all six in a single pass, returning a skillCalls log. Live-tested against X Layer mainnet (USD₮0/xETH 0.05%).",
  },
  {
    title: "Onchain OS Skill integration — okx-dex-swap",
    status: "Done",
    note: "lib/okx/dex-aggregator.ts + /api/okx/quote wire the okx-dex-swap Skill from okx/onchainos-skills via HMAC-SHA256 signed REST calls to /api/v5/dex/aggregator/quote. The HMAC auth path is fully implemented; it degrades gracefully to a structured 'unconfigured' response when OKX credentials are absent.",
  },
  {
    title: "Production Treasury Agent",
    status: "Done",
    note: "agents/treasury-agent.ts ships a real class with settleEpochOnchain (broadcasts RewardSplitter.recordEpoch) and watchAndSettle (subscribes to RebalanceExecuted events). Exercised end-to-end in scripts/run-happy-path.ts.",
  },
  {
    title: "Real X Layer deployment addresses",
    status: "Done",
    note: "Deployed to X Layer mainnet (chainId 196) on 2026-04-12. StrategyRegistry 0x531eC789, ProofVerifier 0xe157673b, AttestationVerifier 0x9c0AC1C1, LiquidityVault 0xbFFc45c9, RewardSplitter 0x81AdD46B. Manifest: deployments/xlayer-196.json.",
  },
  {
    title: "Demo and social links",
    status: "Pending",
    note: "Video link and X or Moltbook link are still placeholders and must be recorded before submission.",
  },
];
