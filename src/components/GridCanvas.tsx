"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { WorldState, Agent, ColorMode, TradeFlash } from "@/lib/types";
import { GRID_SIZE, AGENT_COLORS } from "@/lib/constants";

interface GridCanvasProps {
  world: WorldState;
  colorMode: ColorMode;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onHoverAgent: (agent: Agent | null, x: number, y: number) => void;
}

export default function GridCanvas({
  world,
  colorMode,
  selectedAgentId,
  onSelectAgent,
  onHoverAgent,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(32);

  // Responsive cell sizing
  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = Math.floor(Math.min(rect.width, rect.height) / GRID_SIZE);
      setCellSize(Math.max(16, Math.min(48, size)));
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Get agent color based on mode
  const getAgentColor = useCallback(
    (agent: Agent): { r: number; g: number; b: number; a: number } => {
      const opacity = 0.3 + (agent.health / 100) * 0.7;

      if (colorMode === "type") {
        const hex = AGENT_COLORS[agent.type];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b, a: opacity };
      }

      if (colorMode === "health") {
        const h = agent.health / 100;
        const r = Math.round(255 * (1 - h));
        const g = Math.round(255 * h);
        return { r, g, b: 50, a: opacity };
      }

      // Wealth mode
      const allAgents = Object.values(world.agents).filter((a) => a.alive);
      const maxWealth = Math.max(...allAgents.map((a) => a.net_worth), 1);
      const w = agent.net_worth / maxWealth;
      const r = Math.round(100 + 155 * w);
      const g = Math.round(50 + 155 * w);
      const b = Math.round(200 * (1 - w));
      return { r, g, b, a: opacity };
    },
    [colorMode, world.agents]
  );

  // Draw the grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalSize = cellSize * GRID_SIZE;
    canvas.width = totalSize;
    canvas.height = totalSize;

    // Background
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw cells
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        const agentId = world.grid[y]?.[x];

        if (agentId && world.agents[agentId]?.alive) {
          const agent = world.agents[agentId];
          const color = getAgentColor(agent);

          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

          // Worker indicator — small dot in employer's color
          if (agent.contract && agent.contract.active && agent.employer_id) {
            const employer = world.agents[agent.employer_id];
            if (employer) {
              const empColor = AGENT_COLORS[employer.type];
              ctx.fillStyle = empColor;
              const dotSize = Math.max(3, cellSize / 5);
              ctx.fillRect(px + cellSize - dotSize - 2, py + 2, dotSize, dotSize);
            }
          }

          // Selected highlight
          if (agentId === selectedAgentId) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          }

          // Dynasty highlight — when a family member is selected, highlight all dynasty members
          if (selectedAgentId && agentId !== selectedAgentId) {
            const selectedAgent = world.agents[selectedAgentId];
            if (selectedAgent) {
              const isFamilyMember =
                agent.parent_id === selectedAgentId ||
                selectedAgent.parent_id === agentId ||
                selectedAgent.children_ids.includes(agentId) ||
                agent.children_ids.includes(selectedAgentId);
              if (isFamilyMember) {
                ctx.strokeStyle = "rgba(244, 114, 182, 0.7)"; // pink
                ctx.lineWidth = 1.5;
                ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
              }
            }
          }
        } else {
          ctx.fillStyle = "#14142a";
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
        }
      }
    }

    // Grid lines (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, totalSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(totalSize, i * cellSize);
      ctx.stroke();
    }

    // ── Trade Flash Animation ──
    const now = Date.now();
    for (const flash of world.tradeFlashes) {
      const age = now - flash.timestamp;
      if (age > 400) continue;
      const alpha = Math.max(0, 1 - age / 400) * 0.7;

      const fromCx = flash.from.x * cellSize + cellSize / 2;
      const fromCy = flash.from.y * cellSize + cellSize / 2;
      const toCx = flash.to.x * cellSize + cellSize / 2;
      const toCy = flash.to.y * cellSize + cellSize / 2;

      ctx.beginPath();
      ctx.moveTo(fromCx, fromCy);
      ctx.lineTo(toCx, toCy);
      ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      const glowAlpha = alpha * 0.3;
      ctx.fillStyle = `rgba(34, 197, 94, ${glowAlpha})`;
      ctx.fillRect(flash.from.x * cellSize + 1, flash.from.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.fillRect(flash.to.x * cellSize + 1, flash.to.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }

    // ── Spawn Flash Animation (births & hires) ──
    for (const flash of (world.spawnFlashes || [])) {
      const age = now - flash.timestamp;
      if (age > 800) continue;
      const alpha = Math.max(0, 1 - age / 800) * 0.8;
      const scale = 1 + (age / 800) * 0.5; // Slight expansion

      const cx = flash.position.x * cellSize + cellSize / 2;
      const cy = flash.position.y * cellSize + cellSize / 2;
      const radius = (cellSize / 2) * scale;

      const color = flash.type === "birth"
        ? `rgba(244, 114, 182, ${alpha})` // pink for birth
        : `rgba(34, 211, 238, ${alpha})`; // cyan for hire

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner glow
      ctx.fillStyle = flash.type === "birth"
        ? `rgba(244, 114, 182, ${alpha * 0.2})`
        : `rgba(34, 211, 238, ${alpha * 0.2})`;
      ctx.fill();
    }
  }, [world, cellSize, colorMode, selectedAgentId, getAgentColor]);

  // Mouse handlers
  const getGridPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;
    return { x, y };
  };

  const handleClick = (e: React.MouseEvent) => {
    const pos = getGridPos(e);
    if (!pos) return;
    const agentId = world.grid[pos.y][pos.x];
    onSelectAgent(agentId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getGridPos(e);
    if (!pos) {
      onHoverAgent(null, 0, 0);
      return;
    }
    const agentId = world.grid[pos.y][pos.x];
    if (agentId && world.agents[agentId]?.alive) {
      onHoverAgent(world.agents[agentId], e.clientX, e.clientY);
    } else {
      onHoverAgent(null, 0, 0);
    }
  };

  const handleMouseLeave = () => {
    onHoverAgent(null, 0, 0);
  };

  return (
    <div ref={containerRef} className="grid-container">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
