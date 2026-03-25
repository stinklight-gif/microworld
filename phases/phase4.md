# Phase 4: LLM Integration

**Goal:** Replace rule-based decisions with LLM-powered strategic thinking. Agents develop memory, reputation, and evolving personalities. This is where the simulation becomes genuinely interesting.

**Prerequisite:** Phase 3 complete and working.

---

## What to Build

### 1. API Route: `/api/think`

Server-side route that handles all LLM calls. API key stays on Vercel, never exposed to client.

```typescript
// POST /api/think
// Body: { agents: AgentThinkRequest[] }
// Returns: { decisions: AgentDecision[] }

interface AgentThinkRequest {
  agent_id: string;
  agent_state: AgentState;        // Current inventory, health, traits
  world_context: WorldContext;     // Neighbors, their inventories, recent events
  memory: MemoryEntry[];          // Last 20 events this agent experienced
  reputation: Record<string, ReputationEntry>;
  think_type: "strategic" | "reflection";
}

interface AgentDecision {
  agent_id: string;
  production_plan: { food: number; shelter: number };
  trade_preferences: {
    want_to_trade_with: string[];    // Agent IDs, in preference order
    willing_to_offer: string;        // "food" or "shelter" or "energy"
    seeking: string;                 // What they want
  };
  should_migrate: boolean;
  migration_reason?: string;
  internal_thought: string;          // Shown in chat feed
}
```

**LLM Configuration:**
```
Base URL: https://api.moonshot.ai/v1
Model: kimi-k2.5
API Key: process.env.LLM_API_KEY (Vercel env var)
```

### 2. Hierarchical Mind

**Every tick: Reflexes (no LLM — keep existing rule-based logic)**

The Phase 1-3 rule-based system remains as the default. Agents still produce, trade, consume, migrate using simple rules every tick.

**Every 10th tick: Strategic Thinking (LLM call)**

The LLM receives the agent's full context and returns strategic decisions that override the reflex defaults for the next 10 ticks.

System prompt per agent:
```
You are {agent.name}, a {agent.type} in a small grid economy.

Your personality:
- Risk tolerance: {traits.risk_tolerance} (0=hoarder, 1=gambler)
- Cooperation: {traits.cooperation_bias} (0=selfish, 1=altruistic)
- Time preference: {traits.time_preference} (0=save, 1=consume now)
- Stubbornness: {traits.stubbornness} (0=flexible, 1=holds firm)
- Mobility: {traits.mobility} (0=sedentary, 1=nomadic)

Your situation:
- Health: {health}/100
- Inventory: {energy} energy, {food} food, {shelter} shelter
- You need 3 food + 2 shelter per tick to survive
- Food decays 30%/tick, shelter decays 10%/tick

Your neighbors:
{for each neighbor: name, type, inventory, health, trust_score}

Recent memory (last 10 events):
{memory entries}

Decide your strategy for the next 10 ticks.
Respond with JSON only:
{
  "production_focus": "food" | "shelter" | "balanced",
  "trade_with": ["agent_id_1", "agent_id_2"],
  "avoid_trading_with": ["agent_id_3"],
  "willing_to_offer": "food",
  "seeking": "shelter",
  "should_migrate": false,
  "thought": "Brief explanation of your reasoning"
}
```

**Every 100th tick: Reflection (LLM call)**

Deeper introspection. The LLM reviews the agent's entire recent history and can update beliefs:

```
Review your last 100 ticks of experience.
Your trust scores: {reputation ledger}
Your survival rate: {needs met X out of 100 ticks}

Respond with JSON:
{
  "updated_trust": { "agent_id": 0.8, "agent_id_2": 0.3 },
  "strategy_shift": "description of how your approach is changing",
  "thought": "Reflection on your experience so far"
}
```

### 3. Memory System

Each agent stores their last 20 experiences:

```typescript
interface MemoryEntry {
  tick: number;
  event: string;          // "traded 3 food for 2 shelter with Agent_8"
  sentiment: "positive" | "negative" | "neutral";
  agent_involved?: string;
}
```

Memory is injected into the LLM prompt. Agents remember who helped them, who refused trades, who they traded with successfully.

### 4. Reputation System

Each agent tracks trust scores for agents they've interacted with:

```typescript
interface ReputationEntry {
  agent_id: string;
  trades_completed: number;
  trades_refused: number;
  trust_score: number;     // 0.0 - 1.0, calculated from history
}
```

Trust score formula:
```
trust = trades_completed / (trades_completed + trades_refused + 1)
```

Trust affects:
- Strategic thinking: LLM sees trust scores and decides who to trade with
- Reflex trading: Agents with trust < 0.3 get auto-rejected in rule-based ticks

### 5. Batched LLM Calls

Don't call the LLM 100 times sequentially. Batch agents into groups:

```typescript
// Every 10th tick:
const agentsNeedingThought = aliveAgents; // All alive agents
const batches = chunk(agentsNeedingThought, 10); // Groups of 10

for (const batch of batches) {
  const response = await fetch('/api/think', {
    method: 'POST',
    body: JSON.stringify({ agents: batch.map(buildThinkRequest) })
  });
  // Process responses
}
```

The API route can process each agent in parallel (Promise.all) to speed things up.

### 6. Chat Feed: Strategic Thoughts

On strategic thinking ticks, show agent thoughts in the chat:

```
[Tick 50] 🧠 Agent_12 (strategic): "Food surplus is high but 
shelter scarce nearby. Switching to shelter production despite 
higher cost — the trade margin is worth it. Agent_8 is reliable 
(trust: 0.85). Avoiding Agent_31 (trust: 0.15)."
```

On reflection ticks:
```
[Tick 100] 💭 Agent_12 (reflection): "50 ticks of stable trading 
with Agent_8. Increasing trust. Agent_31 rejected my last 3 offers — 
dropping trust to 0.1. Considering migration if shelter supply 
doesn't improve."
```

Add these as new event types with distinct colors (purple for thoughts).

### 7. Trade Negotiation (LLM-Enhanced)

On strategic ticks (every 10th), the trade phase uses LLM output:
- Agent's `trade_with` list determines who they approach first
- Agent's `willing_to_offer` and `seeking` guide the trade proposal
- The receiving agent uses their own strategic preferences to accept/reject

On reflex ticks (other 9 out of 10), the rule-based trading continues as before.

---

## Updated Tick Loop

```
Every tick:
  1. RECEIVE    → +5 energy
  2. PRODUCE    → Strategic plan (if set) or rule-based fallback
  3. TRADE      → Strategic preferences (if set) or rule-based fallback
  4. CONSUME    → -3 food, -2 shelter
  5. MOVE       → Strategic decision (if set) or rule-based fallback
  6. DECAY      → food -30%, shelter -10%
  7. CHECK      → Death
  8. MEMORY     → [NEW] Record significant events to agent memory
  9. REPUTATION → [NEW] Update trust scores from trade outcomes
  10. LOG       → Push events to chat feed
  11. STATS     → Calculate TickStats

Every 10th tick (before step 2):
  → THINK: Batch LLM call for all agents → update strategic plans

Every 100th tick (before step 2):
  → REFLECT: Batch LLM call → update trust scores, strategy shifts
```

---

## Environment Variables (Vercel)

```
LLM_BASE_URL=https://api.moonshot.ai/v1
LLM_API_KEY=<kimi-api-key>
LLM_MODEL=kimi-k2.5
```

---

## Cost Estimate

- ~100 alive agents × 1 call per strategic round = 100 calls every 10 ticks
- Per 1000 ticks: 10,000 strategic calls + 1,000 reflection calls = 11,000 calls
- At Kimi K2.5 pricing: ~$1-3 per 1000 ticks

---

## What NOT to Build Yet

- ❌ No reproduction or hiring
- ❌ No experiments
- ❌ No monitor API
- ❌ No save/load state

---

## Definition of Done

1. `/api/think` route works with Kimi K2.5
2. Agents produce strategic thoughts every 10 ticks
3. Thoughts appear in chat feed (purple/distinct color)
4. Memory system records last 20 events per agent
5. Reputation system tracks trust scores
6. Trust scores influence trade decisions
7. Reflections every 100 ticks update trust and strategy
8. Agent behavior noticeably changes based on LLM decisions (not just random)
9. Detail card shows agent's memory and reputation ledger
10. Performance: 10-tick strategic round completes in < 30 seconds
