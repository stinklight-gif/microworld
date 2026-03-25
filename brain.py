"""
Microworld — LLM Brain for agents.

Each agent uses an LLM to decide production plans and negotiate trades.
Any OpenAI-compatible API works (Ollama, LM Studio, OpenAI, Together, etc.)
"""

import json
import re
from openai import OpenAI
from world import World, Agent, TradeProposal, SURVIVAL_NEEDS


class AgentBrain:
    def __init__(self, client: OpenAI, model: str, verbose: bool = False):
        self.client = client
        self.model = model
        self.verbose = verbose

    def _chat(self, system: str, user: str, temperature: float = 0.7) -> str:
        """Send a chat completion request."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=500,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if self.verbose:
                print(f"  ⚠️  LLM error: {e}")
            return "{}"

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from LLM response (handles markdown code blocks)."""
        # Try to find JSON in code blocks first
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try the whole text as JSON
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find any JSON object
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return {}

    # ─── Production Decision ──────────────────────────────────────────────

    def decide_production(self, world: World, agent_id: str) -> dict[str, int]:
        """Ask the LLM what to produce this round."""
        agent = world.get_agent(agent_id)
        state = world.get_agent_state_summary(agent_id)

        system = f"""You are {agent.name}, a {agent.role} in a small economy.
{agent.description}

You must decide how to spend your energy budget on production.
You will receive {world.config.get('energy_budget', 10)} energy this round.

IMPORTANT RULES:
- Each production action costs energy: food costs {agent.production_costs['food']} energy, shelter costs {agent.production_costs['shelter']} energy
- Each action yields: food yields {agent.production_yields['food']} units, shelter yields {agent.production_yields['shelter']} units
- You need {SURVIVAL_NEEDS['food']} food and {SURVIVAL_NEEDS['shelter']} shelter each round to survive
- Food decays 50% per round, shelter decays 20% per round
- You can trade with other agents after producing
- Think about what you need and what others might want to trade

Respond with ONLY a JSON object like: {{"food": 2, "shelter": 0}}
The numbers are how many production ACTIONS to take (not units produced).
Total energy spent must not exceed your available energy."""

        user = f"Current state:\n{state}\n\nWhat do you produce this round? Respond with JSON only."

        response = self._chat(system, user)
        result = self._extract_json(response)

        if self.verbose:
            print(f"  {agent.name} production plan: {result}")

        # Validate and sanitize
        plan = {}
        for good in ["food", "shelter"]:
            val = result.get(good, 0)
            if isinstance(val, (int, float)) and val > 0:
                plan[good] = int(val)

        # If LLM returns garbage, default to producing what agent is best at
        if not plan:
            best_good = min(
                ["food", "shelter"],
                key=lambda g: agent.production_costs[g]
            )
            plan = {best_good: 2}
            if self.verbose:
                print(f"  {agent.name} using fallback plan: {plan}")

        return plan

    # ─── Trade Proposal ───────────────────────────────────────────────────

    def propose_trade(
        self,
        world: World,
        agent_id: str,
        other_agent_id: str,
        conversation_history: list[str],
    ) -> TradeProposal | None:
        """Ask the LLM to propose a trade with another agent."""
        agent = world.get_agent(agent_id)
        other = world.get_agent(other_agent_id)
        state = world.get_agent_state_summary(agent_id)

        history_str = "\n".join(conversation_history[-6:]) if conversation_history else "No previous trades this round."

        system = f"""You are {agent.name}, a {agent.role} in a small economy.
{agent.description}

You are negotiating a trade with {other.name} ({other.role}).
Their visible inventory: {other.inventory}
Your inventory: {agent.inventory}

You need {SURVIVAL_NEEDS['food']} food and {SURVIVAL_NEEDS['shelter']} shelter each round to survive.

RULES:
- Only offer what you actually have
- Only request what they actually have
- Think about what's a fair deal given both parties' needs
- You CAN choose not to trade if it's not worth it

Respond with ONLY a JSON object:
{{"offer_good": "food", "offer_amount": 2, "request_good": "shelter", "request_amount": 1, "message": "I'll give you 2 food for 1 shelter", "no_trade": false}}

Set "no_trade": true if you don't want to trade."""

        user = f"Current state:\n{state}\n\nTrade history this round:\n{history_str}\n\nPropose a trade with {other.name}. JSON only."

        response = self._chat(system, user)
        result = self._extract_json(response)

        if self.verbose:
            print(f"  {agent.name} → {other.name}: {result.get('message', 'no message')}")

        if result.get("no_trade", False):
            return None

        offer_good = result.get("offer_good", "")
        offer_amount = int(result.get("offer_amount", 0))
        request_good = result.get("request_good", "")
        request_amount = int(result.get("request_amount", 0))

        if not offer_good or not request_good or offer_amount <= 0 or request_amount <= 0:
            return None

        # Validate agent has what they're offering
        if agent.inventory.get(offer_good, 0) < offer_amount:
            offer_amount = agent.inventory.get(offer_good, 0)
            if offer_amount <= 0:
                return None

        return TradeProposal(
            from_agent=agent_id,
            to_agent=other_agent_id,
            offering={offer_good: offer_amount},
            requesting={request_good: request_amount},
            message=result.get("message", ""),
        )

    # ─── Trade Response ───────────────────────────────────────────────────

    def respond_to_trade(
        self,
        world: World,
        agent_id: str,
        proposal: TradeProposal,
    ) -> bool:
        """Ask the LLM whether to accept a trade."""
        agent = world.get_agent(agent_id)
        proposer = world.get_agent(proposal.from_agent)

        system = f"""You are {agent.name}, a {agent.role} in a small economy.
{agent.description}

{proposer.name} is offering you a trade:
- They give you: {proposal.offering}
- They want: {proposal.requesting}
- Their message: "{proposal.message}"

Your inventory: {agent.inventory}
You need {SURVIVAL_NEEDS['food']} food and {SURVIVAL_NEEDS['shelter']} shelter to survive this round.

Should you accept this trade?

Respond with ONLY: {{"accept": true, "reason": "why"}} or {{"accept": false, "reason": "why"}}"""

        user = f"Accept or reject? JSON only."

        response = self._chat(system, user)
        result = self._extract_json(response)

        accepted = result.get("accept", False)
        reason = result.get("reason", "")

        if self.verbose:
            emoji = "✅" if accepted else "❌"
            print(f"  {agent.name} {emoji} {reason}")

        return accepted
