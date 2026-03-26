"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TickStats, Agent, Dynasty } from "@/lib/types";
import { AGENT_COLORS } from "@/lib/constants";

interface DashboardProps {
  statsHistory: TickStats[];
  agents: Record<string, Agent>;
  dynasties: Record<string, Dynasty>;
  speed: number;
  onSelectAgent: (id: string) => void;
}

export default function Dashboard({
  statsHistory,
  agents,
  dynasties,
  speed,
  onSelectAgent,
}: DashboardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Throttle chart updates at high speed
  const chartData = useMemo(() => {
    if (speed > 10) {
      // Only show every 5th tick
      return statsHistory.filter((_, i) => i % 5 === 0 || i === statsHistory.length - 1);
    }
    return statsHistory;
  }, [statsHistory, speed]);

  // Population chart data
  const populationData = useMemo(
    () =>
      chartData.map((s) => ({
        tick: s.tick,
        farmer: s.population_by_type.farmer || 0,
        builder: s.population_by_type.builder || 0,
        energist: s.population_by_type.energist || 0,
        generalist: s.population_by_type.generalist || 0,
      })),
    [chartData]
  );

  // Gini + health chart data
  const metricsData = useMemo(
    () =>
      chartData.map((s) => ({
        tick: s.tick,
        gini: Number(s.gini_coefficient.toFixed(3)),
        health: s.avg_health,
      })),
    [chartData]
  );

  // Trade volume data (last 50 ticks)
  const tradeData = useMemo(() => {
    const last50 = chartData.slice(-50);
    return last50.map((s) => ({
      tick: s.tick,
      executed: s.trades_executed,
      rejected: s.trades_rejected,
    }));
  }, [chartData]);

  // Leaderboard
  const leaderboard = useMemo(() => {
    const aliveAgents = Object.values(agents)
      .filter((a) => a.alive)
      .sort((a, b) => b.net_worth - a.net_worth);
    return {
      top5: aliveAgents.slice(0, 5),
      bottom5: aliveAgents.slice(-5).reverse(),
    };
  }, [agents]);

  const handleAgentClick = useCallback(
    (id: string) => {
      onSelectAgent(id);
    },
    [onSelectAgent]
  );

  // Phase 5 stats
  const birthRate = useMemo(() => {
    const last10 = statsHistory.slice(-10);
    if (last10.length === 0) return 0;
    const totalBirths = last10.reduce((s, t) => s + (t.births || 0), 0);
    return (totalBirths / last10.length).toFixed(1);
  }, [statsHistory]);

  const employmentRate = useMemo(() => {
    const aliveAgents = Object.values(agents).filter((a) => a.alive);
    if (aliveAgents.length === 0) return 0;
    const employed = aliveAgents.filter((a) => a.contract && a.contract.active).length;
    return Math.round((employed / aliveAgents.length) * 100);
  }, [agents]);

  const largestDynasty = useMemo(() => {
    const dynastyList = Object.values(dynasties);
    if (dynastyList.length === 0) return null;
    return dynastyList.reduce((best, d) => (d.members.length > best.members.length ? d : best), dynastyList[0]);
  }, [dynasties]);

  return (
    <div className={`dashboard ${collapsed ? "dashboard-collapsed" : ""}`}>
      <button
        className="dashboard-toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="dashboard-toggle-icon">📊</span>
        <span className="dashboard-toggle-label">Dashboard</span>
        <span className="dashboard-toggle-arrow">
          {collapsed ? "▲" : "▼"}
        </span>
      </button>

      {!collapsed && (
        <div className="dashboard-content">
          {/* Phase 5 Summary Stats */}
          <div className="dashboard-summary">
            <div className="summary-card summary-birth">
              <span className="summary-icon">🎉</span>
              <span className="summary-value">{birthRate}</span>
              <span className="summary-label">Births/10t</span>
            </div>
            <div className="summary-card summary-employment">
              <span className="summary-icon">💼</span>
              <span className="summary-value">{employmentRate}%</span>
              <span className="summary-label">Employed</span>
            </div>
            <div className="summary-card summary-dynasty">
              <span className="summary-icon">👑</span>
              <span className="summary-value">{largestDynasty ? largestDynasty.members.length : 0}</span>
              <span className="summary-label">{largestDynasty ? `Dynasty: ${largestDynasty.founder_id}` : "No dynasties"}</span>
            </div>
            <div className="summary-card summary-dynasties">
              <span className="summary-icon">🏰</span>
              <span className="summary-value">{Object.keys(dynasties).length}</span>
              <span className="summary-label">Dynasties</span>
            </div>
          </div>

          <div className="dashboard-charts">
            {/* Chart 1: Population */}
            <div className="chart-card">
              <h4 className="chart-title">Population by Type</h4>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={populationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="tick"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="farmer"
                    stackId="1"
                    stroke={AGENT_COLORS.farmer}
                    fill={AGENT_COLORS.farmer}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="builder"
                    stackId="1"
                    stroke={AGENT_COLORS.builder}
                    fill={AGENT_COLORS.builder}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="energist"
                    stackId="1"
                    stroke={AGENT_COLORS.energist}
                    fill={AGENT_COLORS.energist}
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="generalist"
                    stackId="1"
                    stroke={AGENT_COLORS.generalist}
                    fill={AGENT_COLORS.generalist}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Gini Coefficient */}
            <div className="chart-card">
              <h4 className="chart-title">Gini Coefficient</h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="tick"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gini"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Trade Volume */}
            <div className="chart-card">
              <h4 className="chart-title">Trade Volume</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tradeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="tick"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="executed"
                    stackId="trades"
                    fill="#22c55e"
                    name="Executed"
                  />
                  <Bar
                    dataKey="rejected"
                    stackId="trades"
                    fill="#ef4444"
                    name="Rejected"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: Average Health */}
            <div className="chart-card">
              <h4 className="chart-title">Average Health</h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="tick"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="health"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    name="Avg Health"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="dashboard-leaderboard">
            <div className="leaderboard-section">
              <span className="leaderboard-label">🏆 Top 5</span>
              <div className="leaderboard-agents">
                {leaderboard.top5.map((agent) => (
                  <button
                    key={agent.id}
                    className="leaderboard-agent leaderboard-top"
                    onClick={() => handleAgentClick(agent.id)}
                  >
                    <span className="leaderboard-name">{agent.id}</span>
                    <span className="leaderboard-worth">
                      ({Math.round(agent.net_worth)})
                    </span>
                  </button>
                ))}
                {leaderboard.top5.length === 0 && (
                  <span className="leaderboard-empty">No agents alive</span>
                )}
              </div>
            </div>
            <div className="leaderboard-section">
              <span className="leaderboard-label">💀 Bottom 5</span>
              <div className="leaderboard-agents">
                {leaderboard.bottom5.map((agent) => (
                  <button
                    key={agent.id}
                    className="leaderboard-agent leaderboard-bottom"
                    onClick={() => handleAgentClick(agent.id)}
                  >
                    <span className="leaderboard-name">{agent.id}</span>
                    <span className="leaderboard-worth">
                      ({Math.round(agent.net_worth)})
                    </span>
                  </button>
                ))}
                {leaderboard.bottom5.length === 0 && (
                  <span className="leaderboard-empty">No agents alive</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
