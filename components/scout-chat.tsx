"use client";

/**
 * Chat-with-Scout panel.
 *
 * Consumes the `liveProposal.observation` snapshot from DemoProvider
 * (populated by `runLiveScoutProposal`) and forwards each user
 * question plus the observation to `POST /api/ai/chat`, which in turn
 * picks the best available LLM backend (Anthropic → OpenAI → offline
 * fallback with honest banner).
 *
 * This closes the "no AI conversational interaction" gap in the
 * Build X scoring rubric without pretending to be an AI when no LLM
 * key is configured — the offline path is clearly labelled.
 */

import { useState } from "react";
import { useDemo } from "@/components/demo-provider";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: ChatRole;
  text: string;
  mode?: "anthropic" | "openai" | "offline";
  model?: string;
};

const SAMPLE_QUESTIONS = [
  "Is now a good time to sign this warrant?",
  "What does the CEX deviation imply for this rebalance?",
  "Should I widen the range before signing?",
  "Explain the tick-neighborhood signal in plain English.",
];

export function ScoutChat() {
  const { liveProposal } = useDemo();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyForChat = Boolean(liveProposal?.observation);

  const send = async (question?: string) => {
    const trimmed = (question ?? input).trim();
    if (!trimmed || !liveProposal?.observation || isSending) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observation: liveProposal.observation,
          question: trimmed,
          history,
        }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        reply?: {
          mode: "anthropic" | "openai" | "offline";
          text: string;
          model?: string;
        };
        error?: string;
      };

      if (!response.ok || !body.ok || !body.reply) {
        throw new Error(body.error ?? `Chat endpoint returned HTTP ${response.status}.`);
      }

      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        text: body.reply.text,
        mode: body.reply.mode,
        model: body.reply.model,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed.");
    } finally {
      setIsSending(false);
    }
  };

  const bannerForMode = (mode: ChatMessage["mode"]) => {
    if (!mode) return null;
    if (mode === "offline") {
      return (
        <span className="pill pill-amber" style={{ fontSize: 10 }}>
          offline · add LLM key to enable live AI
        </span>
      );
    }
    return (
      <span className="pill pill-cyan" style={{ fontSize: 10 }}>
        {mode === "anthropic" ? "Claude Haiku" : "GPT-4o-mini"}
      </span>
    );
  };

  if (!readyForChat) {
    return (
      <div
        className="card"
        style={{ padding: 18, display: "grid", gap: 10 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--text-muted)",
              display: "inline-block",
            }}
          />
          <strong style={{ color: "var(--text-primary)" }}>Chat with Scout</strong>
          <span className="pill" style={{ fontSize: 10 }}>
            idle
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
          Run <strong>⚡ Live scout (X Layer Uniswap v3)</strong> first. Once
          the Scout has an on-chain observation I can reason about, this
          panel unlocks for questions.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--status-success)",
              boxShadow: "0 0 8px var(--status-success)",
              display: "inline-block",
            }}
          />
          <strong style={{ color: "var(--text-primary)" }}>Chat with Scout</strong>
          <span className="pill pill-cyan" style={{ fontSize: 10 }}>
            bound to block {liveProposal!.blockNumber}
          </span>
        </div>
        {liveProposal?.llmAdvice && (
          <span
            className={`pill ${liveProposal.llmAdvice.recommendation === "sign-warrant" ? "pill-cyan" : "pill-amber"}`}
            style={{ fontSize: 10 }}
            title={liveProposal.llmAdvice.rationale}
          >
            advisor: {liveProposal.llmAdvice.recommendation} ·{" "}
            {(liveProposal.llmAdvice.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {messages.length === 0 && (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "6px 0",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          <span style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 10 }}>
            suggestions
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() => send(q)}
                disabled={isSending}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: 280,
          overflowY: "auto",
          padding: messages.length > 0 ? "4px 0" : 0,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "grid",
              gap: 4,
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background:
                m.role === "user"
                  ? "rgba(143, 245, 255, 0.04)"
                  : "var(--surface-3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
              }}
            >
              <span>{m.role === "user" ? "owner" : "scout agent"}</span>
              {m.role === "assistant" && bannerForMode(m.mode)}
            </div>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </p>
          </div>
        ))}
        {isSending && (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--surface-3)",
              color: "var(--text-muted)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Scout is thinking…
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--status-danger)", fontSize: 12, margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask Scout about the current pool state…"
          disabled={isSending}
          className="input"
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={isSending || !input.trim()}
          onClick={() => void send()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
