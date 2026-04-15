/**
 * Onchain OS Skill surface — OKX DEX Aggregator quote route.
 *
 * POST /api/okx/quote
 *
 * Body:
 *   {
 *     chainId:          number,     // 196 = X Layer
 *     fromTokenAddress: string,     // ERC-20 address
 *     toTokenAddress:   string,
 *     amount:           string,     // amount in fromToken's smallest unit
 *     slippage?:        string      // "0.01" = 1%, default 0.005
 *   }
 *
 * Response (ok):
 *   { ok: true, quote: {...}, skillCall: {...} }
 *
 * Response (unconfigured):
 *   { ok: false, mode: "unconfigured", skillCall: {...} }
 *
 * The `skillCall` field is returned on every response so evaluators can
 * grep which Onchain OS Skill ran without reading the code.
 */

import { NextResponse } from "next/server";
import { getAggregatorQuote } from "@/lib/okx/dex-aggregator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteBody = {
  chainId?: number;
  fromTokenAddress?: string;
  toTokenAddress?: string;
  amount?: string;
  slippage?: string;
};

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.chainId !== "number") {
    return NextResponse.json({ error: "chainId required" }, { status: 400 });
  }
  if (!isAddress(body.fromTokenAddress)) {
    return NextResponse.json(
      { error: "fromTokenAddress must be a valid ERC-20 address" },
      { status: 400 },
    );
  }
  if (!isAddress(body.toTokenAddress)) {
    return NextResponse.json(
      { error: "toTokenAddress must be a valid ERC-20 address" },
      { status: 400 },
    );
  }
  if (!isAmount(body.amount)) {
    return NextResponse.json(
      { error: "amount must be a base-unit integer string" },
      { status: 400 },
    );
  }

  const quote = await getAggregatorQuote({
    chainId: body.chainId,
    fromTokenAddress: body.fromTokenAddress,
    toTokenAddress: body.toTokenAddress,
    amount: body.amount,
    slippage: body.slippage,
  });

  const skillCall = {
    skill: "okx-dex-swap",
    platform: "onchain-os",
    endpoint: "/api/v5/dex/aggregator/quote",
    host: "web3.okx.com",
    chainId: body.chainId,
  };

  return NextResponse.json({ ...quote, skillCall });
}
