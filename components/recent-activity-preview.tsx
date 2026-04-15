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

export function RecentActivityPreview() {
  const { activity } = useDemo();

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {activity.slice(0, 4).map((item) => (
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
            <span className="font-mono">{item.time}</span>
            <span className={pillClass(item.kind)}>{item.status}</span>
          </div>
          <h3
            style={{
              margin: "10px 0 6px",
              fontFamily: "Space Grotesk",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {item.title}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {item.description}
          </p>
          <span
            className="font-mono"
            style={{
              display: "block",
              marginTop: 10,
              fontSize: 11,
              color: "var(--brand-cyan)",
            }}
          >
            {item.reference}
          </span>
        </article>
      ))}
    </div>
  );
}
