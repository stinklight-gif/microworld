"""
Microworld — Core simulation engine.

Three agents with comparative advantage must trade to survive.
Economic patterns emerge from first principles.
"""

import json
import copy
from dataclasses import dataclass, field, asdict
from typing import Optional


# ─── Agent Configuration ─────────────────────────────────────────────────────

AGENT_CONFIGS = {
    "energy": {
        "name": "⚡ Volt",
        "role": "Energy Producer",
        "description": "You run the power plant. Energy is cheap for you to produce, but you're terrible at farming and building.",
        "production_costs": {"energy": 1, "food": 4, "shelter": 5},
        "production_yields": {"energy": 3, "food": 1, "shelter": 1},
    },
    "farmer": {
        "name": "🌾 Terra",
        "role": "Farmer",
        "description": "You run the farm. Food is cheap for you to produce, but energy and shelter are expensive.",
        "production_costs": {"energy": 4, "food": 1, "shelter": 4},
        "production_yields": {"energy": 1, "food": 3, "shelter": 1},
    },
    "builder": {
        "name": "🏗️ Mason",
        "role": "Builder",
        "description": "You run construction. Shelter is cheap for you to produce, but food and energy are expensive.",
        "production_costs": {"energy": 5, "food": 4, "shelter": 1},
        "production_yields": {"energy": 1, "food": 1, "shelter": 3},
    },
}

# Survival needs per round
SURVIVAL_NEEDS = {"food": 3, "shelter": 2}

# Decay rates per round (fraction lost)
DECAY_RATES = {"energy": 0.0, "food": 0.5, "shelter": 0.2}

# Starting energy budget per round
ENERGY_BUDGET = 10

# Health degradation when needs not met
HEALTH_PENALTY = 20  # lose 20 HP per unmet need category
HEALTH_MAX = 100


# ─── Data Structures ─────────────────────────────────────────────────────────

@dataclass
class Agent:
    id: str
    name: str
    role: str
    description: str
    production_costs: dict  # {good: energy_cost_per_unit}
    production_yields: dict  # {good: units_produced_per_action}
    inventory: dict = field(default_factory=lambda: {"energy": 0, "food": 0, "shelter": 0})
    health: int = HEALTH_MAX
    memory: list = field(default_factory=list)  # Recent events for LLM context
    total_produced: dict = field(default_factory=lambda: {"energy": 0, "food": 0, "shelter": 0})
    total_traded_away: dict = field(default_factory=lambda: {"energy": 0, "food": 0, "shelter": 0})
    total_traded_in: dict = field(default_factory=lambda: {"energy": 0, "food": 0, "shelter": 0})
    total_consumed: dict = field(default_factory=lambda: {"energy": 0, "food": 0, "shelter": 0})
    rounds_survived: int = 0
    alive: bool = True

    def net_worth(self) -> float:
        """Simple wealth measure."""
        return self.inventory["energy"] + self.inventory["food"] * 2 + self.inventory["shelter"] * 3 + self.health


@dataclass
class TradeProposal:
    from_agent: str
    to_agent: str
    offering: dict  # {good: amount}
    requesting: dict  # {good: amount}
    message: str  # Natural language explanation

    def describe(self) -> str:
        offer_str = ", ".join(f"{v} {k}" for k, v in self.offering.items() if v > 0)
        request_str = ", ".join(f"{v} {k}" for k, v in self.requesting.items() if v > 0)
        return f"Offer {offer_str} for {request_str}"


@dataclass
class LedgerEntry:
    round: int
    phase: str  # "production", "trade", "consumption", "decay"
    agent: str
    action: str
    details: dict
    timestamp: Optional[str] = None


# ─── World State ──────────────────────────────────────────────────────────────

class World:
    def __init__(self, config_overrides: Optional[dict] = None):
        self.agents: dict[str, Agent] = {}
        self.ledger: list[LedgerEntry] = []
        self.current_round: int = 0
        self.config = config_overrides or {}

        # Initialize agents
        for agent_id, cfg in AGENT_CONFIGS.items():
            self.agents[agent_id] = Agent(
                id=agent_id,
                name=cfg["name"],
                role=cfg["role"],
                description=cfg["description"],
                production_costs=dict(cfg["production_costs"]),
                production_yields=dict(cfg["production_yields"]),
            )

    def get_agent(self, agent_id: str) -> Agent:
        return self.agents[agent_id]

    def alive_agents(self) -> list[Agent]:
        return [a for a in self.agents.values() if a.alive]

    # ─── Phase 1: Production ──────────────────────────────────────────────

    def phase_production(self, decisions: dict[str, dict[str, int]]):
        """
        decisions: {agent_id: {good: units_to_produce}}
        Each unit costs production_costs[good] energy.
        """
        for agent_id, production_plan in decisions.items():
            agent = self.agents[agent_id]
            if not agent.alive:
                continue

            # Grant energy budget
            agent.inventory["energy"] += ENERGY_BUDGET
            self.log("production", agent_id, "energy_grant", {"energy": ENERGY_BUDGET})

            energy_available = agent.inventory["energy"]
            energy_spent = 0

            for good, units in production_plan.items():
                if good == "energy":
                    continue  # Can't "produce" energy, it's the budget
                cost_per_unit = agent.production_costs[good]
                yield_per_action = agent.production_yields[good]
                total_cost = cost_per_unit * units

                # Cap by available energy
                if energy_spent + total_cost > energy_available:
                    affordable = (energy_available - energy_spent) // cost_per_unit
                    units = affordable
                    total_cost = cost_per_unit * units

                if units <= 0:
                    continue

                produced = yield_per_action * units
                agent.inventory[good] += produced
                agent.inventory["energy"] -= total_cost
                energy_spent += total_cost
                agent.total_produced[good] += produced

                self.log("production", agent_id, "produce", {
                    "good": good,
                    "units_ordered": units,
                    "produced": produced,
                    "energy_cost": total_cost,
                })

    # ─── Phase 2: Trade ───────────────────────────────────────────────────

    def execute_trade(self, trade: TradeProposal) -> bool:
        """Execute a trade if both parties have sufficient inventory."""
        from_agent = self.agents[trade.from_agent]
        to_agent = self.agents[trade.to_agent]

        # Validate from_agent has what they're offering
        for good, amount in trade.offering.items():
            if from_agent.inventory.get(good, 0) < amount:
                self.log("trade", trade.from_agent, "trade_failed", {
                    "reason": f"Insufficient {good}",
                    "with": trade.to_agent,
                })
                return False

        # Validate to_agent has what's being requested
        for good, amount in trade.requesting.items():
            if to_agent.inventory.get(good, 0) < amount:
                self.log("trade", trade.to_agent, "trade_failed", {
                    "reason": f"Insufficient {good}",
                    "with": trade.from_agent,
                })
                return False

        # Execute
        for good, amount in trade.offering.items():
            from_agent.inventory[good] -= amount
            to_agent.inventory[good] += amount
            from_agent.total_traded_away[good] += amount
            to_agent.total_traded_in[good] += amount

        for good, amount in trade.requesting.items():
            to_agent.inventory[good] -= amount
            from_agent.inventory[good] += amount
            to_agent.total_traded_away[good] += amount
            from_agent.total_traded_in[good] += amount

        self.log("trade", trade.from_agent, "trade_executed", {
            "with": trade.to_agent,
            "offered": trade.offering,
            "received": trade.requesting,
            "message": trade.message,
        })

        return True

    # ─── Phase 3: Consumption ─────────────────────────────────────────────

    def phase_consumption(self):
        """Agents consume survival needs. Unmet needs damage health."""
        for agent_id, agent in self.agents.items():
            if not agent.alive:
                continue

            needs_met = True
            for good, needed in SURVIVAL_NEEDS.items():
                available = agent.inventory.get(good, 0)
                consumed = min(available, needed)
                agent.inventory[good] -= consumed
                agent.total_consumed[good] += consumed

                if consumed < needed:
                    needs_met = False
                    deficit = needed - consumed
                    agent.health -= HEALTH_PENALTY
                    self.log("consumption", agent_id, "need_unmet", {
                        "good": good,
                        "needed": needed,
                        "consumed": consumed,
                        "deficit": deficit,
                        "health": agent.health,
                    })

            if needs_met:
                agent.rounds_survived += 1
                # Small health recovery when well-fed
                agent.health = min(HEALTH_MAX, agent.health + 5)
                self.log("consumption", agent_id, "needs_met", {
                    "health": agent.health,
                })

            if agent.health <= 0:
                agent.alive = False
                self.log("consumption", agent_id, "died", {
                    "round": self.current_round,
                    "cause": "starvation",
                })

    # ─── Phase 4: Decay ───────────────────────────────────────────────────

    def phase_decay(self):
        """Goods perish according to decay rates."""
        for agent_id, agent in self.agents.items():
            if not agent.alive:
                continue

            for good, rate in DECAY_RATES.items():
                if rate <= 0:
                    continue
                before = agent.inventory[good]
                lost = int(before * rate)
                if lost > 0:
                    agent.inventory[good] -= lost
                    self.log("decay", agent_id, "decay", {
                        "good": good,
                        "before": before,
                        "lost": lost,
                        "after": agent.inventory[good],
                    })

    # ─── Logging ──────────────────────────────────────────────────────────

    def log(self, phase: str, agent: str, action: str, details: dict):
        entry = LedgerEntry(
            round=self.current_round,
            phase=phase,
            agent=agent,
            action=action,
            details=details,
        )
        self.ledger.append(entry)

    def get_agent_state_summary(self, agent_id: str) -> str:
        """Human-readable state for LLM context."""
        agent = self.agents[agent_id]
        inv = agent.inventory
        lines = [
            f"You are {agent.name} ({agent.role})",
            f"Round {self.current_round} | Health: {agent.health}/{HEALTH_MAX}",
            f"Inventory: {inv['energy']} energy, {inv['food']} food, {inv['shelter']} shelter",
            f"Survival needs: {SURVIVAL_NEEDS['food']} food + {SURVIVAL_NEEDS['shelter']} shelter per round",
            f"Production costs (energy per action): food={agent.production_costs['food']}, shelter={agent.production_costs['shelter']}",
            f"Production yields (units per action): food={agent.production_yields['food']}, shelter={agent.production_yields['shelter']}",
            f"Decay rates: food 50%/round, shelter 20%/round",
            f"Energy budget next round: {ENERGY_BUDGET}",
        ]

        # Add other agents' visible state
        for other_id, other in self.agents.items():
            if other_id == agent_id or not other.alive:
                continue
            lines.append(f"\n{other.name} ({other.role}): health={other.health}, inventory={other.inventory}")

        return "\n".join(lines)

    def get_round_summary(self) -> str:
        """Human-readable round summary."""
        lines = [f"\n{'='*60}", f"ROUND {self.current_round} SUMMARY", f"{'='*60}"]
        for agent_id, agent in self.agents.items():
            status = "💀 DEAD" if not agent.alive else f"❤️ {agent.health}HP"
            inv = agent.inventory
            lines.append(
                f"  {agent.name}: {status} | "
                f"🔋{inv['energy']} 🌾{inv['food']} 🏠{inv['shelter']} | "
                f"Worth: {agent.net_worth():.0f}"
            )
        return "\n".join(lines)

    def get_final_stats(self) -> dict:
        """End-of-simulation statistics."""
        stats = {
            "total_rounds": self.current_round,
            "agents": {},
            "total_trades": len([e for e in self.ledger if e.action == "trade_executed"]),
            "total_failed_trades": len([e for e in self.ledger if e.action == "trade_failed"]),
            "deaths": len([e for e in self.ledger if e.action == "died"]),
        }
        for agent_id, agent in self.agents.items():
            stats["agents"][agent_id] = {
                "name": agent.name,
                "alive": agent.alive,
                "health": agent.health,
                "inventory": dict(agent.inventory),
                "net_worth": agent.net_worth(),
                "rounds_survived": agent.rounds_survived,
                "total_produced": dict(agent.total_produced),
                "total_traded_away": dict(agent.total_traded_away),
                "total_traded_in": dict(agent.total_traded_in),
                "total_consumed": dict(agent.total_consumed),
            }

        # Wealth inequality (Gini coefficient)
        worths = sorted([a.net_worth() for a in self.agents.values()])
        n = len(worths)
        if n > 0 and sum(worths) > 0:
            numerator = sum((2 * (i + 1) - n - 1) * w for i, w in enumerate(worths))
            denominator = n * sum(worths)
            stats["gini_coefficient"] = round(numerator / denominator, 3) if denominator else 0
        else:
            stats["gini_coefficient"] = 0

        return stats

    def export_ledger(self) -> list[dict]:
        return [asdict(e) for e in self.ledger]
