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
  | "revenue_share"
  | "experiment";

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
  // Phase 6: Experiments
  activeExperiment: Experiment | null;
  firedEventTicks: number[]; // Track which scheduled events have already fired
  taxPool: { food: number; shelter: number }; // For tax experiment
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

export type ChatFilter = "all" | "trades" | "deaths" | "warnings" | "migrations" | "thoughts" | "family" | "experiments";

// ─── Phase 6: Experiments ─────────────────────────────────────────────────────

export type ExperimentEventType =
  | "famine"
  | "boost"
  | "plague"
  | "wall"
  | "remove_wall"
  | "tax_start"
  | "tax_redistribute"
  | "add_good";

export interface ExperimentEvent {
  trigger_tick: number;
  type: ExperimentEventType;
  config: Record<string, unknown>;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  initial_agents?: number;
  grid_size?: number;
  events: ExperimentEvent[];
}

export const EXPERIMENT_PRESETS: Experiment[] = [
  {
    id: "baseline",
    name: "Baseline",
    description: "Default settings. 100 agents, 15×15 grid, no shocks.",
    events: [],
  },
  {
    id: "famine",
    name: "Famine",
    description: "At tick 200: destroy all food in a 5×5 region (top-left). Watch refugees flee, death spike, recovery.",
    events: [
      {
        trigger_tick: 200,
        type: "famine",
        config: { region: { x1: 0, y1: 0, x2: 4, y2: 4 } },
      },
    ],
  },
  {
    id: "monopoly",
    name: "Monopoly",
    description: "One agent at center starts with 10× production yields. Does a trade empire form?",
    events: [
      {
        trigger_tick: 1,
        type: "boost",
        config: { target: "center", yield_multiplier: 10 },
      },
    ],
  },
  {
    id: "tax",
    name: "Tax & Redistribute",
    description: "10% tax on all trades. Every 50 ticks the pool is redistributed equally. Helps or hurts?",
    events: [
      {
        trigger_tick: 1,
        type: "tax_start",
        config: { rate: 0.1, redistribute_interval: 50 },
      },
    ],
  },
  {
    id: "tech_shock",
    name: "Technology Shock",
    description: "At tick 300: all farmers get 2× food yield. Food glut, farmer boom, then crash?",
    events: [
      {
        trigger_tick: 300,
        type: "boost",
        config: { target: "all_farmers", yield_multiplier: 2, good: "food" },
      },
    ],
  },
  {
    id: "wall",
    name: "Wall",
    description: "Impassable barrier across row 7. Two isolated economies. At tick 500: wall removed.",
    events: [
      {
        trigger_tick: 1,
        type: "wall",
        config: { row: 7 },
      },
      {
        trigger_tick: 500,
        type: "remove_wall",
        config: { row: 7 },
      },
    ],
  },
  {
    id: "plague",
    name: "Plague",
    description: "At tick 200: random 30% of agents lose 50 HP. Who survives? Do healthy exploit sick?",
    events: [
      {
        trigger_tick: 200,
        type: "plague",
        config: { percent_affected: 0.3, hp_loss: 50 },
      },
    ],
  },
  {
    id: "gold_rush",
    name: "Gold Rush",
    description: "At tick 100: introduce 'gold' good — doesn't decay, no survival need. Does it become currency?",
    events: [
      {
        trigger_tick: 100,
        type: "add_good",
        config: { good: "gold", decay_rate: 0, survival_need: 0 },
      },
    ],
  },
];
