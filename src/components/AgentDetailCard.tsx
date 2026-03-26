"use client";

import { Agent, Dynasty } from "@/lib/types";
import { AGENT_CONFIGS } from "@/lib/constants";

interface AgentDetailCardProps {
  agent: Agent | null;
  agents: Record<string, Agent>;
  dynasties: Record<string, Dynasty>;
  onClose: () => void;
  onSelectAgent: (id: string) => void;
}

export default function AgentDetailCard({ agent, agents, dynasties, onClose, onSelectAgent }: AgentDetailCardProps) {
  if (!agent) return null;

  const cfg = AGENT_CONFIGS[agent.type];
  const healthPct = Math.max(0, agent.health);

  // Find dynasty for this agent
  const findDynasty = (): Dynasty | null => {
    // Check if agent IS a founder
    if (dynasties[agent.id]) return dynasties[agent.id];
    // Walk up the family tree to find founder
    let current = agent;
    while (current.parent_id && agents[current.parent_id]) {
      current = agents[current.parent_id];
      if (dynasties[current.id]) return dynasties[current.id];
    }
    return null;
  };
  const dynasty = findDynasty();

  return (
    <div className="detail-card">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-title">
          <span className="detail-emoji">{cfg.emoji}</span>
          <span className="detail-name">{agent.id}</span>
          <span className="detail-type">
            {agent.type.charAt(0).toUpperCase() + agent.type.slice(1)}
          </span>
          {!agent.alive && <span className="detail-dead">💀 DEAD</span>}
        </div>
        <button onClick={onClose} className="detail-close">✕</button>
      </div>

      {/* Health Bar */}
      <div className="detail-section">
        <div className="detail-label">Health</div>
        <div className="health-bar-container">
          <div
            className="health-bar-fill"
            style={{
              width: `${healthPct}%`,
              backgroundColor:
                healthPct > 60
                  ? "#22c55e"
                  : healthPct > 30
                  ? "#eab308"
                  : "#ef4444",
            }}
          />
        </div>
        <span className="health-text">{healthPct}/100</span>
      </div>

      {/* Position */}
      <div className="detail-section">
        <div className="detail-label">Position</div>
        <span className="detail-value">
          ({agent.position.x}, {agent.position.y})
        </span>
      </div>

      {/* Inventory */}
      <div className="detail-section">
        <div className="detail-label">Inventory</div>
        <div className="inventory-grid">
          <div className="inventory-item">
            <span className="inv-icon">⚡</span>
            <span className="inv-label">Energy</span>
            <span className="inv-value">{agent.inventory.energy}</span>
          </div>
          <div className="inventory-item">
            <span className="inv-icon">🌾</span>
            <span className="inv-label">Food</span>
            <span className="inv-value">{agent.inventory.food}</span>
          </div>
          <div className="inventory-item">
            <span className="inv-icon">🏠</span>
            <span className="inv-label">Shelter</span>
            <span className="inv-value">{agent.inventory.shelter}</span>
          </div>
        </div>
      </div>

      {/* Traits */}
      <div className="detail-section">
        <div className="detail-label">Traits</div>
        <div className="traits-grid">
          {Object.entries(agent.traits).map(([key, val]) => (
            <div key={key} className="trait-item">
              <span className="trait-name">
                {key.replace(/_/g, " ")}
              </span>
              <div className="trait-bar-container">
                <div
                  className="trait-bar-fill"
                  style={{ width: `${(val as number) * 100}%` }}
                />
              </div>
              <span className="trait-value">{(val as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="detail-section">
        <div className="detail-label">Stats</div>
        <div className="stats-row">
          <span>Alive: {agent.ticks_alive} ticks</span>
          <span>Net worth: {agent.net_worth}</span>
        </div>
        {agent.ticks_needs_unmet > 0 && (
          <div className="needs-warning">
            ⚠️ Needs unmet for {agent.ticks_needs_unmet} consecutive ticks
          </div>
        )}
      </div>

      {/* Family Tree */}
      {(agent.parent_id || agent.children_ids.length > 0 || dynasty) && (
        <div className="detail-section">
          <div className="detail-label">👪 Family</div>
          <div className="family-info">
            <div className="family-row">
              <span className="family-key">Generation:</span>
              <span className="family-value">{agent.generation}</span>
            </div>
            {agent.parent_id && (
              <div className="family-row">
                <span className="family-key">Parent:</span>
                <button className="agent-link" onClick={() => onSelectAgent(agent.parent_id!)}>
                  {agent.parent_id}
                </button>
              </div>
            )}
            {agent.children_ids.length > 0 && (
              <div className="family-row">
                <span className="family-key">Children:</span>
                <span className="family-children">
                  {agent.children_ids.map((cid) => (
                    <button key={cid} className="agent-link" onClick={() => onSelectAgent(cid)}>
                      {cid}
                    </button>
                  ))}
                </span>
              </div>
            )}
            {dynasty && (
              <div className="dynasty-info">
                <span className="dynasty-badge">👑 Dynasty of {dynasty.founder_id}</span>
                <span className="dynasty-stat">{dynasty.members.length} living | {dynasty.total_ever} total | ⊕{dynasty.total_net_worth}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employment */}
      {(agent.employer_id || agent.employee_ids.length > 0 || agent.contract) && (
        <div className="detail-section">
          <div className="detail-label">💼 Employment</div>
          <div className="employment-info">
            {agent.contract && agent.contract.active && agent.employer_id && (
              <div className="contract-info">
                <span className="contract-badge">📋 Worker</span>
                <div className="family-row">
                  <span className="family-key">Employer:</span>
                  <button className="agent-link" onClick={() => onSelectAgent(agent.employer_id!)}>
                    {agent.employer_id}
                  </button>
                </div>
                <div className="family-row">
                  <span className="family-key">Revenue share:</span>
                  <span className="family-value">{Math.round(agent.contract.revenue_share * 100)}%</span>
                </div>
              </div>
            )}
            {agent.contract && !agent.contract.active && (
              <div className="contract-info contract-inactive">
                <span className="contract-badge">🔓 Independent (ex-worker)</span>
              </div>
            )}
            {agent.employee_ids.length > 0 && (
              <div className="employees-info">
                <span className="contract-badge">👔 Employer</span>
                <div className="family-row">
                  <span className="family-key">Workers:</span>
                  <span className="family-children">
                    {agent.employee_ids.map((eid) => (
                      <button key={eid} className="agent-link" onClick={() => onSelectAgent(eid)}>
                        {eid}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategic Plan */}
      {agent.strategic_plan && (
        <div className="detail-section">
          <div className="detail-label">🧠 Strategic Plan</div>
          <div className="strategic-plan">
            <div className="plan-item">
              <span className="plan-key">Focus:</span>
              <span className="plan-value">{agent.strategic_plan.production_focus}</span>
            </div>
            <div className="plan-item">
              <span className="plan-key">Offer:</span>
              <span className="plan-value">{agent.strategic_plan.willing_to_offer}</span>
            </div>
            <div className="plan-item">
              <span className="plan-key">Seek:</span>
              <span className="plan-value">{agent.strategic_plan.seeking}</span>
            </div>
            <div className="plan-thought">
              &ldquo;{agent.strategic_plan.thought}&rdquo;
            </div>
          </div>
        </div>
      )}

      {/* Memory */}
      {agent.memory.length > 0 && (
        <div className="detail-section">
          <div className="detail-label">📝 Memory ({agent.memory.length}/20)</div>
          <div className="memory-list">
            {agent.memory.slice(-5).reverse().map((m, i) => (
              <div key={i} className={`memory-entry memory-${m.sentiment}`}>
                <span className="memory-tick">T{m.tick}</span>
                <span className="memory-sentiment">
                  {m.sentiment === "positive" ? "✅" : m.sentiment === "negative" ? "❌" : "⚪"}
                </span>
                <span className="memory-text">{m.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reputation */}
      {Object.keys(agent.reputation).length > 0 && (
        <div className="detail-section">
          <div className="detail-label">🤝 Reputation</div>
          <div className="reputation-list">
            {Object.values(agent.reputation)
              .sort((a, b) => b.trust_score - a.trust_score)
              .slice(0, 5)
              .map((rep) => (
                <div key={rep.agent_id} className="reputation-entry">
                  <span className="rep-name">{rep.agent_id}</span>
                  <div className="rep-bar-container">
                    <div
                      className="rep-bar-fill"
                      style={{
                        width: `${rep.trust_score * 100}%`,
                        backgroundColor:
                          rep.trust_score > 0.6 ? "#22c55e" : rep.trust_score > 0.3 ? "#eab308" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="rep-score">{rep.trust_score.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
