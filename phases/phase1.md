# Phase 1: The Grid + Agents

**Goal:** A working visual simulation with agents that produce, consume, and decay — no trading, no LLM. Just the world running.

---

## What to Build

### 1. Next.js App Setup

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Single page app (`/` route)
- Clerk auth (protect all routes — same setup as other apps)
- Environment variables via Vercel only (no .env files committed)

### 2. Agent Data Model

```typescript
interface Agent {
  id: string;                          // "agent_001"
  type: "farmer" | "builder" | "energist" | "generalist";
  position: { x: number; y: number };  // Grid coordinates
  health: number;                      // 0-100
  alive: boolean;

  // Production
  production_costs: { food: number; shelter: number };
  production_yields: { food: number; shelter: number };
  inventory: { energy: number; food: number; shelter: number };

  // Personality traits (0.0 - 1.0, randomly assigned at spawn)
  traits: {
    risk_tolerance: number;
    cooperation_bias: number;
    time_preference: number;
    stubbornness: number;
    mobility: number;
  };

  // Stats
  ticks_alive: number;
  ticks_needs_unmet: number;           // Consecutive ticks starving
  net_worth: number;                   // energy + food*2 + shelter*3 + health
}
```

### 3. Agent Types

| Type | Distribution | Food Cost | Shelter Cost | Food Yield | Shelter Yield |
|------|-------------|-----------|-------------|------------|---------------|
| 🌾 Farmer | 30% | 1 energy | 4 energy | 3 units | 1 unit |
| 🏗️ Builder | 30% | 4 energy | 1 energy | 1 unit | 3 units |
| ⚡ Energist | 20% | 3 energy | 3 energy | 2 units | 1 unit |
| 🔧 Generalist | 20% | 2 energy | 2 energy | 1 unit | 1 unit |

### 4. World Initialization

- 15×15 grid (225 cells)
- On start: randomly place ~100 agents (not all cells filled — leave room for migration later)
- Each agent gets random type (per distribution above) and random trait values (0.0-1.0)
- Starting inventory: `{ energy: 5, food: 3, shelter: 2 }` (enough to survive round 1)

### 5. Tick Loop (Rule-Based, No LLM)

Every tick, for each alive agent in random order:

```
1. RECEIVE    → +5 energy
2. PRODUCE    → Spend energy to make goods:
                Rule: Produce whichever good you have LEAST of
                relative to survival needs (food need=3, shelter need=2).
                Spend all available energy on production.
3. CONSUME    → Subtract survival needs: -3 food, -2 shelter
                If can't meet needs:
                  - Lose 10 HP per unmet category
                  - Increment ticks_needs_unmet
                If needs met:
                  - Gain 2 HP (cap 100)
                  - Reset ticks_needs_unmet to 0
4. DECAY      → food = floor(food * 0.7)   (lose 30%)
                shelter = floor(shelter * 0.9)  (lose 10%)
5. CHECK      → If health <= 0: alive = false (agent dies, cell becomes empty)
```

### 6. Canvas Grid (Left Panel)

- HTML `<canvas>` element, 15×15 grid
- Each cell is a colored square:
  - 🌾 Farmer = green
  - 🏗️ Builder = orange
  - ⚡ Energist = yellow
  - 🔧 Generalist = gray
  - Empty = dark (#1a1a2e or similar)
- Opacity based on health: `opacity = 0.3 + (health/100) * 0.7`
- Dead agents = cell goes empty (dark)
- **Hover tooltip:** Show agent ID, type, health, inventory, traits
- **Click agent:** Select it (highlight border), show detail card below map

### 7. Controls Bar (Top)

- **Play** ▶️ — Start tick loop
- **Pause** ⏸️ — Stop tick loop
- **Step** ⏭️ — Advance exactly 1 tick
- **Reset** 🔄 — Regenerate world with new random agents
- **Speed slider** — 1 tick/sec → 50 ticks/sec
- **Tick counter** — "Tick: 47"
- **Population counter** — "Alive: 87/100"
- **Color mode toggle** — Color by: Type | Health | Wealth

### 8. Agent Detail Card (Below Map, shown when agent clicked)

```
┌─────────────────────────────────┐
│ 🌾 Agent_047 — Farmer           │
│ Health: ████████░░ 82/100        │
│ Position: (7, 4)                 │
│                                  │
│ Inventory:                       │
│   ⚡ Energy: 3                   │
│   🌾 Food: 5                     │
│   🏠 Shelter: 2                  │
│                                  │
│ Traits:                          │
│   Risk: 0.73 | Coop: 0.21       │
│   Time pref: 0.85 | Stub: 0.44  │
│   Mobility: 0.12                 │
│                                  │
│ Stats:                           │
│   Alive: 47 ticks                │
│   Net worth: 112                 │
└─────────────────────────────────┘
```

### 9. Styling

Dark theme matching the README aesthetic:
- Background: `#0a0a1a` or similar deep dark
- Grid background: `#1a1a2e`
- Text: white/light gray
- Agent colors: vivid but not neon
- Controls: clean, minimal
- Font: system or Inter

---

## What NOT to Build Yet

- ❌ No trading
- ❌ No LLM calls
- ❌ No chat feed panel
- ❌ No stats dashboard / charts
- ❌ No migration
- ❌ No reproduction or hiring
- ❌ No experiments
- ❌ No monitor API

---

## Definition of Done

1. Page loads with a 15×15 grid populated with ~100 random agents
2. Clicking Play starts the tick loop — agents produce, consume, decay
3. Agents visually fade as health drops, disappear when dead
4. Population decreases over time (no trading = most agents can't self-sustain)
5. Hover shows agent state, click shows detail card
6. Speed slider works, pause/play/step/reset all functional
7. Color mode toggle switches between type/health/wealth views
8. Deployed to Vercel, behind Clerk auth
