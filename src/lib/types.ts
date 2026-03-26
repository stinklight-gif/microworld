// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentType = "farmer" | "builder" | "energist" | "generalist";

export interface Traits {
  risk_tolerance: number;
  cooperation_bias: number;
  time_preference: number;
  stubbornness: number;
  mobility: number;
}

export interface Inventory {
  energy: number;
  food: number;
  shelter: number;
}

// ─── Memory & Reputation (Phase 4) ───────────────────────────────────────────

export interface MemoryEntry {
  tick: number;
  event: string;
  sentiment: "positive" | "negative" | "neutral";
  agent_involved?: string;
}

export interface ReputationEntry {
  agent_id: string;
  trades_completed: number;
  trades_refused: number;
  trust_score: number; // 0.0 - 1.0
}

export interface StrategicPlan {
  production_focus: "food" | "shelter" | "balanced";
  trade_with: string[];
  avoid_trading_with: string[];
  willing_to_offer: string;
  seeking: string;
  should_migrate: boolean;
  thought: string;
  expires_at_tick: number;
  // Phase 5
  should_reproduce: boolean;
  should_hire: boolean;
  break_contract: boolean;
}

// ─── Employment Contract (Phase 5) ────────────────────────────────────────────

export interface Contract {
  employer_id: string;
  revenue_share: number; // 0.3 = 30%
  active: boolean;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  type: AgentType;
  position: { x: number; y: number };
  health: number;
  alive: boolean;

  production_costs: { food: number; shelter: number };
  production_yields: { food: number; shelter: number };
  inventory: Inventory;

  traits: Traits;

  ticks_alive: number;
  ticks_needs_unmet: number;
  ticks_at_full_health: number; // Phase 5: consecutive ticks at health 100
  net_worth: number;

  // Phase 4: LLM integration
  memory: MemoryEntry[];
  reputation: Record<string, ReputationEntry>;
  strategic_plan: StrategicPlan | null;

  // Phase 5: Family
  parent_id: string | null;
  children_ids: string[];
  generation: number; // 0 = original, 1 = first gen child, etc.

  // Phase 5: Employment
  employer_id: string | null;
  employee_ids: string[];
  contract: Contract | null;
}

// ─── Dynasty (Phase 5) ───────────────────────────────────────────────────────

export interface Dynasty {
  founder_id: string;
  members: string[];       // All living descendants
  total_ever: number;      // All descendants ever (including dead)
  total_net_worth: number; // Sum of living members' net worth
}

// ─── Trade ────────────────────────────────────────────────────────────────────

export interface Trade {
  tick: number;
  from_agent: string;
  to_agent: string;
  offered: { good: string; amount: number };
  requested: { good: string; amount: number };
  accepted: boolean;
  message: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventType =
  | "trade_executed"
  | "trade_rejected"
  | "death"
  | "needs_unmet"
  | "migration"
  | "strategic_thought"
  | "reflection"
  | "birth"
  | "hire"
  | "contract_break"
  | "revenue_share";

export interface WorldEvent {
  id: string;
  tick: number;
  type: EventType;
  agents: string[];
  message: string;
  data?: Record<string, unknown>;
}

// ─── Trade Flash (for map animation) ──────────────────────────────────────────

export interface TradeFlash {
  from: { x: number; y: number };
  to: { x: number; y: number };
  timestamp: number;
}

// ─── Spawn Flash (for birth/hire animation) ───────────────────────────────────

export interface SpawnFlash {
  position: { x: number; y: number };
  timestamp: number;
  type: "birth" | "hire";
}

// ─── Tick Stats (for dashboard charts) ────────────────────────────────────────

export interface TickStats {
  tick: number;
  population: number;
  population_by_type: Record<string, number>;
  gini_coefficient: number;
  avg_health: number;
  trades_executed: number;
  trades_rejected: number;
  deaths: number;
  migrations: number;
  births: number;        // Phase 5
  hires: number;         // Phase 5
  contract_breaks: number; // Phase 5
}

// ─── World State ──────────────────────────────────────────────────────────────

export interface WorldState {
  grid: (string | null)[][];
  tick: number;
  agents: Record<string, Agent>;
  running: boolean;
  speed: number;
  population: number;
  initialPopulation: number;
  events: WorldEvent[];
  tradeFlashes: TradeFlash[];
  spawnFlashes: SpawnFlash[]; // Phase 5
  statsHistory: TickStats[];
  thinkingInProgress: boolean;
  llmEnabled: boolean;
  dynasties: Record<string, Dynasty>; // Phase 5: founder_id -> dynasty
}

// ─── LLM API Types ───────────────────────────────────────────────────────────

export interface AgentThinkRequest {
  agent_id: string;
  agent_type: string;
  traits: Traits;
  health: number;
  inventory: Inventory;
  neighbors: {
    id: string;
    type: string;
    inventory: Inventory;
    health: number;
    trust_score: number;
  }[];
  memory: MemoryEntry[];
  reputation: Record<string, ReputationEntry>;
  think_type: "strategic" | "reflection";
  ticks_alive: number;
  ticks_needs_unmet: number;
  ticks_at_full_health: number;
  production_costs: { food: number; shelter: number };
  production_yields: { food: number; shelter: number };
  // Phase 5
  parent_id: string | null;
  children_ids: string[];
  generation: number;
  employer_id: string | null;
  employee_ids: string[];
  contract: Contract | null;
}

export interface AgentDecision {
  agent_id: string;
  production_focus: "food" | "shelter" | "balanced";
  trade_with: string[];
  avoid_trading_with: string[];
  willing_to_offer: string;
  seeking: string;
  should_migrate: boolean;
  thought: string;
  // Phase 5
  should_reproduce: boolean;
  should_hire: boolean;
  break_contract: boolean;
}

export interface ReflectionDecision {
  agent_id: string;
  updated_trust: Record<string, number>;
  strategy_shift: string;
  thought: string;
}

// ─── Color Modes ──────────────────────────────────────────────────────────────

export type ColorMode = "type" | "health" | "wealth";

// ─── Chat Filter ──────────────────────────────────────────────────────────────

export type ChatFilter = "all" | "trades" | "deaths" | "warnings" | "migrations" | "thoughts" | "family";
