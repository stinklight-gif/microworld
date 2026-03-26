import { AgentType } from "./types";

// ─── Grid ─────────────────────────────────────────────────────────────────────
export const GRID_SIZE = 15;

// ─── Economy ──────────────────────────────────────────────────────────────────
export const ENERGY_BUDGET = 8;
export const SURVIVAL_NEEDS = { food: 3, shelter: 2 };
export const DECAY_RATES = { food: 0.2, shelter: 0.1 };
export const HEALTH_MAX = 100;
export const HEALTH_PENALTY = 10;
export const HEALTH_RECOVERY = 2;

// ─── Agent Type Distribution ──────────────────────────────────────────────────
export const TYPE_DISTRIBUTION: { type: AgentType; weight: number }[] = [
  { type: "farmer", weight: 0.3 },
  { type: "builder", weight: 0.3 },
  { type: "energist", weight: 0.2 },
  { type: "generalist", weight: 0.2 },
];

// ─── Production Costs & Yields (Phase 1 spec) ────────────────────────────────
export const AGENT_CONFIGS: Record<
  AgentType,
  {
    emoji: string;
    food_cost: number;
    shelter_cost: number;
    food_yield: number;
    shelter_yield: number;
  }
> = {
  farmer: {
    emoji: "🌾",
    food_cost: 1,
    shelter_cost: 4,
    food_yield: 3,
    shelter_yield: 1,
  },
  builder: {
    emoji: "🏗️",
    food_cost: 4,
    shelter_cost: 1,
    food_yield: 1,
    shelter_yield: 3,
  },
  energist: {
    emoji: "⚡",
    food_cost: 3,
    shelter_cost: 3,
    food_yield: 2,
    shelter_yield: 1,
  },
  generalist: {
    emoji: "🔧",
    food_cost: 2,
    shelter_cost: 2,
    food_yield: 1,
    shelter_yield: 1,
  },
};

// ─── Colors ───────────────────────────────────────────────────────────────────
export const AGENT_COLORS: Record<AgentType, string> = {
  farmer: "#22c55e",
  builder: "#f97316",
  energist: "#eab308",
  generalist: "#94a3b8",
};

// ─── Initial Population ───────────────────────────────────────────────────────
export const INITIAL_POPULATION = 100;

// ─── Starting Inventory ───────────────────────────────────────────────────────
export const STARTING_INVENTORY = { energy: 5, food: 6, shelter: 4 };

// ─── Phase 5: Reproduction & Hiring ───────────────────────────────────────────
export const REPRODUCTION_THRESHOLDS = {
  consecutive_full_health_ticks: 5,
  min_food: 6,       // > 6 means surplus
  min_shelter: 4,    // > 4 means surplus
  min_energy: 10,    // > 10 means surplus
  parent_surplus_share: 0.5, // parent gives 50% of surplus to child
};

export const CHILD_STARTING_HEALTH = 80;
export const TRAIT_MUTATION_RANGE = 0.1;

export const HIRING_THRESHOLDS = {
  min_food: 4,
  min_shelter: 3,
  min_energy: 6,
  hiring_cost_food: 2,
  hiring_cost_shelter: 1,
  hiring_cost_energy: 3,
};

export const REVENUE_SHARE_RATE = 0.3; // Workers give 30% of production
