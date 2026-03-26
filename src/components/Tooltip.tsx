"use client";

import { Agent } from "@/lib/types";
import { AGENT_CONFIGS } from "@/lib/constants";

interface TooltipProps {
  agent: Agent | null;
  x: number;
  y: number;
}

export default function Tooltip({ agent, x, y }: TooltipProps) {
  if (!agent) return null;

  const cfg = AGENT_CONFIGS[agent.type];

  return (
    <div
      className="tooltip"
      style={{
        left: x + 16,
        top: y - 8,
      }}
    >
      <div className="tooltip-header">
        {cfg.emoji} {agent.id}
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Type:</span>
        <span>{agent.type}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">HP:</span>
        <span
          style={{
            color:
              agent.health > 60
                ? "#22c55e"
                : agent.health > 30
                ? "#eab308"
                : "#ef4444",
          }}
        >
          {agent.health}
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">⚡</span>
        <span>{agent.inventory.energy}</span>
        <span className="tooltip-label">🌾</span>
        <span>{agent.inventory.food}</span>
        <span className="tooltip-label">🏠</span>
        <span>{agent.inventory.shelter}</span>
      </div>
    </div>
  );
}
