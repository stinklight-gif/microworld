# Phase 5: Reproduction + Hiring

**Goal:** Agents can now create new agents — either children (biological) or workers (economic). Dynasties and businesses emerge.

**Prerequisite:** Phase 4 complete and working.

---

## What to Build

### 1. Biological Reproduction

**Trigger:** Agent reaches reproduction threshold:
- Health = 100 for 5+ consecutive ticks
- Surplus of ALL goods (food > 6, shelter > 4, energy > 10)
- At least one adjacent empty cell

**Process:**
1. Agent's LLM strategic thought includes: `"should_reproduce": true`
2. Parent spends 50% of current surplus (given to child as starting inventory)
3. New agent spawned in adjacent empty cell
4. Child inherits:
   - **Type:** Same as parent
   - **Traits:** Parent's values ± random mutation (±0.1, clamped to 0-1)
   - **Memory:** Empty
   - **Reputation:** Empty
   - **Health:** 80 (not full — babies are fragile)
   - **parent_id:** Set to parent's ID

**Chat feed:**
```
[Tick 152] 🎉 Agent_12 spawned Agent_113 (child)
  Type: farmer | Traits: risk=0.68 (parent: 0.73), coop=0.25 (parent: 0.21)
  Starting inventory: 3 food, 2 shelter, 5 energy
```

### 2. Economic Hiring

**Trigger:** Agent's LLM strategic thought includes `"should_hire": true`
- Requires: surplus goods, adjacent empty cell
- More likely for agents with high risk_tolerance and low cooperation_bias

**Process:**
1. Parent spends resources to create worker agent
2. Worker gets:
   - **Type:** Random (you can't pick your employee)
   - **Traits:** Fully random
   - **Contract:** `{ employer_id: parent.id, revenue_share: 0.3 }`
   - Worker gives 30% of production to employer each tick

**Contract enforcement:**
- Contract is stored in both agents' memory
- Worker's LLM can decide to break the contract when:
  - Worker's health is high enough to survive alone
  - Worker has accumulated enough surplus
  - Worker's trust in employer drops below 0.3
- If worker breaks contract → employer gets a "betrayal" memory, trust drops to 0
- Employer cannot forcibly prevent it

**Chat feed:**
```
[Tick 200] 💼 Agent_12 hired Agent_118 (worker)
  Type: builder | Contract: 30% revenue share
  Agent_12: "Need help meeting shelter demand from neighbors"

[Tick 250] 🔓 Agent_118 broke contract with Agent_12
  Agent_118: "I've saved enough to go independent. Sorry boss."
  Agent_12 trust in Agent_118: 0.85 → 0.0
```

### 3. Updated Agent Data Model

Add to Agent interface:

```typescript
// Family
parent_id: string | null;
children_ids: string[];
generation: number;           // 0 = original, 1 = first gen child, etc.

// Employment
employer_id: string | null;   // If working for someone
employee_ids: string[];       // Agents working for this one
contract: {
  revenue_share: number;      // 0.3 = give 30% to employer
  active: boolean;
} | null;
```

### 4. Dynasty Tracking

Track family trees for visualization:

```typescript
interface Dynasty {
  founder_id: string;
  members: string[];          // All living descendants
  total_ever: number;         // All descendants ever (including dead)
  total_net_worth: number;    // Sum of living members' net worth
}
```

Show in detail card when agent selected:
```
Family: Generation 2 (grandchild of Agent_12)
Parent: Agent_47 | Siblings: Agent_89, Agent_95
Children: Agent_132, Agent_141
Dynasty net worth: 1,247 (8 living members)
```

### 5. Revenue Share Execution

Each tick, if agent has `employer_id` and `contract.active`:
```
After PRODUCE, before TRADE:
  revenue = this tick's production
  share = floor(revenue * contract.revenue_share)
  Transfer share to employer's inventory
  Log: "Agent_118 paid 2 food to Agent_12 (30% share)"
```

### 6. LLM Integration

Add to strategic thinking prompt:
```
You can take two new actions:
- REPRODUCE: If health=100 for 5+ ticks and surplus is high. 
  Cost: 50% of surplus. Creates a child with your type.
- HIRE: If surplus is high. Cost: some resources. 
  Creates a worker who gives you 30% of their production.
  Workers can eventually quit.

If you're a worker under contract:
- You give 30% of production to {employer_name}
- You can break the contract anytime, but it destroys trust

Add to your response:
"should_reproduce": true/false,
"should_hire": true/false,
"break_contract": true/false
```

### 7. Updated Stats

Add to dashboard:
- **Birth rate:** Births per 10 ticks (rolling average)
- **Employment rate:** % of agents currently under a contract
- **Largest dynasty:** Name + member count
- **Population line chart:** Now includes births/deaths markers

### 8. Map Updates

- Child agents spawn with a brief animation (pulse/glow)
- Workers have a subtle visual indicator (small dot on their cell showing employer's color)
- Dynasty members highlighted when you select any family member

---

## What NOT to Build Yet

- ❌ No experiments
- ❌ No monitor API
- ❌ No save/load state

---

## Definition of Done

1. Agents reproduce when thriving (health 100, surplus, 5+ ticks stable)
2. Children inherit type + mutated traits from parent
3. Agents can hire workers who pay 30% revenue share
4. Workers can break contracts (LLM decides)
5. Family tree visible in detail card
6. Dynasty tracking works (founder → descendants)
7. Employment relationships visible on map
8. Birth/hire/contract-break events in chat feed
9. Dashboard shows birth rate, employment rate, largest dynasty
10. Population grows (not just declines) — the world sustains itself
