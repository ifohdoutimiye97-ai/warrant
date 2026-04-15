/**
 * Client-side helper to call the server-side Scout endpoint.
 *
 * The Scout agent runs on the server (it needs JSON-RPC access to
 * X Layer) — the client simply POSTs the owner's parameters and
 * renders whatever proposal comes back. Returns a typed discriminated
 * union so callers can branch cleanly on success / failure without
 * losing error detail.
 */

import type { QuoteResult } from "@/lib/uniswap/quoter";
import type { RebalanceAction, RiskProfile } from "@/lib/uniswap/scout";

export type ScoutSkillCall = {
  skill: string;
  contract: string;
  method: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  note?: string;
};

export type ScoutAdviceResponse = {
  mode: "anthropic" | "openai" | "rule-based";
  model?: string;
  recommendation: "sign-warrant" | "hold" | "widen-range" | "abort";
  confidence: number;
  flags: string[];
  rationale: string;
  note?: string;
};

export type ScoutObservationResponse = {
  chainId: number;
  pool: {
    address: string;
    token0: string;
    token1: string;
    feeBps: number;
    tickSpacing: number;
    currentTick: number;
    priceToken1InToken0: string;
    blockNumber: number;
  };
  proposal: {
    strategyId: number;
    risk: "low" | "medium" | "high";
    lowerTick: number;
    upperTick: number;
    proposalHash: string;
    executionHash: string;
  };
  signals: Record<string, unknown>;
};

export type ScoutProposalResponse =
  | {
      ok: true;
      network: { chainId: number; name: string; explorer: string };
      proposal: {
        strategyId: number;
        proposalHash: string;
        executionHash: string;
        rationale: string;
        rationaleExtensions?: string[];
        action: RebalanceAction;
        quote: QuoteResult | null;
        snapshot: {
          poolAddress: string;
          blockNumber: number;
          observedAtIso: string;
          currentTick: number;
          tickSpacing: number;
          feeBps: number;
          liquidity: string;
          sqrtPriceX96: string;
          token0: { address: string; symbol: string; decimals: number };
          token1: { address: string; symbol: string; decimals: number };
          priceToken0InToken1: string;
          priceToken1InToken0: string;
        };
        llmAdvice?: ScoutAdviceResponse;
        observation?: ScoutObservationResponse;
      };
      skillCalls: ScoutSkillCall[];
      skillSummary?: {
        uniqueSkills: number;
        totalCalls: number;
        modules: string[];
      };
    }
  | { ok: false; error: string; skillCalls?: ScoutSkillCall[] };

export async function requestScoutProposal(input: {
  chainId: number;
  strategyId?: number;
  risk: RiskProfile;
  recipient: string;
  poolAddress?: string;
}): Promise<ScoutProposalResponse> {
  try {
    const response = await fetch("/api/scout/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await response.json()) as ScoutProposalResponse | { error: string };
    if (!response.ok || "error" in json) {
      const message = "error" in json && typeof json.error === "string" ? json.error : `Scout request failed (${response.status})`;
      return { ok: false, error: message };
    }
    return json as ScoutProposalResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error contacting scout";
    return { ok: false, error: message };
  }
}
