"use client";

import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  activityFeed,
  agentStates as initialAgentStates,
  openPosition as initialPosition,
  proofChecks as initialProofChecks,
  strategyPreview as initialStrategyPreview,
  terminalMessages as initialTerminalMessages,
  terminalSuggestions,
  yieldRecords as initialYieldRecords,
  type ActivityItem,
  type AgentStatusItem,
  type PositionState,
  type ProofCheck,
  type StrategyParam,
  type TerminalMessage,
  type YieldRecord,
} from "@/lib/mock-data";
import {
  DEFAULT_MAX_REBALANCES_PER_DAY,
  DEFAULT_PROMPT,
  DEFAULT_RANGE_FALLBACK,
  SAMPLE_PROOF_ID,
} from "@/lib/demo-constants";
import { requestScoutProposal, type ScoutSkillCall } from "@/lib/scout-client";
import type { QuoteResult } from "@/lib/uniswap/quoter";
import type { RebalanceAction, RiskProfile } from "@/lib/uniswap/scout";

type ProofStatus = "idle" | "proposed" | "verified" | "executed" | "blocked";

export type LiveProposal = {
  chainId: number;
  networkName: string;
  proposalHash: string;
  executionHash: string;
  action: RebalanceAction;
  rationale: string;
  blockNumber: number;
  observedAtIso: string;
  token0Symbol: string;
  token1Symbol: string;
  feeBps: number;
  priceToken1InToken0: string;
  quote: QuoteResult | null;
  skillCalls: ScoutSkillCall[];
};

type DemoContextValue = {
  prompt: string;
  strategyPreview: StrategyParam[];
  position: PositionState;
  agentStates: AgentStatusItem[];
  activity: ActivityItem[];
  proofChecks: ProofCheck[];
  yieldRecords: YieldRecord[];
  proofStatus: ProofStatus;
  currentProofId: string;
  rebalancesToday: number;
  maxRebalancesPerDay: number;
  terminalMessages: TerminalMessage[];
  terminalSuggestions: string[];
  isBusy: boolean;
  liveProposal: LiveProposal | null;
  setPrompt: (prompt: string) => void;
  generateStrategy: (overridePrompt?: string) => void;
  runScoutProposal: () => void;
  runLiveScoutProposal: (input: {
    chainId: number;
    strategyId?: number;
    risk: RiskProfile;
    recipient: string;
    poolAddress?: string;
  }) => Promise<void>;
  clearLiveProposal: () => void;
  verifyProof: () => void;
  executeRebalance: () => void;
  simulateBlockedMove: () => void;
  runTerminalCommand: (command: string) => void;
  resetDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function cloneItems<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }) + " UTC+8";
}

function createProofId(index: number) {
  return `proof_0x${(0x91af + index * 433).toString(16)}...${(0xb17d + index * 19).toString(16)}`;
}

function createTxHash(index: number) {
  return `tx_0x${(0x4e7d + index * 111).toString(16)}...${(0xa8c2 + index * 17).toString(16)}`;
}

function parseMaxRebalances(prompt: string) {
  const match = prompt.match(/(\d+)\s*(?:rebalances?|moves?)\s*(?:per day|daily)/i);
  return match ? Number(match[1]) : DEFAULT_MAX_REBALANCES_PER_DAY;
}

function parseRisk(prompt: string) {
  if (/low[-\s]?risk/i.test(prompt)) return "Low";
  if (/high[-\s]?risk/i.test(prompt)) return "High";
  return "Medium";
}

function parsePool(prompt: string) {
  if (/wbtc/i.test(prompt)) return "WBTC / USDC";
  if (/usdt/i.test(prompt)) return "WETH / USDT";
  return "WETH / USDC";
}

function compileStrategy(prompt: string): StrategyParam[] {
  const risk = parseRisk(prompt);
  const pool = parsePool(prompt);
  const dailyCap = String(parseMaxRebalances(prompt));

  return [
    { label: "Risk profile", value: risk },
    { label: "Pool", value: pool },
    { label: "Max rebalances per day", value: dailyCap },
    { label: "Allowed chain", value: "X Layer" },
    { label: "Policy family", value: "Single-range CL" },
    { label: "Proof mode", value: "Constraint witness" },
  ];
}

function updateAgentState(
  items: AgentStatusItem[],
  updates: Record<string, Pick<AgentStatusItem, "status" | "description">>,
) {
  return items.map((item) =>
    updates[item.name]
      ? {
          ...item,
          status: updates[item.name].status,
          description: updates[item.name].description,
        }
      : item,
  );
}

function textIncludes(input: string, patterns: string[]) {
  const normalized = input.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function parseCurrency(value: string) {
  const normalized = value.replace(/[$,]/g, "").replace(/k$/i, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatKUsd(thousands: number) {
  return `$${thousands.toFixed(1)}k`;
}

function parseRangeBounds(range: string): [number, number] {
  const parts = range.split(" - ").map((part) => Number(part.replace(/,/g, "")));
  const lower = parts[0];
  const upper = parts[1];
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return DEFAULT_RANGE_FALLBACK;
  }
  return [lower, upper];
}

function formatRange(lower: number, upper: number) {
  return `${lower.toLocaleString("en-US")} - ${upper.toLocaleString("en-US")}`;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [strategyPreview, setStrategyPreview] = useState<StrategyParam[]>(cloneItems(initialStrategyPreview));
  const [position, setPosition] = useState<PositionState>({ ...initialPosition });
  const [agentStates, setAgentStates] = useState<AgentStatusItem[]>(cloneItems(initialAgentStates));
  const [activity, setActivity] = useState<ActivityItem[]>(cloneItems(activityFeed));
  const [proofChecks, setProofChecks] = useState<ProofCheck[]>(cloneItems(initialProofChecks));
  const [yieldRecords, setYieldRecords] = useState<YieldRecord[]>(cloneItems(initialYieldRecords));
  const [proofStatus, setProofStatus] = useState<ProofStatus>("idle");
  const [currentProofId, setCurrentProofId] = useState(SAMPLE_PROOF_ID);
  const [rebalancesToday, setRebalancesToday] = useState(0);
  const [maxRebalancesPerDay, setMaxRebalancesPerDay] = useState(DEFAULT_MAX_REBALANCES_PER_DAY);
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>(cloneItems(initialTerminalMessages));
  const [cycle, setCycle] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [consumedProofIds, setConsumedProofIds] = useState<Set<string>>(() => new Set());
  const [liveProposal, setLiveProposal] = useState<LiveProposal | null>(null);

  const clearLiveProposal = () => setLiveProposal(null);

  const addActivity = (item: ActivityItem) => {
    setActivity((current) => [item, ...current].slice(0, 8));
  };

  const addTerminalMessage = (message: TerminalMessage) => {
    setTerminalMessages((current) => [...current, message].slice(-18));
  };

  const updateProofLine = (label: string, value: string, pass = true) => {
    setProofChecks((current) =>
      current.map((item) =>
        item.label === label
          ? {
              ...item,
              value,
              pass,
            }
          : item,
      ),
    );
  };

  const generateStrategy = (overridePrompt?: string) => {
    setIsBusy(true);

    // Explicit override avoids the stale-closure bug where a fresh prompt
    // set via setPrompt() hasn't landed in state yet when we compile.
    const source = overridePrompt ?? prompt;
    if (overridePrompt !== undefined) {
      setPrompt(overridePrompt);
    }

    startTransition(() => {
      const compiled = compileStrategy(source);
      const dailyCap = Number(compiled.find((item) => item.label === "Max rebalances per day")?.value ?? "2");
      const pool = compiled.find((item) => item.label === "Pool")?.value ?? "WETH / USDC";
      const risk = compiled.find((item) => item.label === "Risk profile")?.value ?? "Medium";

      setStrategyPreview(compiled);
      setMaxRebalancesPerDay(dailyCap);
      setProofStatus("idle");
      setRebalancesToday(0);
      setConsumedProofIds(new Set());
      setLiveProposal(null);
      setPosition((current) => ({
        ...current,
        pool: `X Layer Uniswap ${pool}`,
      }));
      updateProofLine("Allowed pool matched", pool);
      updateProofLine("Risk class respected", risk);
      updateProofLine("Daily rebalance cap", `${dailyCap} / ${dailyCap} remaining before this move`);
      updateProofLine("Verifier output", "Awaiting proposal", false);

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Ready",
            description: "Strategy compiled. Waiting to build the next proof-backed rebalance proposal.",
          },
          Executor: {
            status: "Idle",
            description: "Standing by for a verified proof packet before touching the vault.",
          },
          Treasury: {
            status: "Standby",
            description: "No settlement yet. Waiting for the first successful rebalance event.",
          },
        }),
      );

      addActivity({
        id: `evt-strategy-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Registered",
        kind: "action",
        title: "Owner strategy compiled and registered",
        description:
          "Natural-language intent was converted into machine-readable strategy constraints for the registry and proof circuit.",
        agent: "Owner + StrategyRegistry",
        reference: `policy_cap_${dailyCap}`,
      });

      addTerminalMessage({
        id: `terminal-strategy-${Date.now()}`,
        role: "agent",
        text: `Strategy compiled. Risk ${risk}, pool ${pool}, daily cap ${dailyCap}. StrategyRegistry is ready for a new scout proposal.`,
        accent: "success",
      });

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  const runScoutProposal = () => {
    // P1-01 guard: a proposal must follow a compiled strategy and cannot
    // overwrite a proof that is already mid-flight.
    if (proofStatus === "proposed") {
      addTerminalMessage({
        id: `terminal-reject-proposal-${Date.now()}`,
        role: "agent",
        text: "A proposal is already waiting for verification. Verify or block it before generating a new one.",
        accent: "warning",
      });
      return;
    }
    if (proofStatus === "verified") {
      addTerminalMessage({
        id: `terminal-reject-proposal-${Date.now()}`,
        role: "agent",
        text: "Current proof is verified and ready to execute. Execute or block before creating another proposal.",
        accent: "warning",
      });
      return;
    }

    setIsBusy(true);

    startTransition(() => {
      const nextCycle = cycle + 1;
      const nextProofId = createProofId(nextCycle);
      setCycle(nextCycle);
      setCurrentProofId(nextProofId);
      setProofStatus("proposed");
      updateProofLine("Strategy hash", `0x14bd...${(0x1f2a + nextCycle).toString(16)}`);
      updateProofLine(
        "Daily rebalance cap",
        `${Math.max(maxRebalancesPerDay - rebalancesToday - 1, 0)} / ${maxRebalancesPerDay} remaining after this move`,
      );
      updateProofLine("Verifier output", "Proof proposed - not yet verified", false);

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Proposed",
            description: "Generated a new candidate range and packed a fresh proof payload.",
          },
          Executor: {
            status: "Waiting",
            description: "Waiting for the verifier to accept the current proof before executing.",
          },
          Treasury: {
            status: "Standby",
            description: "No settlement yet. Waiting for execution or policy rejection.",
          },
        }),
      );

      addActivity({
        id: `evt-proposal-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Proposed",
        kind: "action",
        title: "Scout proposed a new proof-backed range",
        description:
          "Pool drift crossed the declared threshold, so the scout generated a rebalance candidate and attached a proof payload.",
        agent: "Scout Agent",
        reference: nextProofId,
      });

      addTerminalMessage({
        id: `terminal-proposal-${Date.now()}`,
        role: "agent",
        text: `Scout proposed a new range and generated ${nextProofId}. You can verify this proof before the vault moves capital.`,
        accent: "default",
      });

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  /**
   * Live Scout proposal that actually reads Uniswap v3 pool state from
   * X Layer via the /api/scout/propose endpoint. This is the production
   * path — no mock data, no hardcoded ticks. Fills the UI with a real
   * block number, real sqrtPriceX96, real symbols, real executionHash.
   */
  const runLiveScoutProposal: DemoContextValue["runLiveScoutProposal"] = async (input) => {
    if (proofStatus === "proposed" || proofStatus === "verified") {
      addTerminalMessage({
        id: `terminal-reject-live-proposal-${Date.now()}`,
        role: "agent",
        text: "Finish or block the current warrant before requesting a fresh live proposal.",
        accent: "warning",
      });
      return;
    }

    setIsBusy(true);
    addTerminalMessage({
      id: `terminal-live-scout-start-${Date.now()}`,
      role: "system",
      text: `Scout requesting live pool state from chain ${input.chainId}…`,
      accent: "default",
    });

    const response = await requestScoutProposal(input);

    if (!response.ok) {
      setIsBusy(false);
      addTerminalMessage({
        id: `terminal-live-scout-err-${Date.now()}`,
        role: "agent",
        text: `Scout failed to read live pool state: ${response.error}`,
        accent: "warning",
      });
      return;
    }

    const { proposal, network, skillCalls } = response;

    const nextLiveProposal: LiveProposal = {
      chainId: network.chainId,
      networkName: network.name,
      proposalHash: proposal.proposalHash,
      executionHash: proposal.executionHash,
      action: proposal.action,
      rationale: proposal.rationale,
      blockNumber: proposal.snapshot.blockNumber,
      observedAtIso: proposal.snapshot.observedAtIso,
      token0Symbol: proposal.snapshot.token0.symbol,
      token1Symbol: proposal.snapshot.token1.symbol,
      feeBps: proposal.snapshot.feeBps,
      priceToken1InToken0: proposal.snapshot.priceToken1InToken0,
      quote: proposal.quote,
      skillCalls,
    };

    startTransition(() => {
      setCurrentProofId(proposal.proposalHash);
      setProofStatus("proposed");
      setLiveProposal(nextLiveProposal);

      updateProofLine("Strategy hash", `0x${proposal.proposalHash.slice(2, 10)}…`);
      updateProofLine(
        "Allowed pool matched",
        `${proposal.snapshot.token0.symbol} / ${proposal.snapshot.token1.symbol}`,
      );
      updateProofLine(
        "Daily rebalance cap",
        `${Math.max(maxRebalancesPerDay - rebalancesToday - 1, 0)} / ${maxRebalancesPerDay} remaining after this move`,
      );
      updateProofLine("Verifier output", "Live proposal - awaiting verification", false);

      setPosition((current) => ({
        ...current,
        pool: `Uniswap v3 · ${proposal.snapshot.token0.symbol}/${proposal.snapshot.token1.symbol} (${proposal.snapshot.feeBps} bps)`,
        range: `${proposal.action.lowerTick.toLocaleString("en-US")} - ${proposal.action.upperTick.toLocaleString("en-US")}`,
      }));

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Live",
            description: `Read block ${proposal.snapshot.blockNumber} on ${network.name}. Proposed range [${proposal.action.lowerTick}, ${proposal.action.upperTick}].`,
          },
          Executor: {
            status: "Waiting",
            description: "Waiting for the verifier to accept the live warrant before executing.",
          },
          Treasury: {
            status: "Standby",
            description: "Holding until the live proposal is cleared or rejected.",
          },
        }),
      );

      addActivity({
        id: `evt-live-proposal-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Proposed",
        kind: "action",
        title: `Scout read live pool state at block ${proposal.snapshot.blockNumber}`,
        description: proposal.rationale,
        agent: "Scout Agent",
        reference: proposal.executionHash,
      });

      addTerminalMessage({
        id: `terminal-live-scout-ok-${Date.now()}`,
        role: "agent",
        text:
          `Live proposal ready. Pool ${proposal.snapshot.token0.symbol}/${proposal.snapshot.token1.symbol}, ` +
          `tick ${proposal.snapshot.currentTick} at block ${proposal.snapshot.blockNumber}. ` +
          `New range [${proposal.action.lowerTick}, ${proposal.action.upperTick}]. ` +
          `executionHash ${proposal.executionHash.slice(0, 10)}…`,
        accent: "success",
      });

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  const verifyProof = () => {
    // P1-01 guard: verification only makes sense on a fresh proposal.
    if (proofStatus !== "proposed") {
      addTerminalMessage({
        id: `terminal-reject-verify-${Date.now()}`,
        role: "agent",
        text:
          proofStatus === "verified"
            ? "Proof is already verified. Execute the rebalance or create a new proposal."
            : "No active proposal to verify. Run a scout proposal first.",
        accent: "warning",
      });
      return;
    }

    setIsBusy(true);

    startTransition(() => {
      setProofStatus("verified");
      updateProofLine("Verifier output", "Accepted", true);

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Verified",
            description: "Latest proposal satisfied declared strategy constraints and cleared the verifier.",
          },
          Executor: {
            status: "Ready",
            description: "Proof gate is open. Executor can submit the rebalance to the vault.",
          },
          Treasury: {
            status: "Queued",
            description: "Waiting for execution data to finalize the next reward epoch.",
          },
        }),
      );

      addActivity({
        id: `evt-verify-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Verified",
        kind: "success",
        title: "Proof verifier accepted the rebalance proposal",
        description:
          "The proposal was proven to follow the owner-declared policy, pool allowlist, and daily move constraints.",
        agent: "ProofVerifier",
        reference: currentProofId,
      });

      addTerminalMessage({
        id: `terminal-verify-${Date.now()}`,
        role: "agent",
        text: `Proof accepted. Executor is now allowed to submit the rebalance tied to ${currentProofId}.`,
        accent: "success",
      });

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  const executeRebalance = () => {
    setIsBusy(true);

    startTransition(() => {
      // P1-01 guard: match the on-chain "proof consumed only once"
      // invariant. This MUST run before the not-verified check, because
      // after a successful execute proofStatus becomes "executed"
      // (not "verified"), and we want the retry to see the specific
      // "already consumed" diagnostic rather than the generic
      // "need verified proof" message.
      if (consumedProofIds.has(currentProofId)) {
        setProofStatus("blocked");
        updateProofLine("Verifier output", "Rejected - proof already consumed", false);
        addActivity({
          id: `evt-replay-blocked-${Date.now()}`,
          time: formatClock(new Date()),
          status: "Blocked",
          kind: "blocked",
          title: "Replay blocked by proof gate",
          description:
            "The executor tried to reuse a proof that had already been consumed by a previous rebalance.",
          agent: "ProofVerifier",
          reference: currentProofId,
        });
        addTerminalMessage({
          id: `terminal-replay-${Date.now()}`,
          role: "agent",
          text: "Execution blocked. This proof has already been consumed; generate a new proposal first.",
          accent: "warning",
        });
        setTimeout(() => setIsBusy(false), 250);
        return;
      }

      if (proofStatus !== "verified") {
        setProofStatus("blocked");
        updateProofLine("Verifier output", "Rejected - proof not verified", false);
        addActivity({
          id: `evt-exec-blocked-${Date.now()}`,
          time: formatClock(new Date()),
          status: "Blocked",
          kind: "blocked",
          title: "Executor was blocked before touching the vault",
          description: "A rebalance attempt was made without a verified proof, so capital could not move.",
          agent: "LiquidityVault",
          reference: "error_missing_verified_proof",
        });
        addTerminalMessage({
          id: `terminal-blocked-proof-${Date.now()}`,
          role: "agent",
          text: "Execution blocked. A verified proof is required before LiquidityVault can rebalance.",
          accent: "warning",
        });
        setTimeout(() => setIsBusy(false), 250);
        return;
      }

      if (rebalancesToday >= maxRebalancesPerDay) {
        setProofStatus("blocked");
        updateProofLine("Verifier output", "Rejected - daily cap reached", false);
        addActivity({
          id: `evt-cap-blocked-${Date.now()}`,
          time: formatClock(new Date()),
          status: "Blocked",
          kind: "blocked",
          title: "Policy gate rejected the rebalance",
          description:
            "The strategy had already consumed its daily move budget, so the executor could not submit a new rebalance.",
          agent: "StrategyRegistry",
          reference: "rejection_daily_cap",
        });
        addTerminalMessage({
          id: `terminal-daily-cap-${Date.now()}`,
          role: "agent",
          text: "Execution rejected. The strategy already consumed its daily rebalance budget.",
          accent: "warning",
        });
        setTimeout(() => setIsBusy(false), 250);
        return;
      }

      const nextRebalanceCount = rebalancesToday + 1;
      const [lower, upper] = parseRangeBounds(position.range);
      const shift = 25 + nextRebalanceCount * 5;
      const nextLower = lower + shift;
      const nextUpper = upper + shift;
      const nextRange = formatRange(nextLower, nextUpper);
      const feeDelta = 42.5 + nextRebalanceCount * 7.1;
      const tvlDelta = 110 + nextRebalanceCount * 15;
      const txHash = createTxHash(nextRebalanceCount);

      // P1-06 fix: compute the next values ONCE, use the same numbers in
      // setPosition AND in the terminal message so both surfaces agree.
      const currentFees = parseCurrency(position.fees);
      const currentTvlK = parseCurrency(position.tvl);
      const nextFees = currentFees + feeDelta;
      const nextTvlK = currentTvlK + tvlDelta / 1000;

      setRebalancesToday(nextRebalanceCount);
      setProofStatus("executed");
      setConsumedProofIds((current) => {
        const next = new Set(current);
        next.add(currentProofId);
        return next;
      });
      setPosition((current) => ({
        ...current,
        range: nextRange,
        fees: formatUsd(nextFees),
        tvl: formatKUsd(nextTvlK),
      }));

      updateProofLine(
        "Daily rebalance cap",
        `${Math.max(maxRebalancesPerDay - nextRebalanceCount, 0)} / ${maxRebalancesPerDay} remaining after this move`,
      );

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Monitoring",
            description: "Proposal cleared. Scout returned to monitoring pool drift for the next valid move.",
          },
          Executor: {
            status: "Executed",
            description: "LiquidityVault completed the latest proof-gated rebalance on the declared pool.",
          },
          Treasury: {
            status: "Reconciling",
            description: "Fee growth and reward metadata are being packaged into the next reward epoch.",
          },
        }),
      );

      addActivity({
        id: `evt-executed-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Executed",
        kind: "action",
        title: "Executor updated the active LP range",
        description:
          "Proof-gated capital movement cleared the vault, updated the range, and emitted a fresh vault execution event.",
        agent: "Executor Agent",
        reference: txHash,
      });

      addActivity({
        id: `evt-settled-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Settled",
        kind: "success",
        title: "Treasury recorded the new reward epoch",
        description:
          "Fee accrual from the verified rebalance was attached to the same proof ID so owners can inspect profit and policy compliance together.",
        agent: "Treasury Agent",
        reference: currentProofId,
      });

      addTerminalMessage({
        id: `terminal-executed-${Date.now()}`,
        role: "agent",
        text: `Rebalance executed. New range ${nextRange}, updated fees ${formatUsd(
          nextFees,
        )}, proof ${currentProofId} attached to the reward epoch.`,
        accent: "success",
      });

      setYieldRecords((current) => [
        {
          id: `yield-${Date.now()}`,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
          event: `Verified rebalance #${nextRebalanceCount}`,
          pnl: `+${formatUsd(feeDelta)}`,
          proof: currentProofId,
        },
        ...current,
      ]);

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  const simulateBlockedMove = () => {
    setIsBusy(true);

    startTransition(() => {
      setProofStatus("blocked");
      updateProofLine("Verifier output", "Rejected - strategy held position", false);

      setAgentStates((current) =>
        updateAgentState(current, {
          Scout: {
            status: "Held",
            description: "Pool drift did not justify a new move under the declared risk envelope.",
          },
          Executor: {
            status: "Blocked",
            description: "No action was taken because the latest proposal failed policy constraints.",
          },
          Treasury: {
            status: "No change",
            description: "No new settlement event was generated because capital never moved.",
          },
        }),
      );

      addActivity({
        id: `evt-policy-block-${Date.now()}`,
        time: formatClock(new Date()),
        status: "Blocked",
        kind: "blocked",
        title: "Policy gate kept the vault in place",
        description:
          "The system intentionally skipped a move because the proposed range change fell outside current strategy conditions.",
        agent: "ProofVerifier",
        reference: "hold_position",
      });

      addTerminalMessage({
        id: `terminal-held-${Date.now()}`,
        role: "agent",
        text: "No capital moved. The system held position because the latest market drift did not justify a valid rebalance.",
        accent: "warning",
      });

      setTimeout(() => setIsBusy(false), 250);
    });
  };

  const runTerminalCommand = (command: string) => {
    const trimmed = command.trim();

    if (!trimmed) {
      return;
    }

    addTerminalMessage({
      id: `terminal-owner-${Date.now()}`,
      role: "owner",
      text: trimmed,
      accent: "default",
    });

    // Heuristic router. Short inputs that LOOK like a command word are
    // routed to the corresponding control. Long or verb-led natural
    // language (e.g. "Run a high-risk WBTC strategy with 5 rebalances per
    // day") is always treated as a strategy prompt even though it contains
    // tokens like "rebalances" or "strategy" that would otherwise collide
    // with command keywords.
    const wordCount = trimmed.split(/\s+/).length;
    const looksLikePrompt =
      wordCount >= 5 || /^(run|create|set\s?up|deploy|start)\b/i.test(trimmed);

    if (!looksLikePrompt) {
      if (textIncludes(trimmed, ["reset"])) {
        resetDemo();
        addTerminalMessage({
          id: `terminal-reset-${Date.now()}`,
          role: "system",
          text: "Demo state reset. Terminal, dashboard, proof center, and yield history are all back to the initial scenario.",
          accent: "default",
        });
        return;
      }

      if (textIncludes(trimmed, ["status"])) {
        addTerminalMessage({
          id: `terminal-status-${Date.now()}`,
          role: "agent",
          text: `Status: proof ${proofStatus}, range ${position.range}, fees ${position.fees}, daily moves ${rebalancesToday}/${maxRebalancesPerDay}.`,
          accent: "default",
        });
        return;
      }

      if (textIncludes(trimmed, ["hold", "block"])) {
        simulateBlockedMove();
        return;
      }

      if (textIncludes(trimmed, ["execute", "rebalance"])) {
        executeRebalance();
        return;
      }

      if (textIncludes(trimmed, ["verify", "proof"])) {
        verifyProof();
        return;
      }

      if (textIncludes(trimmed, ["scout", "proposal"])) {
        runScoutProposal();
        return;
      }

      if (textIncludes(trimmed, ["compile", "strategy", "generate"])) {
        generateStrategy();
        return;
      }
    }

    // Free-form natural language input → treat as a fresh strategy prompt.
    // Pass it explicitly so compileStrategy doesn't race the setPrompt call.
    generateStrategy(trimmed);
  };

  const resetDemo = () => {
    setPrompt(DEFAULT_PROMPT);
    setStrategyPreview(cloneItems(initialStrategyPreview));
    setPosition({ ...initialPosition });
    setAgentStates(cloneItems(initialAgentStates));
    setActivity(cloneItems(activityFeed));
    setProofChecks(cloneItems(initialProofChecks));
    setYieldRecords(cloneItems(initialYieldRecords));
    setTerminalMessages(cloneItems(initialTerminalMessages));
    setProofStatus("idle");
    setCurrentProofId(SAMPLE_PROOF_ID);
    setRebalancesToday(0);
    setMaxRebalancesPerDay(DEFAULT_MAX_REBALANCES_PER_DAY);
    setCycle(0);
    setIsBusy(false);
    setConsumedProofIds(new Set());
    setLiveProposal(null);
  };

  const value = useMemo<DemoContextValue>(
    () => ({
      prompt,
      strategyPreview,
      position,
      agentStates,
      activity,
      proofChecks,
      yieldRecords,
      proofStatus,
      currentProofId,
      rebalancesToday,
      maxRebalancesPerDay,
      terminalMessages,
      terminalSuggestions,
      isBusy,
      liveProposal,
      setPrompt,
      generateStrategy,
      runScoutProposal,
      runLiveScoutProposal,
      clearLiveProposal,
      verifyProof,
      executeRebalance,
      simulateBlockedMove,
      runTerminalCommand,
      resetDemo,
    }),
    [
      activity,
      agentStates,
      currentProofId,
      isBusy,
      liveProposal,
      maxRebalancesPerDay,
      position,
      prompt,
      proofChecks,
      proofStatus,
      rebalancesToday,
      strategyPreview,
      terminalMessages,
      yieldRecords,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);

  if (!context) {
    throw new Error("useDemo must be used within DemoProvider");
  }

  return context;
}
