import {
  Agent,
  AgentType,
  WorldState,
  WorldEvent,
  TradeFlash,
  SpawnFlash,
  TickStats,
  Dynasty,
  Contract,
  Experiment,
  AgentThinkRequest,
  AgentDecision,
  ReflectionDecision,
} from "./types";
import {
  GRID_SIZE,
  ENERGY_BUDGET,
  SURVIVAL_NEEDS,
  DECAY_RATES,
  HEALTH_MAX,
  HEALTH_PENALTY,
  HEALTH_RECOVERY,
  TYPE_DISTRIBUTION,
  AGENT_CONFIGS,
  INITIAL_POPULATION,
  STARTING_INVENTORY,
  REPRODUCTION_THRESHOLDS,
  CHILD_STARTING_HEALTH,
  TRAIT_MUTATION_RANGE,
  HIRING_THRESHOLDS,
  REVENUE_SHARE_RATE,
} from "./constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickWeighted(items: { type: AgentType; weight: number }[]): AgentType {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.type;
  }
  return items[items.length - 1].type;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function padNum(n: number, len: number = 3): string {
  return String(n).padStart(len, "0");
}

function calcNetWorth(agent: Agent): number {
  return agent.inventory.energy + agent.inventory.food * 2 + agent.inventory.shelter * 3 + agent.health;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let eventCounter = 0;
function eventId(): string {
  return `evt_${++eventCounter}`;
}

// ─── Neighbor Detection ───────────────────────────────────────────────────────

function getAliveNeighborIds(
  grid: (string | null)[][],
  x: number,
  y: number,
  agents: Record<string, Agent>
): string[] {
  const ids: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        const id = grid[ny][nx];
        if (id && agents[id]?.alive) ids.push(id);
      }
    }
  }
  return ids;
}

// ─── Trade Message Templates ──────────────────────────────────────────────────

const OFFER_MSGS = [
  (f: string, t: string, ao: number, go: string, ar: number, gr: string) =>
    `${f} → ${t}: "${ao} ${go} for ${ar} ${gr}?"`,
  (f: string, t: string, ao: number, go: string, ar: number, gr: string) =>
    `${f}: "I'll give you ${ao} ${go} for ${ar} ${gr}"`,
  (f: string, t: string, ao: number, go: string, ar: number, gr: string) =>
    `${f} offers ${ao} ${go} to ${t} for ${ar} ${gr}`,
];

const ACCEPT_MSGS = [
  (t: string) => `${t}: "Deal." ✅`,
  (t: string) => `✅ ${t} accepted.`,
  (t: string) => `${t}: "You got it." ✅`,
];

const REJECT_MSGS = [
  (t: string) => `${t}: "No thanks." ❌`,
  (t: string) => `❌ ${t} declined.`,
  (t: string) => `${t} rejected the offer. ❌`,
];

// ─── Simple Ratio-Based Trade ─────────────────────────────────────────────────
//
// Each agent compares food_ratio (food/3) vs shelter_ratio (shelter/2).
// If food_ratio > shelter_ratio → offer food, want shelter.
// If shelter_ratio > food_ratio → offer shelter, want food.
// Trade 1 unit at a time with any neighbor who has the opposite imbalance.
// Max 3 trades per agent per tick.

function doTrades(
  agents: Record<string, Agent>,
  grid: (string | null)[][],
  tick: number,
  events: WorldEvent[],
  flashes: TradeFlash[]
): void {
  const tradeCount: Record<string, number> = {};
  const MAX_TRADES = 5;

  const aliveIds = shuffle(Object.keys(agents).filter((id) => agents[id].alive));

  for (const id of aliveIds) {
    const agent = agents[id];
    if (!agent.alive) continue;
    if ((tradeCount[id] || 0) >= MAX_TRADES) continue;

    const foodRatio = agent.inventory.food / SURVIVAL_NEEDS.food;
    const shelterRatio = agent.inventory.shelter / SURVIVAL_NEEDS.shelter;

    // Skip if perfectly balanced
    if (foodRatio === shelterRatio) continue;

    const iWantShelter = foodRatio > shelterRatio;
    const offerGood = iWantShelter ? "food" : "shelter";
    const wantGood = iWantShelter ? "shelter" : "food";

    // Must have at least 2 of the offer good to trade (keep at least 1)
    if (agent.inventory[offerGood] < 2) continue;

    const neighborIds = shuffle(
      getAliveNeighborIds(grid, agent.position.x, agent.position.y, agents)
    );

    for (const nId of neighborIds) {
      if ((tradeCount[id] || 0) >= MAX_TRADES) break;
      if ((tradeCount[nId] || 0) >= MAX_TRADES) continue;

      const neighbor = agents[nId];
      if (!neighbor.alive) continue;

      // Neighbor must have opposite imbalance
      const nFoodRatio = neighbor.inventory.food / SURVIVAL_NEEDS.food;
      const nShelterRatio = neighbor.inventory.shelter / SURVIVAL_NEEDS.shelter;
      const neighborWantsShelter = nFoodRatio > nShelterRatio;

      // They must want what I'm offering (opposite imbalance)
      if (neighborWantsShelter === iWantShelter) continue;

      // Neighbor must have at least 2 of what I want
      if (neighbor.inventory[wantGood] < 2) continue;

      // Trust-based rejection: skip agents with trust < 0.3
      const myRep = agent.reputation[nId];
      if (myRep && myRep.trust_score < 0.3) continue;
      const theirRep = neighbor.reputation[id];
      if (theirRep && theirRep.trust_score < 0.3) continue;

      // Calculate trade amounts: trade half of what I have (above 1 buffer), up to 5
      const myAvailable = Math.max(0, agent.inventory[offerGood] - 1);
      const theirAvailable = Math.max(0, neighbor.inventory[wantGood] - 1);

      const offerAmt = Math.max(1, Math.min(Math.ceil(myAvailable / 2), 5));
      const requestAmt = Math.max(1, Math.min(Math.ceil(theirAvailable / 2), 5));

      // Verify both can afford
      if (agent.inventory[offerGood] < offerAmt) continue;
      if (neighbor.inventory[wantGood] < requestAmt) continue;

      // Execute trade
      agent.inventory[offerGood] -= offerAmt;
      agent.inventory[wantGood] += requestAmt;
      neighbor.inventory[offerGood] += offerAmt;
      neighbor.inventory[wantGood] -= requestAmt;

      tradeCount[id] = (tradeCount[id] || 0) + 1;
      tradeCount[nId] = (tradeCount[nId] || 0) + 1;

      // Log event
      const fromEmoji = AGENT_CONFIGS[agent.type].emoji;
      const toEmoji = AGENT_CONFIGS[neighbor.type].emoji;
      const fromLabel = `${fromEmoji} ${agent.id}`;
      const toLabel = `${toEmoji} ${neighbor.id}`;

      const offerMsg = pick(OFFER_MSGS)(fromLabel, toLabel, offerAmt, offerGood, requestAmt, wantGood);
      const acceptMsg = pick(ACCEPT_MSGS)(toLabel);

      events.push({
        id: eventId(),
        tick,
        type: "trade_executed",
        agents: [agent.id, neighbor.id],
        message: `${offerMsg}\n${acceptMsg}`,
      });

      // Memory: both agents remember the trade
      addMemory(agent, tick, `Traded ${offerAmt} ${offerGood} for ${requestAmt} ${wantGood} with ${neighbor.id}`, "positive", neighbor.id);
      addMemory(neighbor, tick, `Traded ${requestAmt} ${wantGood} for ${offerAmt} ${offerGood} with ${agent.id}`, "positive", agent.id);

      // Reputation: record successful trade
      updateReputation(agent, neighbor.id, true);
      updateReputation(neighbor, agent.id, true);

      flashes.push({
        from: { ...agent.position },
        to: { ...neighbor.position },
        timestamp: Date.now(),
      });
    }
  }
}

// ─── Memory & Reputation Helpers ──────────────────────────────────────────────

function addMemory(agent: Agent, tick: number, event: string, sentiment: "positive" | "negative" | "neutral", agentInvolved?: string): void {
  agent.memory.push({ tick, event, sentiment, agent_involved: agentInvolved });
  // Keep only last 20
  if (agent.memory.length > 20) {
    agent.memory = agent.memory.slice(-20);
  }
}

function updateReputation(agent: Agent, otherId: string, success: boolean): void {
  if (!agent.reputation[otherId]) {
    agent.reputation[otherId] = {
      agent_id: otherId,
      trades_completed: 0,
      trades_refused: 0,
      trust_score: 0.5,
    };
  }
  const rep = agent.reputation[otherId];
  if (success) {
    rep.trades_completed++;
  } else {
    rep.trades_refused++;
  }
  rep.trust_score = rep.trades_completed / (rep.trades_completed + rep.trades_refused + 1);
}

// ─── Create Agent ─────────────────────────────────────────────────────────────

let agentCounter = 0;

export function createAgent(x: number, y: number, type?: AgentType): Agent {
  agentCounter++;
  const t = type ?? pickWeighted(TYPE_DISTRIBUTION);
  const cfg = AGENT_CONFIGS[t];

  const agent: Agent = {
    id: `agent_${padNum(agentCounter)}`,
    type: t,
    position: { x, y },
    health: HEALTH_MAX,
    alive: true,
    production_costs: { food: cfg.food_cost, shelter: cfg.shelter_cost },
    production_yields: { food: cfg.food_yield, shelter: cfg.shelter_yield },
    inventory: { ...STARTING_INVENTORY },
    traits: {
      risk_tolerance: Math.random(),
      cooperation_bias: Math.random(),
      time_preference: Math.random(),
      stubbornness: Math.random(),
      mobility: Math.random(),
    },
    ticks_alive: 0,
    ticks_needs_unmet: 0,
    ticks_at_full_health: 0,
    net_worth: 0,
    memory: [],
    reputation: {},
    strategic_plan: null,
    parent_id: null,
    children_ids: [],
    generation: 0,
    employer_id: null,
    employee_ids: [],
    contract: null,
  };
  agent.net_worth = calcNetWorth(agent);
  return agent;
}

function mutateTrait(parentVal: number): number {
  const delta = (Math.random() * 2 - 1) * TRAIT_MUTATION_RANGE;
  return Math.max(0, Math.min(1, parentVal + delta));
}

export function createChildAgent(
  parent: Agent,
  x: number,
  y: number,
  surplusFood: number,
  surplusShelter: number,
  surplusEnergy: number,
): Agent {
  agentCounter++;
  const cfg = AGENT_CONFIGS[parent.type];

  return {
    id: `agent_${padNum(agentCounter)}`,
    type: parent.type,
    position: { x, y },
    health: CHILD_STARTING_HEALTH,
    alive: true,
    production_costs: { food: cfg.food_cost, shelter: cfg.shelter_cost },
    production_yields: { food: cfg.food_yield, shelter: cfg.shelter_yield },
    inventory: {
      food: surplusFood,
      shelter: surplusShelter,
      energy: surplusEnergy,
    },
    traits: {
      risk_tolerance: mutateTrait(parent.traits.risk_tolerance),
      cooperation_bias: mutateTrait(parent.traits.cooperation_bias),
      time_preference: mutateTrait(parent.traits.time_preference),
      stubbornness: mutateTrait(parent.traits.stubbornness),
      mobility: mutateTrait(parent.traits.mobility),
    },
    ticks_alive: 0,
    ticks_needs_unmet: 0,
    ticks_at_full_health: 0,
    net_worth: 0,
    memory: [],
    reputation: {},
    strategic_plan: null,
    parent_id: parent.id,
    children_ids: [],
    generation: parent.generation + 1,
    employer_id: null,
    employee_ids: [],
    contract: null,
  };
}

export function createWorkerAgent(
  employer: Agent,
  x: number,
  y: number,
): Agent {
  agentCounter++;
  const t = pickWeighted(TYPE_DISTRIBUTION);
  const cfg = AGENT_CONFIGS[t];

  return {
    id: `agent_${padNum(agentCounter)}`,
    type: t,
    position: { x, y },
    health: CHILD_STARTING_HEALTH,
    alive: true,
    production_costs: { food: cfg.food_cost, shelter: cfg.shelter_cost },
    production_yields: { food: cfg.food_yield, shelter: cfg.shelter_yield },
    inventory: { energy: 3, food: 3, shelter: 2 },
    traits: {
      risk_tolerance: Math.random(),
      cooperation_bias: Math.random(),
      time_preference: Math.random(),
      stubbornness: Math.random(),
      mobility: Math.random(),
    },
    ticks_alive: 0,
    ticks_needs_unmet: 0,
    ticks_at_full_health: 0,
    net_worth: 0,
    memory: [],
    reputation: {},
    strategic_plan: null,
    parent_id: null,
    children_ids: [],
    generation: 0,
    employer_id: employer.id,
    employee_ids: [],
    contract: {
      employer_id: employer.id,
      revenue_share: REVENUE_SHARE_RATE,
      active: true,
    },
  };
}

// Helper: find empty adjacent cells
function getEmptyAdjacentCells(
  grid: (string | null)[][],
  x: number,
  y: number,
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && grid[ny][nx] === null) {
        cells.push({ x: nx, y: ny });
      }
    }
  }
  return cells;
}

// ─── Initialize World ─────────────────────────────────────────────────────────

export function initWorld(experiment?: Experiment | null): WorldState {
  agentCounter = 0;
  eventCounter = 0;

  const gridSize = experiment?.grid_size ?? GRID_SIZE;
  const popSize = experiment?.initial_agents ?? INITIAL_POPULATION;

  const grid: (string | null)[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(null)
  );
  const agents: Record<string, Agent> = {};

  const positions: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      positions.push({ x, y });
    }
  }
  const shuffled = shuffle(positions);
  const count = Math.min(popSize, shuffled.length);

  for (let i = 0; i < count; i++) {
    const pos = shuffled[i];
    const agent = createAgent(pos.x, pos.y);
    agents[agent.id] = agent;
    grid[pos.y][pos.x] = agent.id;
  }

  return {
    grid,
    tick: 0,
    agents,
    running: false,
    speed: 5,
    population: count,
    initialPopulation: count,
    events: [],
    tradeFlashes: [],
    spawnFlashes: [],
    statsHistory: [],
    thinkingInProgress: false,
    llmEnabled: false,
    dynasties: {},
    activeExperiment: experiment ?? null,
    firedEventTicks: [],
    taxPool: { food: 0, shelter: 0 },
  };
}

// ─── Tick Loop ────────────────────────────────────────────────────────────────

export function tickWorld(state: WorldState): WorldState {
  const tick = state.tick + 1;

  // Deep copy agents
  const agents: Record<string, Agent> = {};
  for (const id of Object.keys(state.agents)) {
    const a = state.agents[id];
    agents[id] = {
      ...a,
      position: { ...a.position },
      inventory: { ...a.inventory },
      traits: { ...a.traits },
      production_costs: { ...a.production_costs },
      production_yields: { ...a.production_yields },
      memory: [...a.memory],
      reputation: { ...a.reputation },
      strategic_plan: a.strategic_plan ? { ...a.strategic_plan } : null,
      children_ids: [...a.children_ids],
      employee_ids: [...a.employee_ids],
      contract: a.contract ? { ...a.contract } : null,
    };
  }
  const grid = state.grid.map((row) => [...row]);
  const newEvents: WorldEvent[] = [];
  const newFlashes: TradeFlash[] = [];
  const newSpawnFlashes: SpawnFlash[] = [];
  let birthsThisTick = 0;
  let hiresThisTick = 0;
  let contractBreaksThisTick = 0;

  const aliveIds = Object.keys(agents).filter((id) => agents[id].alive);
  const order = shuffle(aliveIds);

  // 1. RECEIVE + 2. PRODUCE (all agents)
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;

    agent.inventory.energy += ENERGY_BUDGET;

    let energy = agent.inventory.energy;
    while (energy > 0) {
      const fR = agent.inventory.food / SURVIVAL_NEEDS.food;
      const sR = agent.inventory.shelter / SURVIVAL_NEEDS.shelter;

      // Use strategic plan if available and not expired
      let preferFood: boolean;
      const plan = agent.strategic_plan;
      if (plan && plan.expires_at_tick > tick) {
        if (plan.production_focus === "food") preferFood = true;
        else if (plan.production_focus === "shelter") preferFood = false;
        else preferFood = fR <= sR; // balanced = ratio-based
      } else {
        preferFood = fR <= sR;
      }

      const primaryCost = preferFood ? agent.production_costs.food : agent.production_costs.shelter;
      const altCost = preferFood ? agent.production_costs.shelter : agent.production_costs.food;

      if (energy >= primaryCost) {
        energy -= primaryCost;
        if (preferFood) {
          agent.inventory.food += agent.production_yields.food;
        } else {
          agent.inventory.shelter += agent.production_yields.shelter;
        }
      } else if (energy >= altCost) {
        // Can't afford preferred, try the other
        energy -= altCost;
        if (preferFood) {
          agent.inventory.shelter += agent.production_yields.shelter;
        } else {
          agent.inventory.food += agent.production_yields.food;
        }
      } else {
        break; // Can't afford anything
      }
    }
    agent.inventory.energy = energy;
  }

  // 2.5 REVENUE SHARE — Workers pay employers
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;
    if (!agent.contract || !agent.contract.active || !agent.employer_id) continue;

    const employer = agents[agent.employer_id];
    if (!employer || !employer.alive) {
      // Employer died — auto-free the worker
      agent.contract.active = false;
      agent.employer_id = null;
      continue;
    }

    // Calculate share of this tick's production (approximate via yields)
    const foodShare = Math.floor(agent.production_yields.food * agent.contract.revenue_share);
    const shelterShare = Math.floor(agent.production_yields.shelter * agent.contract.revenue_share);

    if (foodShare > 0 && agent.inventory.food >= foodShare) {
      agent.inventory.food -= foodShare;
      employer.inventory.food += foodShare;
    }
    if (shelterShare > 0 && agent.inventory.shelter >= shelterShare) {
      agent.inventory.shelter -= shelterShare;
      employer.inventory.shelter += shelterShare;
    }

    if (foodShare > 0 || shelterShare > 0) {
      const parts: string[] = [];
      if (foodShare > 0) parts.push(`${foodShare} food`);
      if (shelterShare > 0) parts.push(`${shelterShare} shelter`);
      newEvents.push({
        id: eventId(),
        tick,
        type: "revenue_share",
        agents: [agent.id, employer.id],
        message: `💰 ${agent.id} paid ${parts.join(" + ")} to ${employer.id} (${Math.round(agent.contract.revenue_share * 100)}% share)`,
      });
    }
  }

  // 3. TRADE
  doTrades(agents, grid, tick, newEvents, newFlashes);

  let migrationsThisTick = 0;

  // 4. CONSUME (all agents)
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;

    let needsUnmet = 0;
    const prevHealth = agent.health;

    if (agent.inventory.food >= SURVIVAL_NEEDS.food) {
      agent.inventory.food -= SURVIVAL_NEEDS.food;
    } else {
      agent.inventory.food = 0;
      needsUnmet++;
    }

    if (agent.inventory.shelter >= SURVIVAL_NEEDS.shelter) {
      agent.inventory.shelter -= SURVIVAL_NEEDS.shelter;
    } else {
      agent.inventory.shelter = 0;
      needsUnmet++;
    }

    if (needsUnmet > 0) {
      agent.health -= HEALTH_PENALTY * needsUnmet;
      agent.ticks_needs_unmet++;
      agent.ticks_at_full_health = 0; // Reset full health counter

      if (agent.ticks_needs_unmet % 3 === 1) {
        const emoji = AGENT_CONFIGS[agent.type].emoji;
        const missing: string[] = [];
        if (agent.inventory.food === 0 && needsUnmet > 0) missing.push("food");
        if (agent.inventory.shelter === 0 && needsUnmet > 0) missing.push("shelter");
        if (missing.length === 0) missing.push("resources");
        newEvents.push({
          id: eventId(),
          tick,
          type: "needs_unmet",
          agents: [agent.id],
          message: `⚠️ ${emoji} ${agent.id} needs unmet. Missing ${missing.join(" & ")}. Health: ${prevHealth} → ${Math.max(0, agent.health)}`,
        });
        addMemory(agent, tick, `Needs unmet: missing ${missing.join(" & ")}. Health dropped to ${Math.max(0, agent.health)}`, "negative");
      }
    } else {
      agent.health = Math.min(HEALTH_MAX, agent.health + HEALTH_RECOVERY);
      agent.ticks_needs_unmet = 0;
      // Track consecutive full health ticks for reproduction
      if (agent.health >= HEALTH_MAX) {
        agent.ticks_at_full_health++;
      } else {
        agent.ticks_at_full_health = 0;
      }
    }
  }

  // 5. MOVE — Migration for starving mobile agents
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;
    if (agent.ticks_needs_unmet < 3) continue;
    if (agent.traits.mobility <= 0.3) continue;

    // Find empty adjacent cells
    const emptyCells: { x: number; y: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = agent.position.x + dx;
        const ny = agent.position.y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && grid[ny][nx] === null) {
          emptyCells.push({ x: nx, y: ny });
        }
      }
    }
    if (emptyCells.length === 0) continue;

    // Prefer cells near agents of a DIFFERENT type
    let bestCell = emptyCells[0];
    let bestScore = -1;
    for (const cell of emptyCells) {
      let diverseNeighbors = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nnx = cell.x + dx;
          const nny = cell.y + dy;
          if (nnx >= 0 && nnx < GRID_SIZE && nny >= 0 && nny < GRID_SIZE) {
            const nid = grid[nny][nnx];
            if (nid && agents[nid]?.alive && agents[nid].type !== agent.type) {
              diverseNeighbors++;
            }
          }
        }
      }
      if (diverseNeighbors > bestScore) {
        bestScore = diverseNeighbors;
        bestCell = cell;
      }
    }

    // Move
    grid[agent.position.y][agent.position.x] = null;
    const oldX = agent.position.x;
    const oldY = agent.position.y;
    agent.position.x = bestCell.x;
    agent.position.y = bestCell.y;
    grid[bestCell.y][bestCell.x] = agent.id;
    migrationsThisTick++;

    const emoji = AGENT_CONFIGS[agent.type].emoji;
    const dx = bestCell.x - oldX;
    const dy = bestCell.y - oldY;
    const dirs: string[] = [];
    if (dy < 0) dirs.push("north");
    if (dy > 0) dirs.push("south");
    if (dx > 0) dirs.push("east");
    if (dx < 0) dirs.push("west");
    const dirStr = dirs.join("-") || "nearby";
    const seekingType = agent.type === "farmer" ? "builders" : agent.type === "builder" ? "farmers" : "traders";

    newEvents.push({
      id: eventId(),
      tick,
      type: "migration",
      agents: [agent.id],
      message: `🚶 ${emoji} ${agent.id} migrated ${dirStr} (seeking ${seekingType})`,
    });
  }

  // 5.5 REPRODUCE — Agents spawn children when thriving
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;

    // Check reproduction conditions (rule-based, doesn't need LLM)
    const canReproduce =
      agent.ticks_at_full_health >= REPRODUCTION_THRESHOLDS.consecutive_full_health_ticks &&
      agent.inventory.food > REPRODUCTION_THRESHOLDS.min_food &&
      agent.inventory.shelter > REPRODUCTION_THRESHOLDS.min_shelter;

    // LLM can also trigger reproduction via strategic plan
    const llmWantsReproduce = agent.strategic_plan?.should_reproduce === true;

    if (!canReproduce && !llmWantsReproduce) continue;
    if (!canReproduce) continue; // Must meet thresholds even if LLM says yes

    const emptyCells = getEmptyAdjacentCells(grid, agent.position.x, agent.position.y);
    if (emptyCells.length === 0) continue;

    // Calculate surplus to share with child (40%)
    const surplusFood = Math.floor((agent.inventory.food - SURVIVAL_NEEDS.food) * REPRODUCTION_THRESHOLDS.parent_surplus_share);
    const surplusShelter = Math.floor((agent.inventory.shelter - SURVIVAL_NEEDS.shelter) * REPRODUCTION_THRESHOLDS.parent_surplus_share);
    const surplusEnergy = 2; // Give child a small energy start

    // Deduct from parent
    agent.inventory.food -= surplusFood;
    agent.inventory.shelter -= surplusShelter;
    agent.inventory.energy -= surplusEnergy;
    agent.ticks_at_full_health = 0; // Reset so they don't reproduce every tick

    const cell = pick(emptyCells);
    const child = createChildAgent(agent, cell.x, cell.y, surplusFood, surplusShelter, surplusEnergy);
    child.net_worth = calcNetWorth(child);
    agents[child.id] = child;
    grid[cell.y][cell.x] = child.id;
    agent.children_ids.push(child.id);
    birthsThisTick++;

    const emoji = AGENT_CONFIGS[agent.type].emoji;
    newEvents.push({
      id: eventId(),
      tick,
      type: "birth",
      agents: [agent.id, child.id],
      message: `🎉 ${emoji} ${agent.id} spawned ${child.id} (child)\n  Type: ${child.type} | Traits: risk=${child.traits.risk_tolerance.toFixed(2)} (parent: ${agent.traits.risk_tolerance.toFixed(2)}), coop=${child.traits.cooperation_bias.toFixed(2)} (parent: ${agent.traits.cooperation_bias.toFixed(2)})\n  Starting inventory: ${surplusFood} food, ${surplusShelter} shelter, ${surplusEnergy} energy`,
    });

    addMemory(agent, tick, `Spawned child ${child.id}`, "positive", child.id);

    newSpawnFlashes.push({
      position: { x: cell.x, y: cell.y },
      timestamp: Date.now(),
      type: "birth",
    });
  }

  // 5.6 HIRE — Agents post jobs, nearby unemployed agents evaluate & accept/reject
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;

    // Only hire if LLM strategic plan says to, or rule-based if very wealthy
    const llmWantsHire = agent.strategic_plan?.should_hire === true;
    const ruleBasedHire = agent.inventory.food > 10 && agent.inventory.shelter > 6 && agent.employee_ids.length === 0;
    if (!llmWantsHire && !ruleBasedHire) continue;

    // Check hiring prerequisites — employer must have surplus to pay signing bonus
    if (
      agent.inventory.food < HIRING_THRESHOLDS.min_food ||
      agent.inventory.shelter < HIRING_THRESHOLDS.min_shelter
    ) continue;

    // Already have too many workers? Cap at 3
    if (agent.employee_ids.length >= 3) continue;

    // Find nearby unemployed candidates
    const neighborIds = getAliveNeighborIds(grid, agent.position.x, agent.position.y, agents);
    const candidates = shuffle(neighborIds.filter((nId) => {
      const n = agents[nId];
      // Must be alive, not already employed, not the employer's parent/child
      return n.alive &&
        !n.contract?.active &&
        !n.employer_id &&
        n.id !== agent.parent_id &&
        !agent.children_ids.includes(n.id);
    }));

    if (candidates.length === 0) continue;

    const emoji = AGENT_CONFIGS[agent.type].emoji;

    // Post job to first viable candidate
    for (const candidateId of candidates) {
      const candidate = agents[candidateId];
      const candEmoji = AGENT_CONFIGS[candidate.type].emoji;

      // Candidate evaluates the offer:
      // Accept if: struggling (low health or needs unmet) OR cooperative + trusts employer
      const isStruggling = candidate.health < 70 || candidate.ticks_needs_unmet >= 2;
      const trustInEmployer = candidate.reputation[agent.id]?.trust_score ?? 0.5;
      const willingToWork = candidate.traits.cooperation_bias > 0.4 && trustInEmployer >= 0.3;

      if (!isStruggling && !willingToWork) {
        // Rejected
        newEvents.push({
          id: eventId(),
          tick,
          type: "hire",
          agents: [agent.id, candidate.id],
          message: `💼 ${emoji} ${agent.id} offered job to ${candEmoji} ${candidate.id}\n  ❌ ${candEmoji} ${candidate.id}: "No thanks, I'm doing fine on my own."`,
        });
        addMemory(agent, tick, `${candidate.id} rejected my job offer`, "negative", candidate.id);
        addMemory(candidate, tick, `Rejected job offer from ${agent.id}`, "neutral", agent.id);
        continue;
      }

      // Accepted — create employment contract
      // Employer pays signing bonus
      const signingFood = HIRING_THRESHOLDS.hiring_cost_food;
      const signingShelter = HIRING_THRESHOLDS.hiring_cost_shelter;
      agent.inventory.food -= signingFood;
      agent.inventory.shelter -= signingShelter;
      candidate.inventory.food += signingFood;
      candidate.inventory.shelter += signingShelter;

      // Set up contract
      candidate.employer_id = agent.id;
      candidate.contract = {
        employer_id: agent.id,
        revenue_share: REVENUE_SHARE_RATE,
        active: true,
      };
      agent.employee_ids.push(candidate.id);
      hiresThisTick++;

      newEvents.push({
        id: eventId(),
        tick,
        type: "hire",
        agents: [agent.id, candidate.id],
        message: `💼 ${emoji} ${agent.id} hired ${candEmoji} ${candidate.id}\n  ✅ ${candEmoji} ${candidate.id}: "${isStruggling ? "I need the help." : "Sounds like a good deal."}"` +
          `\n  Contract: ${Math.round(REVENUE_SHARE_RATE * 100)}% revenue share | Signing bonus: ${signingFood}🌾 ${signingShelter}🏠`,
      });

      addMemory(agent, tick, `Hired ${candidate.id} as worker`, "positive", candidate.id);
      addMemory(candidate, tick, `Accepted job from ${agent.id} (${isStruggling ? "needed help" : "good deal"})`, "positive", agent.id);

      // Update reputation — both sides trust each other more
      updateReputation(agent, candidate.id, true);
      updateReputation(candidate, agent.id, true);

      // Clear flag
      if (agent.strategic_plan) {
        agent.strategic_plan.should_hire = false;
      }
      break; // Only hire one per tick
    }
  }

  // 5.7 CONTRACT BREAK — Workers can quit
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;
    if (!agent.contract || !agent.contract.active || !agent.employer_id) continue;

    // LLM-driven contract breaking
    const llmWantsBreak = agent.strategic_plan?.break_contract === true;

    // Rule-based: break if trust in employer drops below 0.3
    const trustInEmployer = agent.reputation[agent.employer_id]?.trust_score ?? 0.5;
    const ruleBased = trustInEmployer < 0.3 && agent.health >= 60 && agent.inventory.food >= 3;

    if (!llmWantsBreak && !ruleBased) continue;

    const employer = agents[agent.employer_id];
    const oldEmployerId = agent.employer_id;

    // Break the contract
    agent.contract.active = false;
    agent.employer_id = null;
    contractBreaksThisTick++;

    // Remove from employer's employee list
    if (employer && employer.alive) {
      employer.employee_ids = employer.employee_ids.filter((eid) => eid !== agent.id);

      // Employer gets betrayal memory, trust drops to 0
      addMemory(employer, tick, `Worker ${agent.id} broke their contract!`, "negative", agent.id);
      if (employer.reputation[agent.id]) {
        employer.reputation[agent.id] = {
          ...employer.reputation[agent.id],
          trust_score: 0,
        };
      } else {
        employer.reputation[agent.id] = {
          agent_id: agent.id,
          trades_completed: 0,
          trades_refused: 0,
          trust_score: 0,
        };
      }
    }

    addMemory(agent, tick, `Broke contract with ${oldEmployerId}`, "neutral", oldEmployerId);

    newEvents.push({
      id: eventId(),
      tick,
      type: "contract_break",
      agents: [agent.id, oldEmployerId],
      message: `🔓 ${agent.id} broke contract with ${oldEmployerId}\n  ${agent.id}: "Going independent."${employer ? `\n  ${oldEmployerId} trust in ${agent.id}: → 0.0` : ""}`,
    });

    // Clear the flag
    if (agent.strategic_plan) {
      agent.strategic_plan.break_contract = false;
    }
  }

  // 6. DECAY + 7. CHECK (all agents)
  for (const id of order) {
    const agent = agents[id];
    if (!agent.alive) continue;

    agent.inventory.food = Math.floor(agent.inventory.food * (1 - DECAY_RATES.food));
    agent.inventory.shelter = Math.floor(agent.inventory.shelter * (1 - DECAY_RATES.shelter));

    if (agent.health <= 0) {
      agent.health = 0;
      agent.alive = false;
      grid[agent.position.y][agent.position.x] = null;

      const emoji = AGENT_CONFIGS[agent.type].emoji;
      newEvents.push({
        id: eventId(),
        tick,
        type: "death",
        agents: [agent.id],
        message: `💀 ${emoji} ${agent.id} died. Cause: starvation. Survived ${agent.ticks_alive} ticks.`,
      });
    }

    agent.ticks_alive++;
    agent.net_worth = calcNetWorth(agent);
  }

  // Combine events (keep last 500)
  const allEvents = [...state.events, ...newEvents];
  const trimmedEvents = allEvents.length > 500 ? allEvents.slice(allEvents.length - 500) : allEvents;

  // Clean old flashes
  const now = Date.now();
  const allFlashes = [...state.tradeFlashes, ...newFlashes].filter((f) => now - f.timestamp < 500);
  const allSpawnFlashes = [...(state.spawnFlashes || []), ...newSpawnFlashes].filter((f) => now - f.timestamp < 800);

  const population = Object.values(agents).filter((a) => a.alive).length;

  // 9. STATS — Calculate TickStats
  const aliveAgents = Object.values(agents).filter((a) => a.alive);
  const popByType: Record<string, number> = { farmer: 0, builder: 0, energist: 0, generalist: 0 };
  let totalHealth = 0;
  for (const a of aliveAgents) {
    popByType[a.type] = (popByType[a.type] || 0) + 1;
    totalHealth += a.health;
  }

  const tickStats: TickStats = {
    tick,
    population,
    population_by_type: popByType,
    gini_coefficient: calculateGini(aliveAgents),
    avg_health: aliveAgents.length > 0 ? Math.round(totalHealth / aliveAgents.length) : 0,
    trades_executed: newEvents.filter((e) => e.type === "trade_executed").length,
    trades_rejected: newEvents.filter((e) => e.type === "trade_rejected").length,
    deaths: newEvents.filter((e) => e.type === "death").length,
    migrations: migrationsThisTick,
    births: birthsThisTick,
    hires: hiresThisTick,
    contract_breaks: contractBreaksThisTick,
  };

  const allStats = [...state.statsHistory, tickStats];
  const trimmedStats = allStats.length > 500 ? allStats.slice(allStats.length - 500) : allStats;

  // 10. DYNASTIES — Build dynasty records
  const dynasties: Record<string, Dynasty> = {};
  const allAgentsList = Object.values(agents);

  // Find all founders (generation 0 agents who have children)
  for (const agent of allAgentsList) {
    if (agent.generation !== 0) continue;
    if (agent.children_ids.length === 0) continue;

    // BFS to find all descendants
    const members: string[] = [];
    let totalEver = 0;
    let totalNetWorth = 0;
    const queue = [...agent.children_ids];
    const visited = new Set<string>();

    // Include founder
    if (agent.alive) {
      members.push(agent.id);
      totalNetWorth += agent.net_worth;
    }
    totalEver++;

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const descendant = agents[id];
      if (!descendant) continue;
      totalEver++;
      if (descendant.alive) {
        members.push(descendant.id);
        totalNetWorth += descendant.net_worth;
      }
      queue.push(...descendant.children_ids);
    }

    if (totalEver > 0) {
      dynasties[agent.id] = {
        founder_id: agent.id,
        members,
        total_ever: totalEver,
        total_net_worth: totalNetWorth,
      };
    }
  }

  return {
    grid,
    tick,
    agents,
    running: population > 0 ? state.running : false,
    speed: state.speed,
    population,
    initialPopulation: state.initialPopulation,
    events: trimmedEvents,
    tradeFlashes: allFlashes,
    spawnFlashes: allSpawnFlashes,
    statsHistory: trimmedStats,
    thinkingInProgress: state.thinkingInProgress,
    llmEnabled: state.llmEnabled,
    dynasties,
    activeExperiment: state.activeExperiment,
    firedEventTicks: state.firedEventTicks,
    taxPool: state.taxPool,
  };
}

// ─── Gini Coefficient ─────────────────────────────────────────────────────────

function calculateGini(agents: Agent[]): number {
  const worths = agents.map((a) => a.net_worth).sort((a, b) => a - b);
  const n = worths.length;
  if (n === 0) return 0;
  const total = worths.reduce((s, w) => s + w, 0);
  if (total === 0) return 0;
  const numerator = worths.reduce((sum, w, i) => sum + (2 * (i + 1) - n - 1) * w, 0);
  return numerator / (n * total);
}

// ─── LLM Integration Helpers ──────────────────────────────────────────────────

export function buildThinkRequests(
  state: WorldState,
  thinkType: "strategic" | "reflection"
): AgentThinkRequest[] {
  const requests: AgentThinkRequest[] = [];
  const aliveAgents = Object.values(state.agents).filter((a) => a.alive);

  for (const agent of aliveAgents) {
    // Get neighbor info
    const neighborIds = getAliveNeighborIds(state.grid, agent.position.x, agent.position.y, state.agents);
    const neighbors = neighborIds.map((nId) => {
      const n = state.agents[nId];
      const rep = agent.reputation[nId];
      return {
        id: n.id,
        type: n.type,
        inventory: { ...n.inventory },
        health: n.health,
        trust_score: rep ? rep.trust_score : 0.5,
      };
    });

    requests.push({
      agent_id: agent.id,
      agent_type: agent.type,
      traits: { ...agent.traits },
      health: agent.health,
      inventory: { ...agent.inventory },
      neighbors,
      memory: [...agent.memory],
      reputation: { ...agent.reputation },
      think_type: thinkType,
      ticks_alive: agent.ticks_alive,
      ticks_needs_unmet: agent.ticks_needs_unmet,
      ticks_at_full_health: agent.ticks_at_full_health,
      production_costs: { ...agent.production_costs },
      production_yields: { ...agent.production_yields },
      parent_id: agent.parent_id,
      children_ids: [...agent.children_ids],
      generation: agent.generation,
      employer_id: agent.employer_id,
      employee_ids: [...agent.employee_ids],
      contract: agent.contract ? { ...agent.contract } : null,
    });
  }

  return requests;
}

export function applyStrategicDecisions(
  state: WorldState,
  decisions: AgentDecision[]
): WorldState {
  const agents = { ...state.agents };
  const newEvents: WorldEvent[] = [];

  for (const decision of decisions) {
    const agent = agents[decision.agent_id];
    if (!agent || !agent.alive) continue;

    // Deep copy agent to mutate
    agents[decision.agent_id] = {
      ...agent,
      position: { ...agent.position },
      inventory: { ...agent.inventory },
      traits: { ...agent.traits },
      production_costs: { ...agent.production_costs },
      production_yields: { ...agent.production_yields },
      memory: [...agent.memory],
      reputation: { ...agent.reputation },
      children_ids: [...agent.children_ids],
      employee_ids: [...agent.employee_ids],
      contract: agent.contract ? { ...agent.contract } : null,
      strategic_plan: {
        production_focus: decision.production_focus,
        trade_with: decision.trade_with,
        avoid_trading_with: decision.avoid_trading_with,
        willing_to_offer: decision.willing_to_offer,
        seeking: decision.seeking,
        should_migrate: decision.should_migrate,
        thought: decision.thought,
        expires_at_tick: state.tick + 10,
        should_reproduce: !!decision.should_reproduce,
        should_hire: !!decision.should_hire,
        break_contract: !!decision.break_contract,
      },
    };

    const emoji = AGENT_CONFIGS[agent.type].emoji;
    newEvents.push({
      id: eventId(),
      tick: state.tick,
      type: "strategic_thought",
      agents: [agent.id],
      message: `🧠 ${emoji} ${agent.id} (strategic): "${decision.thought}"`,
    });
  }

  const allEvents = [...state.events, ...newEvents];
  const trimmedEvents = allEvents.length > 500 ? allEvents.slice(-500) : allEvents;

  return {
    ...state,
    agents,
    events: trimmedEvents,
    thinkingInProgress: false,
  };
}

export function applyReflectionDecisions(
  state: WorldState,
  decisions: ReflectionDecision[]
): WorldState {
  const agents = { ...state.agents };
  const newEvents: WorldEvent[] = [];

  for (const decision of decisions) {
    const agent = agents[decision.agent_id];
    if (!agent || !agent.alive) continue;

    // Deep copy
    const updatedAgent = {
      ...agent,
      position: { ...agent.position },
      inventory: { ...agent.inventory },
      traits: { ...agent.traits },
      production_costs: { ...agent.production_costs },
      production_yields: { ...agent.production_yields },
      memory: [...agent.memory],
      reputation: { ...agent.reputation },
      strategic_plan: agent.strategic_plan ? { ...agent.strategic_plan } : null,
    };

    // Apply trust updates
    for (const [otherId, newTrust] of Object.entries(decision.updated_trust)) {
      if (updatedAgent.reputation[otherId]) {
        updatedAgent.reputation[otherId] = {
          ...updatedAgent.reputation[otherId],
          trust_score: Math.max(0, Math.min(1, newTrust)),
        };
      }
    }

    agents[decision.agent_id] = updatedAgent;

    const emoji = AGENT_CONFIGS[agent.type].emoji;
    newEvents.push({
      id: eventId(),
      tick: state.tick,
      type: "reflection",
      agents: [agent.id],
      message: `💭 ${emoji} ${agent.id} (reflection): "${decision.thought}"`,
    });
  }

  const allEvents = [...state.events, ...newEvents];
  const trimmedEvents = allEvents.length > 500 ? allEvents.slice(-500) : allEvents;

  return {
    ...state,
    agents,
    events: trimmedEvents,
    thinkingInProgress: false,
  };
}
