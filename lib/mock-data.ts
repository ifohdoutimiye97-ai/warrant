import {
  DEFAULT_MAX_REBALANCES_PER_DAY,
  DEFAULT_POOL,
  DEFAULT_RISK,
  INITIAL_POSITION,
  SAMPLE_PROOF_ID,
  SAMPLE_STRATEGY_HASH,
} from "@/lib/demo-constants";

export type StrategyParam = { label: string; value: string };
export type PositionState = { pool: string; range: string; tvl: string; fees: string };
export type AgentStatusItem = { name: string; status: string; description: string };
export type ActivityItem = {
  id: string;
  time: string;
  status: string;
  kind: "success" | "action" | "blocked";
  title: string;
  description: string;
  agent: string;
  reference: string;
};
export type ProofCheck = { label: string; value: string; pass: boolean };
export type YieldRecord = { id: string; date: string; event: string; pnl: string; proof: string };
export type TerminalMessage = {
  id: string;
  role: "owner" | "agent" | "system";
  text: string;
  accent?: "default" | "success" | "warning";
};

export const heroMetrics = [
  {
    label: "Primary primitive",
    value: "Proof-gated",
    note: "The vault cannot rebalance until the proof verifier clears the move.",
  },
  {
    label: "Arena fit",
    value: "X Layer Arena",
    note: "A full-stack product with agent orchestration, liquidity actions, and onchain records.",
  },
  {
    label: "Core integrations",
    value: "Onchain OS + Uniswap",
    note: "Agents orchestrate the workflow and target Uniswap liquidity operations.",
  },
  {
    label: "MVP posture",
    value: "Single pool",
    note: "One pool, one strategy family, one crisp demo loop instead of an overgrown protocol.",
  },
];

export const systemRoles = [
  {
    name: "Scout Agent",
    tag: "Observe + propose",
    description:
      "Reads pool state, checks declared thresholds, and proposes a new active range before generating a proof artifact.",
  },
  {
    name: "Executor Agent",
    tag: "Verify + rebalance",
    description:
      "Submits the proof to the verifier and performs add, remove, or rebalance actions only after the proof gate succeeds.",
  },
  {
    name: "Treasury Agent",
    tag: "Record + settle",
    description:
      "Tracks realized fees, emits reward events, and updates the readable audit trail for owners and judges.",
  },
];

export const flowSteps = [
  {
    step: "01",
    title: "Declare a strategy",
    description:
      "An owner describes risk level, rebalance frequency, and the allowed X Layer Uniswap pool in plain language.",
  },
  {
    step: "02",
    title: "Register constraints",
    description:
      "The strategy registry stores the machine-readable constraints that the proof circuit will later enforce.",
  },
  {
    step: "03",
    title: "Generate a proof-backed proposal",
    description:
      "The Scout Agent proposes a range move and packages a proof that it respects the registered policy.",
  },
  {
    step: "04",
    title: "Verify before execution",
    description:
      "The proof verifier clears the move, and only then can the executor touch capital in the liquidity vault.",
  },
  {
    step: "05",
    title: "Settle and publish the trail",
    description:
      "Yield, proof IDs, and vault events are written into an activity stream that is easy to show in demos.",
  },
];

export const strategyPreview: StrategyParam[] = [
  { label: "Risk profile", value: DEFAULT_RISK },
  { label: "Pool", value: DEFAULT_POOL },
  { label: "Max rebalances per day", value: String(DEFAULT_MAX_REBALANCES_PER_DAY) },
  { label: "Allowed chain", value: "X Layer" },
  { label: "Policy family", value: "Single-range CL" },
  { label: "Proof mode", value: "Constraint witness" },
];

export const dashboardMetrics = [
  {
    label: "Current vault TVL",
    value: INITIAL_POSITION.tvl,
    note: "Demo value for one pool and one strategy family.",
  },
  {
    label: "Active range",
    value: INITIAL_POSITION.range,
    note: "Price band selected by the most recent verified rebalance.",
  },
  {
    label: "Fees collected",
    value: INITIAL_POSITION.fees,
    note: "Net fees attributed to the active position during the demo window.",
  },
  {
    label: "Proof success rate",
    value: "100%",
    note: "No capital moves without an accepted proof packet.",
  },
];

export const openPosition: PositionState = { ...INITIAL_POSITION };

export const agentStates: AgentStatusItem[] = [
  {
    name: "Scout",
    status: "Monitoring",
    description: "Watching current pool state and waiting for threshold drift before proposing a move.",
  },
  {
    name: "Executor",
    status: "Idle",
    description: "Ready to rebalance after a fresh proof clears the verifier contract.",
  },
  {
    name: "Treasury",
    status: "Reconciling",
    description: "Preparing fee snapshots, reward events, and owner-facing summaries.",
  },
];

export const activityFeed: ActivityItem[] = [
  {
    id: "evt-1",
    time: "20:04 UTC+8",
    status: "Verified",
    kind: "success",
    title: "Proof cleared for range shift",
    description:
      "Scout generated a valid witness that the new price band respects the owner policy and daily rebalance cap.",
    agent: "Scout Agent",
    reference: SAMPLE_PROOF_ID,
  },
  {
    id: "evt-2",
    time: "20:06 UTC+8",
    status: "Executed",
    kind: "action",
    title: "Executor updated the active LP range",
    description:
      "LiquidityVault completed a rebalance after verifier approval and emitted the vault update event.",
    agent: "Executor Agent",
    reference: "tx_0x4e7d...a8c2",
  },
  {
    id: "evt-3",
    time: "20:09 UTC+8",
    status: "Blocked",
    kind: "blocked",
    title: "Second proposal rejected by policy gate",
    description:
      "A new rebalance attempt was skipped because the strategy already consumed its daily move budget.",
    agent: "ProofVerifier",
    reference: "rejection_daily_cap",
  },
  {
    id: "evt-4",
    time: "20:12 UTC+8",
    status: "Settled",
    kind: "success",
    title: "Treasury recorded fee growth",
    description:
      "Treasury Agent updated the internal fee ledger and emitted a reward-ready accounting event.",
    agent: "Treasury Agent",
    reference: "reward_epoch_12",
  },
];

export const proofChecks: ProofCheck[] = [
  { label: "Strategy hash", value: SAMPLE_STRATEGY_HASH, pass: true },
  { label: "Allowed pool matched", value: DEFAULT_POOL, pass: true },
  {
    label: "Daily rebalance cap",
    value: `${DEFAULT_MAX_REBALANCES_PER_DAY} / ${DEFAULT_MAX_REBALANCES_PER_DAY} remaining before this move`,
    pass: true,
  },
  { label: "Risk class respected", value: DEFAULT_RISK, pass: true },
  { label: "Verifier output", value: "Accepted", pass: true },
];

export const yieldRecords: YieldRecord[] = [
  {
    id: "yield-1",
    date: "Apr 09",
    event: "Initial liquidity deployment",
    pnl: "+$0.00",
    proof: "proof_bootstrap",
  },
  {
    id: "yield-2",
    date: "Apr 10",
    event: "Verified rebalance #1",
    pnl: "+$64.18",
    proof: SAMPLE_PROOF_ID,
  },
  {
    id: "yield-3",
    date: "Apr 11",
    event: "No move - strategy held",
    pnl: "+$41.74",
    proof: "proof_hold_position",
  },
  {
    id: "yield-4",
    date: "Apr 12",
    event: "Verified rebalance #2",
    pnl: "+$88.30",
    proof: "proof_0xa77b...9dc4",
  },
];

export const terminalMessages: TerminalMessage[] = [
  {
    id: "msg-1",
    role: "system",
    text: "Warrant terminal ready. Available commands: create strategy, scout proposal, verify proof, execute rebalance, hold position, status, reset. No warrant, no move.",
    accent: "default",
  },
  {
    id: "msg-2",
    role: "agent",
    text: "Try: Run a medium-risk ETH/USDC strategy on X Layer with 2 rebalances per day.",
    accent: "success",
  },
];

export const terminalSuggestions = [
  "① Compile strategy",
  "② Scout proposal",
  "③ Verify proof",
  "④ Execute rebalance",
  "Hold position",
  "Status",
  "Reset",
];
