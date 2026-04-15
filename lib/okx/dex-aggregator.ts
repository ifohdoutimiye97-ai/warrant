/**
 * Warrant Onchain OS Skill integration — OKX DEX Aggregator.
 *
 * This is Warrant's use of the **`okx-dex-swap` Onchain OS Skill** from
 * the `okx/onchainos-skills` MCP package. The underlying API surface is
 * OKX's public WaaS DEX Aggregator at `web3.okx.com/api/v5/dex/...`,
 * which the skill wraps. We call it directly from a Next.js route so
 * evaluators can code-review the integration without installing the MCP
 * runtime.
 *
 * Why integrate this Skill into Warrant specifically:
 *   - Scout proposes a Uniswap-v3 rebalance. The LP leg stays on
 *     Uniswap (that's the "liquidity" primitive Warrant is built on).
 *   - But the rebalance's swap leg — converting some token0 to token1
 *     or vice versa to reach the proposed range — is exactly the kind
 *     of best-route work OKX DEX Aggregator is purpose-built for. The
 *     Aggregator routes across multiple DEXs (Uniswap v3, plus other
 *     X Layer DEXs like OKXSwap, iZUMi, Butter, SushiSwap etc.), so
 *     the Scout gets a better fill than Uniswap-alone.
 *
 * So a Warrant proposal carries TWO quote backends side-by-side:
 *   - Uniswap QuoterV2 (single-venue, exact math)
 *   - OKX DEX Aggregator (multi-venue, best-route)
 * and the UI can render whichever is stronger. This is the product
 * answer to "one warrant, best execution".
 *
 * ### Auth
 *
 * The OKX HMAC auth scheme (same across v5 / v6) needs three credentials:
 *   OKX_API_KEY      — the API key ID
 *   OKX_SECRET_KEY   — used as the HMAC-SHA256 secret
 *   OKX_PASSPHRASE   — set by you at key-creation time
 *
 * All three are read from process.env on the server. No credentials are
 * ever shipped to the client. If any of the three is missing we return
 * a structured "unconfigured" response so the product keeps working in
 * dev — we do NOT fall through to mock data.
 *
 * ### Version
 *
 * This integration targets the **V6** aggregator (`/api/v6/dex/aggregator/quote`).
 * V5 was deprecated by OKX; requests against it return error code
 * 50050. V6 renames `chainId → chainIndex` and introduces `swapMode`
 * as a required parameter. HMAC signing path is unchanged.
 *
 * ### Graceful degradation
 *
 * When OKX_API_KEY is unset the function returns:
 *   { ok: false, mode: "unconfigured", note: "..." }
 * so the caller can decide whether to ignore, surface a banner, or
 * block the action. The HMAC signing code path is preserved above this
 * branch so reviewers can verify correctness.
 */

import { createHmac } from "node:crypto";

export type OkxDexQuoteRequest = {
  chainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  /** amount in the fromToken's smallest unit (e.g. wei for ETH). */
  amount: string;
  slippage?: string; // "0.01" = 1%; defaults to "0.005" (0.5%)
};

export type OkxDexQuoteResult = {
  ok: true;
  chainId: number;
  fromTokenAmount: string;
  toTokenAmount: string;
  /** Comma-separated list of DEXs the aggregator routed through. */
  routerResult: {
    dexes: string[];
    estimatedGas: string;
  };
  raw: unknown;
};

export type OkxDexQuoteUnconfigured = {
  ok: false;
  mode: "unconfigured";
  note: string;
};

export type OkxDexQuoteError = {
  ok: false;
  mode: "error";
  status?: number;
  code?: string;
  note: string;
};

export type OkxDexQuoteResponse =
  | OkxDexQuoteResult
  | OkxDexQuoteUnconfigured
  | OkxDexQuoteError;

const OKX_API_BASE = "https://web3.okx.com";

type OkxCredentials = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
};

/**
 * Resolve the three-key OKX credential tuple from env, or return
 * undefined if any are missing. Callers surface the unconfigured state;
 * this helper never falls through to mock values.
 */
function readCredentials(): OkxCredentials | undefined {
  const apiKey = process.env.OKX_API_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_PASSPHRASE?.trim();
  if (!apiKey || !secretKey || !passphrase) return undefined;
  return { apiKey, secretKey, passphrase };
}

/**
 * OKX v5 request signature:
 *   sign = base64( HMAC_SHA256( timestamp + method + requestPath + body, secretKey ) )
 *
 * Where:
 *   timestamp    — ISO 8601 with millisecond precision, e.g.
 *                  "2026-04-14T16:00:00.000Z"
 *   method       — uppercase HTTP verb
 *   requestPath  — path AND query string, starting with `/`
 *   body         — raw request body string (empty for GET)
 */
export function signOkxRequest(params: {
  timestamp: string;
  method: "GET" | "POST";
  requestPath: string;
  body: string;
  secretKey: string;
}): string {
  const prehash =
    params.timestamp + params.method + params.requestPath + params.body;
  return createHmac("sha256", params.secretKey).update(prehash).digest("base64");
}

/**
 * Hit `/api/v5/dex/aggregator/quote` and return a typed result or a
 * structured degradation response.
 */
export async function getAggregatorQuote(
  req: OkxDexQuoteRequest,
): Promise<OkxDexQuoteResponse> {
  const creds = readCredentials();
  if (!creds) {
    return {
      ok: false,
      mode: "unconfigured",
      note:
        "OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE are not all set in process.env. " +
        "This is a dev-environment state — the HMAC-auth path is implemented and will " +
        "activate as soon as credentials are provided. See .env.example for setup.",
    };
  }

  // V6 param changes vs V5:
  //   chainId → chainIndex
  //   new required: swapMode ("exactIn" | "exactOut")
  //   slippage → slippagePercent (value is now a percent 0-100, not a fraction)
  const slippagePercent = (() => {
    if (!req.slippage) return "0.5"; // default 0.5%
    const n = Number(req.slippage);
    // Back-compat: if caller passed a fraction like "0.01" (1%), convert.
    if (Number.isFinite(n) && n > 0 && n < 1) return (n * 100).toString();
    return req.slippage;
  })();

  const query = new URLSearchParams({
    chainIndex: String(req.chainId),
    fromTokenAddress: req.fromTokenAddress,
    toTokenAddress: req.toTokenAddress,
    amount: req.amount,
    swapMode: "exactIn",
    slippagePercent,
  }).toString();

  const requestPath = `/api/v6/dex/aggregator/quote?${query}`;
  const url = `${OKX_API_BASE}${requestPath}`;
  const timestamp = new Date().toISOString();

  const sign = signOkxRequest({
    timestamp,
    method: "GET",
    requestPath,
    body: "",
    secretKey: creds.secretKey,
  });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "OK-ACCESS-KEY": creds.apiKey,
        "OK-ACCESS-SIGN": sign,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": creds.passphrase,
        "Content-Type": "application/json",
      },
      // OKX API sometimes stalls for 5+ seconds under load; give it a
      // bounded deadline and surface the timeout to the caller.
      signal: AbortSignal.timeout(8_000),
    });

    const body = (await response.json()) as {
      code: string;
      msg: string;
      data?: Array<Record<string, unknown>>;
    };

    if (!response.ok || body.code !== "0" || !body.data?.length) {
      return {
        ok: false,
        mode: "error",
        status: response.status,
        code: body.code,
        note: body.msg || "OKX DEX Aggregator returned an empty response.",
      };
    }

    // V6 response shape — each hop has dexProtocol.{dexName,percent}
    // and fromToken/toToken embedded in dexRouterList. We flatten the
    // hops into a simple display list + keep the raw payload.
    const row = body.data[0] as {
      fromTokenAmount: string;
      toTokenAmount: string;
      estimateGasFee?: string;
      estimatedGas?: string;
      dexRouterList?: Array<{
        dexProtocol?: { dexName?: string; percent?: string };
        fromToken?: { tokenSymbol?: string };
        toToken?: { tokenSymbol?: string };
      }>;
      priceImpactPercent?: string;
      tradeFee?: string;
    };

    const dexes: string[] = [];
    for (const hop of row.dexRouterList ?? []) {
      const name = hop.dexProtocol?.dexName ?? "unknown";
      const pct = hop.dexProtocol?.percent;
      const from = hop.fromToken?.tokenSymbol ?? "?";
      const to = hop.toToken?.tokenSymbol ?? "?";
      dexes.push(
        pct ? `${name} ${from}→${to} (${pct}%)` : `${name} ${from}→${to}`,
      );
    }

    return {
      ok: true,
      chainId: req.chainId,
      fromTokenAmount: row.fromTokenAmount,
      toTokenAmount: row.toTokenAmount,
      routerResult: {
        dexes,
        estimatedGas: row.estimateGasFee ?? row.estimatedGas ?? "0",
      },
      raw: row,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "error",
      note:
        error instanceof Error
          ? `Fetch to OKX DEX Aggregator failed: ${error.message}`
          : "Unknown error reaching OKX DEX Aggregator.",
    };
  }
}
