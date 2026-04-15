"use client";

import { useDemo } from "@/components/demo-provider";
import type { ActivityItem } from "@/lib/mock-data";

function feedClass(kind: ActivityItem["kind"]) {
  if (kind === "success") return "feed-item is-success";
  if (kind === "blocked") return "feed-item is-blocked";
  return "feed-item is-action";
}

function pillClass(kind: ActivityItem["kind"]) {
  if (kind === "success") return "pill pill-success";
  if (kind === "blocked") return "pill pill-danger";
  return "pill pill-cyan";
}

export function ActivityFeedPanel() {
  const { activity } = useDemo();

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Activity Feed</span>
        <h1 className="section-title">Every step leaves an auditable trail.</h1>
        <p className="hero-copy">
          Each event ties an agent action to a warrant ID or transaction hash. Owners and
          judges can replay the entire history without trusting any single party.
        </p>

        <div style={{ display: "grid", gap: 16, marginTop: 32 }}>
          {activity.map((item) => (
            <article className={feedClass(item.kind)} key={item.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{item.time}</span>
                <span className={pillClass(item.kind)}>{item.status}</span>
              </div>
              <h2 className="h3" style={{ marginTop: 14, marginBottom: 8 }}>
                {item.title}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {item.description}
              </p>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <span>{item.agent}</span>
                <span className="font-mono" style={{ color: "var(--brand-cyan)" }}>
                  {item.reference}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
