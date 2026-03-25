# Phase 6: Experiments + Auth + Monitor API

**Goal:** Pre-configured experiment scenarios, Clerk authentication, and the Samantha monitoring API endpoint. The simulation is now complete.

**Prerequisite:** Phase 5 complete and working.

---

## What to Build

### 1. Clerk Authentication

Same setup as Mission Control and other apps:
- Protect all routes with Clerk middleware
- Only authorized users can access the simulation
- Sign-in page at `/sign-in`

Environment variables (Vercel):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<key>
CLERK_SECRET_KEY=<key>
```

### 2. Monitor API: `GET /api/monitor`

Read-only endpoint for Samantha to query simulation state:

```typescript
// GET /api/monitor?key=<MONITOR_API_KEY>

// Response:
{
  "tick": 472,
  "running": true,
  "speed": 5,                    // ticks per second
  "population": {
    "total": 218,
    "farmer": 71,
    "builder": 68,
    "energist": 42,
    "generalist": 37
  },
  "economy": {
    "gini_coefficient": 0.34,
    "avg_health": 72.4,
    "total_trades_executed": 4821,
    "total_trades_rejected": 1203,
    "total_births": 43,
    "total_deaths": 25,
    "total_hires": 12,
    "total_contract_breaks": 3,
    "active_contracts": 9,
    "largest_dynasty": { "founder": "Agent_12", "members": 8 }
  },
  "recent_events": [
    "[Tick 472] 🌾 Agent_12 → 🏗️ Agent_8: traded 4 food for 2 shelter ✅",
    "[Tick 471] 💀 Agent_55 died. Starvation. Survived 23 ticks.",
    "[Tick 470] 🎉 Agent_12 spawned Agent_89 (child)",
    "[Tick 469] 🧠 Agent_47: 'Switching to shelter production — better margins'",
    "[Tick 468] 💼 Agent_12 hired Agent_91 (worker)"
  ],
  "top_agents": [
    { "id": "Agent_12", "type": "farmer", "net_worth": 342, "health": 100, "employees": 3, "children": 4 },
    { "id": "Agent_8", "type": "builder", "net_worth": 298, "health": 95, "employees": 1, "children": 2 }
  ],
  "bottom_agents": [
    { "id": "Agent_55", "type": "energist", "net_worth": 12, "health": 20, "ticks_starving": 5 }
  ],
  "experiment": "baseline"       // Which experiment is running
}
```

Authentication: `MONITOR_API_KEY` environment variable. Reject requests without valid key.

### 3. Experiment Presets

Dropdown in the controls bar to select a scenario before starting:

**Experiment 1: Baseline**
- Default settings. 100 agents, 15×15 grid, no shocks.

**Experiment 2: Famine**
- At tick 200: Kill all food inventory in a 5×5 region (top-left corner)
- Watch: refugees flee, death spike, recovery (or not)

**Experiment 3: Monopoly**
- One agent at center starts with 10× production yields
- Watch: does a trade empire form around them? Do they hire workers?

**Experiment 4: Tax**
- Every tick: 10% of all executed trades goes to a "government" pool
- Every 50 ticks: government pool redistributed equally to all alive agents
- Watch: does redistribution help or hurt? Do agents trade less?

**Experiment 5: Technology Shock**
- At tick 300: all farmers get 2× food yield
- Watch: food glut, farmer population boom, then crash?

**Experiment 6: Wall**
- Impassable barrier across the middle of the grid (row 7 blocked)
- Two isolated economies develop independently
- At tick 500 (optional): remove wall, watch equilibration

**Experiment 7: Plague**
- At tick 200: random 30% of agents lose 50 HP
- Watch: who survives? Do healthy agents exploit sick neighbors?

**Experiment 8: Gold Rush**
- At tick 100: add a 4th good "gold" — doesn't decay, no survival need, some agents can produce it
- Watch: does gold become currency? Do agents start accepting gold for food/shelter?

### 4. Experiment Configuration

```typescript
interface Experiment {
  id: string;
  name: string;
  description: string;
  initial_agents?: number;          // Override default 100
  grid_size?: number;               // Override default 15
  events: ExperimentEvent[];        // Scheduled shocks
}

interface ExperimentEvent {
  trigger_tick: number;
  type: "famine" | "boost" | "plague" | "wall" | "remove_wall" | "tax_start" | "add_good";
  config: Record<string, any>;      // Event-specific parameters
}
```

Experiments are defined as static config objects — no UI for creating custom experiments (that's future scope).

### 5. Experiment Events in Chat Feed

When an experiment event triggers:
```
[Tick 200] ⚡ EXPERIMENT EVENT: Famine
  All food destroyed in region (0,0)→(4,4)
  15 agents affected. Watch for migration and death.
```

Bold, distinct color (red/orange), impossible to miss in the feed.

### 6. Save/Load State

**Save:**
- Button in controls bar: "💾 Save"
- Serializes entire world state to JSON
- Stores in localStorage (keyed by experiment + timestamp)
- Also option to download as .json file

**Load:**
- Button: "📂 Load"
- Dropdown of saved states from localStorage
- Or file upload for .json
- Restores world state and continues from saved tick

### 7. Export Run Data

Button: "📊 Export"
- Downloads a ZIP containing:
  - `ledger.jsonl` — all events
  - `summary.md` — narrative
  - `stats.json` — final statistics

---

## What This Completes

With Phase 6 done, the full simulation is operational:
- ✅ 15×15 grid with 100+ agents
- ✅ Production, trading, consumption, decay
- ✅ Migration
- ✅ LLM-powered strategic thinking + reflection
- ✅ Memory + reputation
- ✅ Reproduction + hiring
- ✅ Live map + chat feed + stats dashboard
- ✅ 8 experiment presets
- ✅ Auth-protected
- ✅ Samantha monitoring API
- ✅ Save/load/export

---

## Definition of Done

1. Clerk auth protects all routes
2. `/api/monitor` returns full simulation state with valid API key
3. All 8 experiments selectable and functional
4. Experiment events trigger at correct ticks with chat notifications
5. Save/load works (localStorage + file download/upload)
6. Export produces valid ledger.jsonl + summary.md + stats.json
7. Full simulation runs stable for 1000+ ticks without crashes
8. Deployed to Vercel, accessible only to authenticated users
