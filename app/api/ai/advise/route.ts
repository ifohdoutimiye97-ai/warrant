/**
 * POST /api/ai/advise
 *
 * Takes a Scout observation (pool state + proposal + all 8 Skill signals)
 * and returns a structured AI (or rule-based fallback) recommendation:
 * "sign-warrant" | "widen-range" | "hold" | "abort".
 *
 * Backend selection is automatic:
 *   ANTHROPIC_API_KEY → Claude Haiku
 *   OPENAI_API_KEY    → GPT-4o-mini
 *   (neither)         → deterministic rule-based path, transparently labelled.
 *
 * The response always includes `mode` so the UI can render a banner that
 * tells the user whether they are looking at an LLM output or a rule
 * output. We never pretend to be AI when we are not.
 */

import { NextResponse } from "next/server";
import {
  getScoutAdvice,
  type ScoutObservation,
} from "@/lib/ai/scout-advisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: ScoutObservation;
  try {
    body = (await request.json()) as ScoutObservation;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.pool?.address || !body?.proposal?.proposalHash) {
    return NextResponse.json(
      {
        error:
          "ScoutObservation must include pool.address and proposal.proposalHash at minimum.",
      },
      { status: 400 },
    );
  }

  const advice = await getScoutAdvice(body);
  return NextResponse.json({ ok: true, advice });
}
