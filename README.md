# 🌍 Microworld

An economic simulation inspired by Greg Egan's *Permutation City*.

Hundreds of LLM-powered agents live on a 2D grid, each with unique personalities shaped by genetics, experience, culture, and reputation. They produce, trade, migrate, reproduce, hire — and you watch it all happen in a live chat room + map view. Economic patterns (money, markets, inequality, culture, dynasties) emerge from first principles.

No fixed prices. No central planner. No scripted behavior. Just scarcity, perishability, and LLM brains making decisions.

---

## Architecture

### The World

```
GRID: 15×15 (225 cells)
TICK: 1 unit of time
GOODS: energy, food, shelter
EACH CELL: empty or contains 1 agent
```

### Agent Types (randomly assigned at birth)

| Type | Role | Food Cost | Shelter Cost | Food Yield | Shelter Yield |
|------|------|-----------|-------------|------------|---------------|
| 🌾 Farmer | Food specialist | 1 energy | 4 energy | 3 units | 1 unit |
| 🏗️ Builder | Shelter specialist | 4 energy | 1 energy | 1 unit | 3 units |
| ⚡ Energist | Energy specialist | — | — | 2 energy per 1 spent | — |
| 🔧 Generalist | Jack of all trades | 2 energy | 2 energy | 1 unit | 1 unit |

Distribution: 30% Farmer, 30% Builder, 20% Energist, 20% Generalist.

### Constants

```
ENERGY_BUDGET       = 5 per tick (solar — everyone gets this)
SURVIVAL_NEEDS      = { food: 3, shelter: 2 } per tick
DECAY_RATES         = { food: 30%/tick, shelter: 10%/tick, energy: 0% }
HEALTH_MAX          = 100
HEALTH_PENALTY      = 10 per unmet need category
HEALTH_RECOVERY     = 2 per tick when all needs met
REPRODUCTION_COST   = 50% of surplus (given to child)
REPRODUCTION_THRESHOLD = health 100 AND surplus of ALL goods for 5+ ticks
```

---

## Agent Personality System

Each agent is an LLM with a unique personality formed from four layers:

### Layer 1: Nature (at spawn)

Randomly assigned trait values, injected into the agent's system prompt:

```
risk_tolerance:    0.0 (hoarder) ──── 1.0 (gambler)
cooperation_bias:  0.0 (selfish) ──── 1.0 (altruistic)
time_preference:   0.0 (save everything) ──── 1.0 (consume now)
stubbornness:      0.0 (accepts any deal) ──── 1.0 (holds firm)
mobility:          0.0 (never moves) ──── 1.0 (nomadic)
```

Example system prompt injection:
> "You are cautious and risk-averse (0.2). You strongly prefer saving surplus over consuming. You're somewhat selfish (0.3) — you'll help neighbors but not at significant cost. You rarely move."

Same LLM, different personality. Two farmers with identical production costs make completely different decisions.

### Layer 2: Nurture (from experience)

After every strategic round, the agent's memory updates with what happened to them. The LLM reads its own history and changes behavior:

- A trusting agent that gets burned becomes suspicious
- A sedentary agent that keeps starving becomes nomadic
- Personality drifts based on lived experience

### Layer 3: Culture (from neighbors)

Agents absorb norms from their region. If all your neighbors hoard, you start hoarding. Regions develop distinct cultures — one corner might be cooperative traders, another suspicious loners. Emergent, not coded.

### Layer 4: Reputation (from interactions)

Each agent maintains a reputation ledger:

```json
{
  "agent_47": { "trades": 12, "refused": 2, "trust": 0.85 },
  "agent_23": { "trades": 3, "refused": 8, "trust": 0.15 }
}
```

Bad reputation = can't get deals. Reform or migrate somewhere nobody knows you.

**Personality = nature + experience + culture + reputation.**

---

## Hierarchical Mind (LLM Cost Management)

Not every decision needs an LLM call. Agents have a layered cognition:

### Every tick: Reflexes (no LLM — rule-based)

Simple autopilot decisions:
```
IF hungry AND have_food → eat
IF have_surplus_of_X AND need_Y → offer X for Y to neighbor
IF offered_trade AND it improves survival odds → accept
```

### Every 10th tick: Strategic Thinking (LLM call)

The agent's "conscious mind" fires. The LLM receives:
- Current inventory, health, traits
- Memory of recent events
- Neighbor states and reputations
- Regional culture observations

Returns strategic decisions:
- What to prioritize producing
- Who to trade with (and who to avoid)
- Whether to migrate
- Whether to attempt reproduction or hiring

### Every 100th tick: Reflection (LLM call)

Deep introspection. The LLM reviews the agent's entire recent history and updates:
- Beliefs about other agents
- Overall strategy
- Trait drift (becoming more/less risk tolerant based on outcomes)

### Cost Estimate (1,000 ticks)

- Strategic rounds: 100 × 225 agents = 22,500 LLM calls
- Reflection rounds: 10 × 225 agents = 2,250 LLM calls
- Total: ~25,000 calls ≈ $2-5 on Kimi K2.5

---

## Tick Loop

Every tick, every agent executes in order:

```
1. RECEIVE    → +5 energy (solar budget)
2. PRODUCE    → Spend energy to make goods (reflex or strategic)
3. LOOK       → See 8 neighboring cells, read their inventories
4. TRADE      → Propose/accept/reject trades with neighbors
5. CONSUME    → -3 food, -2 shelter. Unmet = lose HP.
6. DECAY      → Food -30%, shelter -10%
7. MOVE       → If needs unmet 3+ ticks → migrate to adjacent empty cell
8. REPRODUCE  → If thriving → spawn child OR hire worker (see below)
```

---

## Reproduction & Hiring

### Biological Reproduction (Option 1)

When an agent hits reproduction threshold (health 100, surplus for 5+ ticks):
- Spawns a new agent in adjacent empty cell
- **Child inherits:** Parent's type + parent's traits ± small random mutation
- **Child starts with:** Half of parent's surplus, empty memory, zero reputation
- **Dynasties form:** Successful traits propagate. If environment shifts, whole lineages can collapse while random mutants thrive.

### Economic Hiring (Option 3)

A thriving agent can spend surplus to spawn a "worker":
- Worker gets random traits (you can't pick your employee's personality)
- Worker has a contract encoded in both agents' memory: "Give 30% of production to employer"
- Worker accumulates resources over time
- Worker's LLM might eventually decide to stop paying — and break free
- Employer must decide: enforce (how?), negotiate, or let them go

Both mechanisms coexist. An agent chooses to reproduce (create family) or hire (create business) based on their personality traits and strategic LLM thinking.

---

## LLM Configuration

Any OpenAI-compatible API:

```env
LLM_BASE_URL=https://api.moonshot.ai/v1
LLM_API_KEY=<your-kimi-key>
LLM_MODEL=kimi-k2.5
```

Also works with: Ollama (local), LM Studio (local), OpenAI, Together, Anthropic, etc.

---

## UI — Three-Panel Layout

The entire app is a single page with three synchronized views.

### Left Panel: The Map (bird's eye)

A live 2D canvas grid (15×15). Each cell is an agent:

- **Color by type:** Farmer=green, Builder=orange, Energist=yellow, Generalist=gray
- **Opacity by health:** Bright=healthy, fading=dying, empty cell=black/dark
- **Hover tooltip:** Agent ID, type, inventory, health, top traits, trust score
- **Click agent:** Selects them — highlights in map, filters chat to their activity, shows detail card
- **Watch:** Migration patterns, clusters forming, die-offs, trade route emergence
- **Speed slider:** 1 tick/sec (watch everything) → 100 ticks/sec (fast forward)
- **Pause/play button**
- **Color mode toggle:** Color by type / by health / by wealth / by culture cluster

### Right Panel: The Town Square (chat room)

A scrolling live feed of all agent interactions — like a Discord server:

```
[Tick 47] 🌾 Agent_12 → 🏗️ Agent_8: "I'll give you 4 food 
for 2 shelter. I'm overstocked and winter's coming."

[Tick 47] 🏗️ Agent_8 → 🌾 Agent_12: "Deal." ✅ TRADE EXECUTED

[Tick 47] ⚡ Agent_31 → 🌾 Agent_12: "3 energy for 2 food?"

[Tick 47] 🌾 Agent_12 → ⚡ Agent_31: "No. You burned me last 
time." ❌ REJECTED

[Tick 48] 💀 Agent_55 died. Cause: starvation. Survived 23 ticks.

[Tick 48] 🎉 Agent_12 spawned Agent_67 (child). 
Inherited: farmer, risk_tolerance=0.3

[Tick 49] 🏗️ Agent_8: *migrated east* (seeking food traders)

[Tick 52] 💼 Agent_12 hired Agent_71 (worker). 
Contract: 30% of production. "I need help, too much 
demand from neighbors."
```

**Filter by:**
- Single agent (follow one person's entire story)
- Region (what's happening in a specific area of the map)
- Event type: trades / deaths / births / migrations / hires / reflections
- Agent type (all farmer activity)

**Strategic thinking and reflections are shown too** (every 10th/100th tick):
```
[Tick 50] 🧠 Agent_12 (strategic): "Food surplus is high but 
shelter is scarce in my area. I should produce more shelter 
despite my higher cost — the margin on trades is worth it. 
Agent_8 is reliable. Agent_31 is not."
```

### Bottom Panel: The Dashboard (stats)

Live-updating charts and metrics:

- **Population chart:** Line graph, population over time by type (stacked)
- **Gini coefficient:** Line graph of inequality over time
- **Trade volume:** Bar chart of trades per tick
- **Average health:** Line graph
- **Wealth distribution:** Histogram (how many agents at each wealth level)
- **Leaderboard:** Top 5 richest and bottom 5 poorest agents (clickable → selects in map + chat)
- **Birth/death rate:** Per-tick rolling average

Use Recharts or Chart.js for charting.

---

## Experiments

Pre-configured scenarios (selectable from a dropdown in the UI):

1. **Baseline** — 225 agents, 1000 ticks. Does trade emerge? Does specialization happen?
2. **Famine** — Kill all food in a 5×5 region at tick 200. Watch refugees flee.
3. **Monopoly** — One cell produces 10× output. Does a trade empire form?
4. **Tax** — Siphon 10% of all trades to a "government" agent. Does redistribution help or hurt?
5. **Technology** — Double food production at tick 500. Watch restructuring.
6. **Wall** — Barrier across the map. Two isolated economies diverge.
7. **Bridge** — Remove the wall at tick 500. Watch equilibration.
8. **Plague** — Random 30% health hit to all agents. Who survives?

---

## Data Model

### Agent

```typescript
interface Agent {
  id: string;
  type: "farmer" | "builder" | "energist" | "generalist";
  position: { x: number; y: number };
  health: number;          // 0-100
  alive: boolean;
  
  // Production
  production_costs: Record<string, number>;
  production_yields: Record<string, number>;
  inventory: { energy: number; food: number; shelter: number };
  
  // Personality (0.0 - 1.0)
  traits: {
    risk_tolerance: number;
    cooperation_bias: number;
    time_preference: number;
    stubbornness: number;
    mobility: number;
  };
  
  // Memory & Social
  memory: MemoryEntry[];           // Recent events
  reputation_ledger: Record<string, ReputationEntry>;
  parent_id: string | null;
  children_ids: string[];
  employer_id: string | null;      // If hired by someone
  employee_ids: string[];          // Agents working for this one
  
  // Stats
  ticks_alive: number;
  ticks_needs_unmet: number;       // Consecutive ticks starving (triggers migration at 3)
  total_produced: Record<string, number>;
  total_traded: Record<string, number>;
  total_consumed: Record<string, number>;
  net_worth: number;
}

interface MemoryEntry {
  tick: number;
  event: string;
  details: string;
}

interface ReputationEntry {
  agent_id: string;
  trades_completed: number;
  trades_refused: number;
  trust_score: number;            // 0.0 - 1.0
}
```

### Trade

```typescript
interface TradeProposal {
  from_agent: string;
  to_agent: string;
  offering: Record<string, number>;
  requesting: Record<string, number>;
  message: string;                 // LLM-generated natural language
  accepted: boolean;
  tick: number;
}
```

### World State

```typescript
interface WorldState {
  grid: (Agent | null)[][];        // 15×15
  tick: number;
  agents: Map<string, Agent>;
  trade_history: TradeProposal[];
  events: EventLog[];              // For the chat feed
  stats: {
    population: number;
    population_by_type: Record<string, number>;
    gini_coefficient: number;
    avg_health: number;
    trade_volume: number;
    birth_rate: number;
    death_rate: number;
  };
}
```

---

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Map:** HTML Canvas (2D grid rendering)
- **Charts:** Recharts
- **LLM:** OpenAI SDK (any compatible API via env vars)
- **State:** React state + useReducer for world simulation loop
- **Deployment:** Vercel

### Environment Variables

```env
LLM_BASE_URL=https://api.moonshot.ai/v1
LLM_API_KEY=<key>
LLM_MODEL=kimi-k2.5
```

### Key Implementation Notes

- Simulation runs client-side in the browser (requestAnimationFrame loop with configurable tick speed)
- LLM calls go through a Next.js API route (`/api/think`) to keep the API key server-side
- The API route receives batch requests: array of agent states → array of decisions
- Chat feed is a virtualized scrolling list (react-window or similar) to handle thousands of messages
- Map canvas re-renders on each tick
- Charts update every 10 ticks (not every tick — performance)

---

## Output / Logging

Each simulation run can be exported:

- `ledger.jsonl` — Every transaction, production, consumption, death, birth event
- `summary.md` — Narrative of key events
- `stats.json` — Final statistics (Gini, population curves, trade volumes, wealth distribution)

---

## License

MIT
