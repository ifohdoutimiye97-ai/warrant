/**
 * POST /api/ai/chat
 *
 * Conversational Q&A with the Scout agent. Backed by the same LLM
 * selection (Anthropic → OpenAI → offline canned reply) as
 * /api/ai/advise. The UI uses this to power the "Chat with Scout"
 * panel on the Terminal page.
 *
 * Body:
 *   {
 *     observation: ScoutObservation,
 *     question:    string,
 *     history?:    Array<{ role: "user" | "assistant"; content: string }>
 *   }
 *
 * Response:
 *   { ok: true, reply: { mode, model?, text } }
 */

import { NextResponse } from "next/server";
import {
  getScoutChatReply,
  type ScoutObservation,
} from "@/lib/ai/scout-advisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  observation?: ScoutObservation;
  question?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.observation?.pool?.address || !body.question?.trim()) {
    return NextResponse.json(
      { error: "Request must include `observation` and `question`." },
      { status: 400 },
    );
  }

  const reply = await getScoutChatReply({
    observation: body.observation,
    question: body.question.trim(),
    history: body.history,
  });

  return NextResponse.json({ ok: true, reply });
}
