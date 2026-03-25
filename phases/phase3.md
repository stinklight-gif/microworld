# Phase 3: Stats Dashboard + Migration

**Goal:** Bottom panel with live charts tracking the economy. Agents can now move when starving, creating emergent migration patterns.

**Prerequisite:** Phase 2 complete and working.

---

## What to Build

### 1. Migration Logic

Add to tick loop after CONSUME, before DECAY:

```
MOVE: If ticks_needs_unmet >= 3 AND agent.traits.mobility > 0.3:
  → Scan all 8 adjacent cells for empty spaces
  → Move to empty cell closest to a neighbor of a DIFFERENT type
  → If no good options: move to random empty adjacent cell
  → If no empty adjacent cells: stay put
  → Log migration event to chat feed
```

Migration message templates:
```
"🚶 Agent_47 migrated east (seeking food traders)"
"🚶 Agent_12 moved to (5,7) — starving, looking for builders"
```

Agents with low mobility trait (< 0.3) never migrate — they'd rather die in place.

### 2. Stats Dashboard (Bottom Panel)

A horizontal panel below the map + chat, containing 4-5 live charts.

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Controls Bar                                  │
├─────────────────────┬────────────────────────┤
│   Canvas Grid       │    Chat Feed            │
├─────────────────────┴────────────────────────┤
│ 📊 Dashboard                                  │
│ ┌──────────┬──────────┬──────────┬──────────┐│
│ │Population│  Gini    │  Trade   │  Health   ││
│ │ (line)   │ (line)   │ (bar)    │ (line)   ││
│ │          │          │          │          ││
│ └──────────┴──────────┴──────────┴──────────┘│
│ Leaderboard: 🏆 Top 5 / 💀 Bottom 5          │
└──────────────────────────────────────────────┘
```

### 3. Charts (use Recharts)

Install: `npm install recharts`

**Chart 1: Population Over Time**
- Stacked area chart
- X axis: tick number
- Y axis: agent count
- 4 colored layers: farmer (green), builder (orange), energist (yellow), generalist (gray)
- Update every tick

**Chart 2: Gini Coefficient**
- Line chart
- X axis: tick number
- Y axis: 0.0 - 1.0
- Single line showing wealth inequality
- Calculate Gini from net_worth of all alive agents each tick

```typescript
function calculateGini(agents: Agent[]): number {
  const worths = agents.map(a => a.net_worth).sort((a, b) => a - b);
  const n = worths.length;
  if (n === 0 || worths.reduce((s, w) => s + w, 0) === 0) return 0;
  const numerator = worths.reduce((sum, w, i) => sum + (2 * (i + 1) - n - 1) * w, 0);
  return numerator / (n * worths.reduce((s, w) => s + w, 0));
}
```

**Chart 3: Trade Volume**
- Bar chart
- X axis: tick number (last 50 ticks)
- Y axis: number of trades executed
- Color: green for executed, red for rejected (stacked)

**Chart 4: Average Health**
- Line chart
- X axis: tick number
- Y axis: 0-100
- Single line showing average health of alive agents

### 4. Leaderboard (Below Charts)

Horizontal row showing top 5 richest and bottom 5 poorest alive agents:

```
🏆 Top 5: Agent_12 (342) | Agent_8 (298) | Agent_47 (271) | Agent_3 (255) | Agent_91 (240)
💀 Bottom 5: Agent_55 (12) | Agent_71 (18) | Agent_23 (25) | Agent_99 (31) | Agent_44 (38)
```

- Each agent name is clickable → selects on map + detail card
- Numbers are net worth
- Color coded: top = gold, bottom = red

### 5. Data Collection

Store stats history for charts:

```typescript
interface TickStats {
  tick: number;
  population: number;
  population_by_type: Record<string, number>;
  gini_coefficient: number;
  avg_health: number;
  trades_executed: number;
  trades_rejected: number;
  deaths: number;
  migrations: number;
}
```

Keep an array of the last 500 TickStats for chart rendering. Older data dropped.

### 6. Performance Optimization

- Charts update every 5 ticks (not every tick) when speed > 10 ticks/sec
- Charts update every tick when speed <= 10 ticks/sec
- Canvas uses `requestAnimationFrame` and only re-renders changed cells
- Chat feed uses virtual scrolling if > 200 events visible

---

## Updated Tick Loop

```
1. RECEIVE    → +5 energy
2. PRODUCE    → Rule-based
3. TRADE      → Rule-based neighbor trading
4. CONSUME    → -3 food, -2 shelter
5. MOVE       → [NEW] Migrate if starving + mobile enough
6. DECAY      → food -30%, shelter -10%
7. CHECK      → Death check
8. LOG        → Push events to chat feed
9. STATS      → [NEW] Calculate and store TickStats
```

---

## Expected Behavior Changes

- Starving agents now migrate toward diversity (instead of dying in place)
- Migration creates emergent "trade routes" — agents cluster around mixed-type neighborhoods
- Homogeneous regions empty out as agents flee
- Gini coefficient should increase over time (some agents in good locations thrive, others wander and die)
- Dashboard visualizes all of this in real time

---

## What NOT to Build Yet

- ❌ No LLM calls
- ❌ No reproduction or hiring
- ❌ No experiments
- ❌ No monitor API
- ❌ No memory or reputation system
- ❌ No save/load state

---

## Definition of Done

1. Starving mobile agents migrate to adjacent empty cells
2. Migration events appear in chat feed
3. All 4 charts render and update in real time
4. Leaderboard shows top/bottom 5 with clickable names
5. Charts handle high tick speeds without lag
6. Dashboard is collapsible (can hide to give more room to map + chat)
7. Migration creates visible clustering patterns on the map
