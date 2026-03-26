"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { WorldState, Agent, ColorMode, Experiment, AgentDecision, ReflectionDecision } from "@/lib/types";
import {
  initWorld,
  tickWorld,
  buildThinkRequests,
  applyStrategicDecisions,
  applyReflectionDecisions,
} from "@/lib/simulation";
import GridCanvas from "@/components/GridCanvas";
import ControlsBar from "@/components/ControlsBar";
import AgentDetailCard from "@/components/AgentDetailCard";
import ChatFeed from "@/components/ChatFeed";
import Dashboard from "@/components/Dashboard";
import Tooltip from "@/components/Tooltip";

export default function Home() {
  const [world, setWorld] = useState<WorldState>(() => initWorld());
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const runningRef = useRef(false);
  const speedRef = useRef(world.speed);
  const llmEnabledRef = useRef(world.llmEnabled);
  const thinkingRef = useRef(false);

  useEffect(() => {
    runningRef.current = world.running;
    speedRef.current = world.speed;
    llmEnabledRef.current = world.llmEnabled;
  }, [world.running, world.speed, world.llmEnabled]);

  // LLM thinking function
  const doLLMThinking = useCallback(async (currentWorld: WorldState, thinkType: "strategic" | "reflection") => {
    if (thinkingRef.current) return;
    thinkingRef.current = true;

    try {
      const requests = buildThinkRequests(currentWorld, thinkType);
      if (requests.length === 0) return;

      const response = await fetch("/api/think", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: requests, think_type: thinkType }),
      });

      if (!response.ok) {
        console.error("LLM API error:", response.status);
        return;
      }

      const data = await response.json();
      const decisions = data.decisions || [];

      setWorld((prev) => {
        if (thinkType === "reflection") {
          return applyReflectionDecisions(prev, decisions as ReflectionDecision[]);
        } else {
          return applyStrategicDecisions(prev, decisions as AgentDecision[]);
        }
      });
    } catch (error) {
      console.error("LLM thinking error:", error);
    } finally {
      thinkingRef.current = false;
      setWorld((prev) => ({ ...prev, thinkingInProgress: false }));
    }
  }, []);

  // Simulation loop
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function loop() {
      if (!runningRef.current || thinkingRef.current) return;
      setWorld((prev) => {
        const next = tickWorld(prev);
        if (next.population === 0) {
          return { ...next, running: false };
        }

        // Trigger LLM thinking on strategic/reflection ticks
        if (llmEnabledRef.current && next.tick > 0 && !thinkingRef.current) {
          if (next.tick % 100 === 0) {
            // Reflection tick
            setTimeout(() => doLLMThinking(next, "reflection"), 0);
            return { ...next, thinkingInProgress: true };
          } else if (next.tick % 10 === 0) {
            // Strategic tick
            setTimeout(() => doLLMThinking(next, "strategic"), 0);
            return { ...next, thinkingInProgress: true };
          }
        }

        return next;
      });
      const delay = Math.max(10, 1000 / speedRef.current);
      timeoutId = setTimeout(loop, delay);
    }

    if (world.running && !world.thinkingInProgress) {
      loop();
    }

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.running, world.speed, world.thinkingInProgress, doLLMThinking]);

  const handlePlay = useCallback(() => {
    setWorld((prev) => ({ ...prev, running: true }));
  }, []);

  const handlePause = useCallback(() => {
    setWorld((prev) => ({ ...prev, running: false }));
  }, []);

  const handleStep = useCallback(() => {
    setWorld((prev) => tickWorld(prev));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedAgentId(null);
    setWorld((prev) => initWorld(prev.activeExperiment));
  }, []);

  const handleExperimentChange = useCallback((experiment: Experiment | null) => {
    setSelectedAgentId(null);
    setWorld(initWorld(experiment));
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setWorld((prev) => ({ ...prev, speed }));
  }, []);

  const handleSelectAgent = useCallback((id: string | null) => {
    setSelectedAgentId(id);
  }, []);

  const handleHoverAgent = useCallback(
    (agent: Agent | null, x: number, y: number) => {
      setHoveredAgent(agent);
      setTooltipPos({ x, y });
    },
    []
  );

  const handleToggleLLM = useCallback(() => {
    setWorld((prev) => ({ ...prev, llmEnabled: !prev.llmEnabled }));
  }, []);

  const selectedAgent = selectedAgentId
    ? world.agents[selectedAgentId] ?? null
    : null;

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-emoji">🌍</span> Microworld
          </h1>
          <span className="app-subtitle">Economic Simulation</span>
        </div>
        <div className="header-right">
          <button
            className={`llm-toggle ${world.llmEnabled ? "llm-active" : ""}`}
            onClick={handleToggleLLM}
            title={world.llmEnabled ? "LLM thinking enabled" : "LLM thinking disabled"}
          >
            <span className="llm-icon">🧠</span>
            <span className="llm-label">{world.llmEnabled ? "AI ON" : "AI OFF"}</span>
            {world.thinkingInProgress && <span className="llm-spinner">⏳</span>}
          </button>
        </div>
      </header>

      {/* Controls */}
      <ControlsBar
        tick={world.tick}
        population={world.population}
        initialPopulation={world.initialPopulation}
        running={world.running}
        speed={world.speed}
        colorMode={colorMode}
        activeExperiment={world.activeExperiment}
        onPlay={handlePlay}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
        onColorModeChange={setColorMode}
        onExperimentChange={handleExperimentChange}
      />

      {/* Main Content — Two Panel Layout */}
      <div className="main-content">
        {/* Left: Map + Detail */}
        <div className="left-panel">
          <div className="map-section">
            <GridCanvas
              world={world}
              colorMode={colorMode}
              selectedAgentId={selectedAgentId}
              onSelectAgent={handleSelectAgent}
              onHoverAgent={handleHoverAgent}
            />

            {/* Legend */}
            <div className="map-legend">
              {colorMode === "type" && (
                <>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#22c55e" }} />
                    <span>Farmer</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#f97316" }} />
                    <span>Builder</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#eab308" }} />
                    <span>Energist</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#94a3b8" }} />
                    <span>Generalist</span>
                  </div>
                </>
              )}
              {colorMode === "health" && (
                <>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#22c55e" }} />
                    <span>Healthy</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#eab308" }} />
                    <span>Declining</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#ef4444" }} />
                    <span>Dying</span>
                  </div>
                </>
              )}
              {colorMode === "wealth" && (
                <>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#6438c8" }} />
                    <span>Poor</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#ffc830" }} />
                    <span>Rich</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Detail Card (below grid) */}
          <div className="detail-section">
            {selectedAgent ? (
              <AgentDetailCard
                agent={selectedAgent}
                agents={world.agents}
                dynasties={world.dynasties}
                onClose={() => setSelectedAgentId(null)}
                onSelectAgent={handleSelectAgent}
              />
            ) : (
              <div className="detail-placeholder">
                <div className="placeholder-icon">🔍</div>
                <p>Click an agent on the grid to inspect</p>
              </div>
            )}

            {/* Population Summary */}
            <div className="population-summary">
              <h3 className="section-title">Population</h3>
              <div className="pop-bars">
                {(["farmer", "builder", "energist", "generalist"] as const).map(
                  (type) => {
                    const aliveOfType = Object.values(world.agents).filter(
                      (a) => a.alive && a.type === type
                    ).length;
                    const pct = world.initialPopulation
                      ? (aliveOfType / world.initialPopulation) * 100
                      : 0;
                    const colors: Record<string, string> = {
                      farmer: "#22c55e",
                      builder: "#f97316",
                      energist: "#eab308",
                      generalist: "#94a3b8",
                    };
                    return (
                      <div key={type} className="pop-bar-row">
                        <span className="pop-bar-label">{type}</span>
                        <div className="pop-bar-track">
                          <div
                            className="pop-bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: colors[type],
                            }}
                          />
                        </div>
                        <span className="pop-bar-count">{aliveOfType}</span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chat Feed */}
        <ChatFeed
          events={world.events}
          agents={world.agents}
          onSelectAgent={(id) => setSelectedAgentId(id)}
        />
      </div>

      {/* Dashboard */}
      <Dashboard
        statsHistory={world.statsHistory}
        agents={world.agents}
        dynasties={world.dynasties}
        speed={world.speed}
        onSelectAgent={handleSelectAgent}
      />

      {/* Tooltip */}
      <Tooltip agent={hoveredAgent} x={tooltipPos.x} y={tooltipPos.y} />
    </main>
  );
}
