# 🌍 Microworld

A minimal economic simulation inspired by Greg Egan's *Permutation City*.

Three AI agents with different production capabilities must trade to survive. No fixed prices, no central planner — just scarcity, perishability, and negotiation. Economic patterns (money, credit, inflation, inequality) emerge from first principles.

---

## Core Axioms

### 1. Conservation (Scarcity)
Every action costs energy. Agents get a finite energy budget per round (10 units). Producing food costs energy. Building shelter costs energy. Nothing is free.

### 2. Perishability (Time Pressure)
Goods decay each round. Food loses 50%, shelter loses 20%. This prevents hoarding and forces circulation.

### 3. Comparative Advantage (Specialization)
Each agent CAN produce everything, but at different costs:

| Agent | Role | Food Cost | Shelter Cost | Food Yield | Shelter Yield |
|-------|------|-----------|-------------|------------|---------------|
| ⚡ Volt | Energy Producer | 4 energy | 5 energy | 1 unit | 1 unit |
| 🌾 Terra | Farmer | 1 energy | 4 energy | 3 units | 1 unit |
| 🏗️ Mason | Builder | 4 energy | 1 energy | 1 unit | 3 units |

### 4. Survival Pressure
Every agent MUST consume **3 food + 2 shelter per round** or lose 20 HP (max 100 HP). At 0 HP → death. Meeting needs recovers 5 HP/round.

### 5. Price Discovery
No fixed prices. Agents negotiate trades in natural language. Prices emerge from supply/demand/urgency.

---

## Simulation Loop

Each round:
1. **Produce** — Agents spend energy to create goods
2. **Trade** — 3 negotiation sub-rounds (every pair gets a chance)
3. **Consume** — Meet survival needs or lose health
4. **Decay** — Goods perish according to decay rates
5. **Log** — Full ledger recorded

---

## Agent Data Model

```
Agent {
  id: string
  name: string
  role: string
  description: string
  production_costs: { food: number, shelter: number }
  production_yields: { food: number, shelter: number }
  inventory: { energy: number, food: number, shelter: number }
  health: number (0-100)
  alive: boolean
  memory: [] (recent events for LLM context)
}
```

## Trade Model

```
TradeProposal {
  from_agent: string
  to_agent: string
  offering: { good: amount }
  requesting: { good: amount }
  message: string (natural language explanation)
}
```

---

## LLM Integration

Any OpenAI-compatible API (Ollama, LM Studio, OpenAI, Together, Kimi, etc.)

Each agent uses the LLM for:
1. **Production decisions** — "Given my inventory, costs, and needs, what should I produce?"
2. **Trade proposals** — "What should I offer this agent? What do I need from them?"
3. **Trade responses** — "Should I accept this deal?"

The LLM receives the agent's system prompt (role, costs, description), current world state (inventories, health), and trade history. It responds with structured JSON for actions.

---

## Output

Each run generates:
- `ledger.jsonl` — Every transaction, production event, consumption event
- `summary.md` — Human-readable round-by-round narrative
- `stats.json` — Final statistics including:
  - Wealth distribution
  - Trade volume & success rate
  - Gini coefficient (inequality measure)
  - Per-agent: produced, traded, consumed, survived

---

## Experiments to Run

1. **Baseline** — 50 rounds, 3 agents. Does trade emerge? Does specialization happen?
2. **Money emergence** — Add a 4th durable good ("gold") with no consumption value. Do agents use it as currency?
3. **Supply shock** — Energy producer loses 50% capacity at round 25. Does the crisis cascade?
4. **Inflation** — Double energy budget at round 25. Do prices rise?
5. **Inequality** — Start equal, run 100 rounds. Does one agent dominate?
6. **Credit** — Can a starving agent get a loan? Does trust/reputation emerge?

---

## Target Stack

- **Runtime:** Next.js on Vercel (for eventual web UI)
- **LLM:** OpenAI-compatible API (configurable)
- **Logging:** JSON + Markdown
- **Visualization:** Real-time dashboard showing inventories, trades, health (future)

---

## Constants

```
ENERGY_BUDGET = 10 per round
SURVIVAL_NEEDS = { food: 3, shelter: 2 }
DECAY_RATES = { energy: 0%, food: 50%, shelter: 20% }
HEALTH_MAX = 100
HEALTH_PENALTY = 20 per unmet need category
HEALTH_RECOVERY = 5 per round when needs met
```

## License

MIT
