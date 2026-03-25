# Phase 2: Trading + Chat Feed

**Goal:** Agents trade with neighbors using simple rules. A live chat feed shows all interactions. Population should now stabilize instead of dying off.

**Prerequisite:** Phase 1 complete and working.

---

## What to Build

### 1. Neighbor Detection

Each agent can see the 8 cells around them (Moore neighborhood). Only alive agents in adjacent cells are potential trade partners.

```typescript
function getNeighbors(grid: Grid, x: number, y: number): Agent[] {
  // Check all 8 surrounding cells
  // Return alive agents only
}
```

### 2. Trade Logic (Rule-Based, No LLM)

After production, before consumption, agents attempt trades:

```
For each agent (random order):
  For each neighbor:
    1. Calculate my surplus: any good where inventory > 150% of survival need
    2. Calculate my deficit: any good where inventory < survival need
    3. Calculate neighbor's surplus and deficit
    4. If I have surplus of X AND neighbor has surplus of Y
       AND I need Y more than X AND they need X more than Y:
       → Propose trade: swap min(my_surplus, their_deficit) units
    5. Neighbor accepts if the trade improves their survival odds
       (simple check: does receiving X get them closer to meeting needs?)
```

**Trade constraints:**
- Can only trade with immediate neighbors (8 surrounding cells)
- Max 1 trade per agent per tick (keep it simple)
- Can't trade more than you have
- Both parties must benefit (or at least not be worse off)

### 3. Trade Proposal Data

```typescript
interface Trade {
  tick: number;
  from_agent: string;
  to_agent: string;
  offered: { good: string; amount: number };
  requested: { good: string; amount: number };
  accepted: boolean;
  message: string;    // Template-generated, not LLM
}
```

### 4. Trade Message Templates

Generate natural-sounding messages from templates (NO LLM):

```typescript
const OFFER_TEMPLATES = [
  "{from} offers {amount_o} {good_o} to {to} for {amount_r} {good_r}",
  "{from}: \"I'll give you {amount_o} {good_o} for {amount_r} {good_r}\"",
  "{from} → {to}: {amount_o} {good_o} ↔ {amount_r} {good_r}",
];

const ACCEPT_TEMPLATES = [
  "{to}: \"Deal.\" ✅",
  "{to} accepts. ✅ Trade executed.",
  "✅ {to} agreed.",
];

const REJECT_TEMPLATES = [
  "{to}: \"No thanks.\" ❌",
  "❌ {to} declined.",
  "{to} rejected the offer. ❌",
];
```

### 5. Event Log Data

All significant events get logged for the chat feed:

```typescript
type EventType = "trade_executed" | "trade_rejected" | "death" | "needs_met" | "needs_unmet" | "decay";

interface WorldEvent {
  tick: number;
  type: EventType;
  agents: string[];         // Agent IDs involved
  message: string;          // Human-readable
  data?: Record<string, any>;
}
```

Log events for:
- ✅ Trade executed
- ❌ Trade rejected
- 💀 Agent died
- ⚠️ Agent needs unmet (health dropping)

Don't log routine stuff (production, decay) — too noisy.

### 6. Chat Feed Panel (Right Side)

A scrolling panel to the right of the map showing the event log:

```
┌──────────────────────────────────────────┐
│ 📜 Town Square                    🔍 Filter│
│──────────────────────────────────────────│
│ [Tick 47] 🌾 Agent_12 → 🏗️ Agent_8:    │
│   "I'll give you 4 food for 2 shelter"  │
│   ✅ Trade executed.                     │
│                                          │
│ [Tick 47] ⚡ Agent_31 → 🌾 Agent_12:    │
│   Offers 3 energy for 2 food            │
│   ❌ Agent_12 declined.                  │
│                                          │
│ [Tick 48] 💀 Agent_55 died.              │
│   Cause: starvation. Survived 23 ticks. │
│                                          │
│ [Tick 49] ⚠️ Agent_71 needs unmet.       │
│   Missing 2 food. Health: 60 → 50.      │
│                                          │
│ ...                                      │
└──────────────────────────────────────────┘
```

**Features:**
- Auto-scrolls to bottom (newest events)
- Scroll up to see history
- Each event color-coded by type (green=trade, red=death, yellow=warning)
- Agent names are clickable → selects agent on map + shows detail card
- Max buffer: last 500 events (older ones dropped for performance)

**Filters (top of panel):**
- All | Trades | Deaths | Warnings
- Agent search box (type agent ID to filter to just their events)

### 7. Layout Update

```
┌──────────────────────────────────────────────┐
│ Controls Bar (Play/Pause/Speed/Tick/Pop)     │
├─────────────────────┬────────────────────────┤
│                     │                        │
│   Canvas Grid       │    Chat Feed           │
│   (15×15)           │    (scrolling events)  │
│                     │                        │
│                     │                        │
│   Detail Card       │                        │
│   (below grid)      │                        │
│                     │                        │
├─────────────────────┴────────────────────────┤
│ (Phase 3 will add stats dashboard here)      │
└──────────────────────────────────────────────┘
```

- Map + detail card: ~50% width
- Chat feed: ~50% width
- Responsive: stack vertically on mobile

### 8. Trade Visualization on Map

When a trade executes, briefly flash a line between the two agents on the canvas:
- Green line for 300ms between the two cells
- Or: both cells briefly pulse/glow
- Keep it subtle — shouldn't distract from the overall view

---

## Updated Tick Loop

```
1. RECEIVE    → +5 energy
2. PRODUCE    → Rule-based (same as Phase 1)
3. TRADE      → [NEW] Attempt trades with neighbors
4. CONSUME    → -3 food, -2 shelter (same as Phase 1)
5. DECAY      → food -30%, shelter -10% (same as Phase 1)
6. CHECK      → Death check (same as Phase 1)
7. LOG        → [NEW] Push events to chat feed
```

---

## Expected Behavior Change from Phase 1

- In Phase 1, most agents die because they can only produce one thing efficiently
- With trading, complementary neighbors (farmer next to builder) should survive
- Isolated agents (surrounded by same type) will still die
- **Clusters of diverse types should emerge as survival islands**
- Population should stabilize at ~40-70% of starting (vs ~10-20% in Phase 1)

---

## What NOT to Build Yet

- ❌ No LLM calls (all trades are rule-based)
- ❌ No stats dashboard / charts
- ❌ No migration
- ❌ No reproduction or hiring
- ❌ No experiments
- ❌ No monitor API
- ❌ No memory or reputation system

---

## Definition of Done

1. Agents trade surplus goods with neighbors each tick
2. Chat feed shows all trades, deaths, and warnings in real time
3. Population stabilizes (doesn't all die off like Phase 1)
4. Trade flash animation visible on map
5. Chat filters work (by event type + agent search)
6. Clicking agent name in chat selects them on map
7. Layout is clean two-panel (map + chat)
