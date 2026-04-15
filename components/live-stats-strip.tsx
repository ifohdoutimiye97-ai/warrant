"use client";

import { useDemo } from "@/components/demo-provider";

/**
 * Landing-page stat strip that reads from the same DemoProvider state as
 * the terminal and dashboard. If you run a rebalance in /terminal and
 * return to /, these numbers now reflect the latest demo state — no more
 * "this page is frozen" inconsistency (P1-03).
 */
export function LiveStatsStrip() {
  const { position, maxRebalancesPerDay, rebalancesToday } = useDemo();

  const stats = [
    {
      label: "Vault TVL",
      value: position.tvl,
      note: "Single X Layer pool MVP",
    },
    {
      label: "Verified moves",
      value: "100%",
      note: "No capital without proof",
    },
    {
      label: "Daily cap",
      value: `${rebalancesToday} / ${maxRebalancesPerDay}`,
      note: "Owner-defined ceiling",
    },
    {
      label: "Rebalance latency",
      value: "< 8s",
      note: "Proof to execution",
    },
  ];

  return (
    <div className="stat-grid" style={{ marginTop: 80 }}>
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span className="stat-label">{stat.label}</span>
          <strong className="stat-value text-gradient-cyan">{stat.value}</strong>
          <p className="stat-note">{stat.note}</p>
        </article>
      ))}
    </div>
  );
}
