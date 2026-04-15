/**
 * Warrant Onchain OS Skill integration — OKX Market Oracle.
 *
 * This is the **second** Onchain OS skill wired into Warrant, chosen
 * specifically because it requires NO API credentials — the OKX v5
 * market API endpoints under `https://www.okx.com/api/v5/market/*` are
 * public, unauthenticated, and return signed CEX reference prices for
 * every major token pair.
 *
 * Why we added it (on top of `okx-dex-swap`):
 *   - `okx-dex-swap` (DEX Aggregator) is the best-route quote across
 *     DEXs, gated behind the OKX OS dev-portal HMAC triplet.
 *   - `okx-market-oracle` is the **external price oracle** layer — it
 *     lets the Scout ask "what does OKX's CEX reference price say
 *     about ETH / BTC right now?" and compare that to the on-chain
 *     Uniswap v3 pool price.
 *
 * The two together give a warrant a **three-angle pricing sanity
 * check** before it is signed:
 *   1. Uniswap QuoterV2    (on-chain, single-venue)
 *   2. OKX DEX Aggregator  (on-chain, cross-venue)
 *   3. OKX Market Oracle   (off-chain CEX reference)
 *
 * A large gap between any two is the strongest possible signal that
 * the Scout should NOT sign a warrant — the pool may be manipulated,
 * or the Scout may be reading the wrong pool.
 *
 * ### Endpoint used
 *
 * `GET https://www.okx.com/api/v5/market/ticker?instId={SYMBOL}-USDT`
 *
 * No HMAC auth, no API key, no rate-limit for low-volume usage.
 * Returns JSON with `last`, `askPx`, `bidPx`, `high24h`, `low24h`,
 * `vol24h`, `ts` (ms).
 *
 * ### Symbol mapping
 *
 * X Layer pool tokens map to CEX symbols:
 *   xETH     → ETH-USDT    (wrapped-ETH-on-X-Layer → Ethereum spot)
 *   xBTC     → BTC-USDT
 *   WOKB     → OKB-USDT
 *   USD₮0    → USDT-USDT  (stable, anchor = 1.0)
 *   USDC     → USDC-USDT  (stable, anchor ≈ 1.0)
 */

const OKX_MARKET_BASE = "https://www.okx.com/api/v5";

/** Tokens common on X Layer pools we support, mapped to their CEX ticker. */
const CEX_SYMBOL_MAP: Record<string, string> = {
  xETH: "ETH",
  WETH: "ETH",
  ETH: "ETH",
  xBTC: "BTC",
  WBTC: "BTC",
  BTC: "BTC",
  WOKB: "OKB",
  OKB: "OKB",
  USDT: "USDT",
  "USD₮0": "USDT",
  USDT0: "USDT",
  USDC: "USDC",
};

export type MarketTicker = {
  instId: string;
  lastPrice: string;
  askPrice: string;
  bidPrice: string;
  high24h: string;
  low24h: string;
  vol24h: string;
  timestamp: number;
};

export type MarketOracleResponse =
  | {
      ok: true;
      ticker: MarketTicker;
      cexSymbol: string;
      cexInstId: string;
    }
  | {
      ok: false;
      mode: "unsupported-token" | "empty-response" | "http-error" | "network-error";
      note: string;
      cexSymbol?: string;
    };

/**
 * Translate a pool-token symbol into the CEX instId we should query.
 * Returns null when the token has no meaningful CEX mapping (rare).
 */
export function cexSymbolForToken(symbol: string): string | null {
  return CEX_SYMBOL_MAP[symbol] ?? null;
}

/**
 * Query `GET /api/v5/market/ticker` for the given symbol. This is a
 * public, un-authenticated endpoint — no API key required.
 */
export async function getMarketTicker(symbol: string): Promise<MarketOracleResponse> {
  const cex = cexSymbolForToken(symbol);
  if (!cex) {
    return {
      ok: false,
      mode: "unsupported-token",
      note: `No CEX ticker mapping for token symbol '${symbol}'.`,
    };
  }
  // Stable ≈ stable: short-circuit USDT against itself.
  if (cex === "USDT") {
    return {
      ok: true,
      cexSymbol: cex,
      cexInstId: "USDT-USDT",
      ticker: {
        instId: "USDT-USDT",
        lastPrice: "1",
        askPrice: "1",
        bidPrice: "1",
        high24h: "1",
        low24h: "1",
        vol24h: "0",
        timestamp: Date.now(),
      },
    };
  }
  const instId = `${cex}-USDT`;
  const url = `${OKX_MARKET_BASE}/market/ticker?instId=${instId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // OKX public API is normally < 500 ms; 4 s is plenty of headroom.
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        mode: "http-error",
        cexSymbol: cex,
        note: `OKX market API returned HTTP ${response.status} for ${instId}.`,
      };
    }

    const body = (await response.json()) as {
      code: string;
      msg: string;
      data?: Array<{
        instId: string;
        last: string;
        askPx: string;
        bidPx: string;
        high24h: string;
        low24h: string;
        vol24h: string;
        ts: string;
      }>;
    };

    if (body.code !== "0" || !body.data?.length) {
      return {
        ok: false,
        mode: "empty-response",
        cexSymbol: cex,
        note: body.msg || "OKX market API returned an empty payload.",
      };
    }

    const row = body.data[0];
    return {
      ok: true,
      cexSymbol: cex,
      cexInstId: instId,
      ticker: {
        instId: row.instId,
        lastPrice: row.last,
        askPrice: row.askPx,
        bidPrice: row.bidPx,
        high24h: row.high24h,
        low24h: row.low24h,
        vol24h: row.vol24h,
        timestamp: Number(row.ts),
      },
    };
  } catch (error) {
    return {
      ok: false,
      mode: "network-error",
      cexSymbol: cex,
      note: error instanceof Error ? error.message : "Unknown network error hitting OKX market API.",
    };
  }
}

/**
 * Pull CEX prices for both pool tokens in parallel and compute a
 * CEX-implied price for `token0 / token1`. Useful to compare against
 * the Uniswap pool's on-chain spot price.
 */
export async function getCrossPrice(
  token0Symbol: string,
  token1Symbol: string,
): Promise<{
  token0: MarketOracleResponse;
  token1: MarketOracleResponse;
  implied?: { token0PerToken1: string; token1PerToken0: string };
}> {
  const [t0, t1] = await Promise.all([
    getMarketTicker(token0Symbol),
    getMarketTicker(token1Symbol),
  ]);

  if (!t0.ok || !t1.ok) {
    return { token0: t0, token1: t1 };
  }

  const p0 = Number(t0.ticker.lastPrice);
  const p1 = Number(t1.ticker.lastPrice);
  if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 <= 0) {
    return { token0: t0, token1: t1 };
  }

  // Both prices are denominated in USDT, so cross-price is just the ratio.
  const token0PerToken1 = (p1 / p0).toFixed(8);
  const token1PerToken0 = (p0 / p1).toFixed(8);

  return {
    token0: t0,
    token1: t1,
    implied: { token0PerToken1, token1PerToken0 },
  };
}

/**
 * Given a Uniswap on-chain price (token0-per-token1) and a CEX-implied
 * price of the same pair, return the percentage deviation. A large
 * deviation is a signal the Scout should flag before signing.
 */
export function computeDeviation(params: {
  onchainPrice: string;
  cexImpliedPrice: string;
}): { deviationPct: number; alert: "none" | "notice" | "warn" | "severe" } {
  const onchain = Number(params.onchainPrice);
  const cex = Number(params.cexImpliedPrice);
  if (!Number.isFinite(onchain) || !Number.isFinite(cex) || cex <= 0) {
    return { deviationPct: 0, alert: "none" };
  }
  const deviationPct = ((onchain - cex) / cex) * 100;
  const abs = Math.abs(deviationPct);
  let alert: "none" | "notice" | "warn" | "severe" = "none";
  if (abs >= 5) alert = "severe";
  else if (abs >= 1.5) alert = "warn";
  else if (abs >= 0.3) alert = "notice";
  return { deviationPct, alert };
}
