"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { WorldEvent, ChatFilter, Agent } from "@/lib/types";

interface ChatFeedProps {
  events: WorldEvent[];
  agents: Record<string, Agent>;
  onSelectAgent: (id: string) => void;
}

const FILTER_OPTIONS: { value: ChatFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "deaths", label: "Deaths" },
  { value: "warnings", label: "Warnings" },
  { value: "migrations", label: "Moves" },
  { value: "thoughts", label: "Thoughts" },
  { value: "family", label: "Family" },
  { value: "experiments", label: "⚡ Events" },
];

function filterEvents(events: WorldEvent[], filter: ChatFilter, search: string): WorldEvent[] {
  let filtered = events;

  if (filter === "trades") {
    filtered = filtered.filter(
      (e) => e.type === "trade_executed" || e.type === "trade_rejected"
    );
  } else if (filter === "deaths") {
    filtered = filtered.filter((e) => e.type === "death");
  } else if (filter === "warnings") {
    filtered = filtered.filter((e) => e.type === "needs_unmet");
  } else if (filter === "migrations") {
    filtered = filtered.filter((e) => e.type === "migration");
  } else if (filter === "thoughts") {
    filtered = filtered.filter(
      (e) => e.type === "strategic_thought" || e.type === "reflection"
    );
  } else if (filter === "family") {
    filtered = filtered.filter(
      (e) => e.type === "birth" || e.type === "hire" || e.type === "contract_break" || e.type === "revenue_share"
    );
  } else if (filter === "experiments") {
    filtered = filtered.filter((e) => e.type === "experiment");
  }

  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.agents.some((a) => a.toLowerCase().includes(s)) ||
        e.message.toLowerCase().includes(s)
    );
  }

  return filtered;
}

function getEventColor(type: string): string {
  switch (type) {
    case "trade_executed":
      return "var(--green)";
    case "trade_rejected":
      return "var(--orange)";
    case "death":
      return "var(--red)";
    case "needs_unmet":
      return "var(--yellow)";
    case "migration":
      return "var(--blue, #38bdf8)";
    case "strategic_thought":
      return "#a78bfa";
    case "reflection":
      return "#c084fc";
    case "birth":
      return "#f472b6";
    case "hire":
      return "#22d3ee";
    case "contract_break":
      return "#fb923c";
    case "revenue_share":
      return "#fbbf24";
    case "experiment":
      return "#ff6b35";
    default:
      return "var(--text-secondary)";
  }
}

function getEventIcon(type: string): string {
  switch (type) {
    case "trade_executed":
      return "✅";
    case "trade_rejected":
      return "❌";
    case "death":
      return "💀";
    case "needs_unmet":
      return "⚠️";
    case "migration":
      return "🚶";
    case "strategic_thought":
      return "🧠";
    case "reflection":
      return "💭";
    case "birth":
      return "🎉";
    case "hire":
      return "💼";
    case "contract_break":
      return "🔓";
    case "revenue_share":
      return "💰";
    case "experiment":
      return "⚡";
    default:
      return "📌";
  }
}

export default function ChatFeed({ events, agents, onSelectAgent }: ChatFeedProps) {
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const filteredEvents = filterEvents(events, filter, search);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [filteredEvents.length, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  // Make agent IDs clickable
  const renderMessage = (msg: string, eventAgents: string[]) => {
    let parts: (string | React.ReactElement)[] = [msg];

    for (const agentId of eventAgents) {
      const newParts: (string | React.ReactElement)[] = [];
      for (const part of parts) {
        if (typeof part !== "string") {
          newParts.push(part);
          continue;
        }
        const idx = part.indexOf(agentId);
        if (idx === -1) {
          newParts.push(part);
          continue;
        }
        if (idx > 0) newParts.push(part.slice(0, idx));
        newParts.push(
          <button
            key={`${agentId}-${idx}`}
            className="chat-agent-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAgent(agentId);
            }}
          >
            {agentId}
          </button>
        );
        if (idx + agentId.length < part.length) {
          newParts.push(part.slice(idx + agentId.length));
        }
      }
      parts = newParts;
    }

    return parts;
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-title-icon">📜</span>
          <span>Town Square</span>
          <span className="chat-count">{filteredEvents.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="chat-filters">
        <div className="chat-filter-tabs">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`chat-filter-btn ${
                filter === opt.value ? "chat-filter-btn-active" : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="chat-search-wrap">
          <input
            type="text"
            placeholder="Search agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="chat-search"
          />
          {search && (
            <button className="chat-search-clear" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {filteredEvents.length === 0 ? (
          <div className="chat-empty">
            <p>No events yet. Start the simulation!</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`chat-event${event.type === "experiment" ? " chat-event-experiment" : ""}`}
              style={{
                borderLeftColor: getEventColor(event.type),
              }}
            >
              <div className="chat-event-header">
                <span className="chat-event-tick">Tick {event.tick}</span>
                <span className="chat-event-type">
                  {getEventIcon(event.type)}
                </span>
              </div>
              <div className="chat-event-message">
                {event.message.split("\n").map((line, i) => (
                  <div key={i}>
                    {renderMessage(line, event.agents)}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
