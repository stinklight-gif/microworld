#!/usr/bin/env python3
"""
Microworld — Run the simulation.

Usage:
    python run.py              # Run with settings from .env
    python run.py --rounds 20  # Override round count
    python run.py --verbose    # Extra logging
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from itertools import combinations

from dotenv import load_dotenv
from openai import OpenAI

from world import World
from brain import AgentBrain


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Run a Microworld simulation")
    parser.add_argument("--rounds", type=int, default=None, help="Number of rounds")
    parser.add_argument("--trade-rounds", type=int, default=None, help="Trade sub-rounds per turn")
    parser.add_argument("--verbose", action="store_true", default=None, help="Verbose output")
    args = parser.parse_args()

    # Configuration (CLI > .env > defaults)
    base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    api_key = os.getenv("LLM_API_KEY", "ollama")
    model = os.getenv("LLM_MODEL", "llama3.2")
    rounds = args.rounds or int(os.getenv("ROUNDS", "50"))
    trade_rounds = args.trade_rounds or int(os.getenv("TRADE_ROUNDS_PER_TURN", "3"))
    log_dir = os.getenv("LOG_DIR", "./logs")
    verbose = args.verbose if args.verbose is not None else os.getenv("VERBOSE", "true").lower() == "true"

    # Setup
    client = OpenAI(base_url=base_url, api_key=api_key)
    brain = AgentBrain(client=client, model=model, verbose=verbose)
    world = World()

    # Verify LLM connection
    print(f"🌍 Microworld — Economic Simulation")
    print(f"   Model: {model} @ {base_url}")
    print(f"   Rounds: {rounds} | Trade sub-rounds: {trade_rounds}")
    print(f"   Agents: {', '.join(a.name for a in world.agents.values())}")
    print()

    try:
        test = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say 'ok' in one word."}],
            max_tokens=5,
        )
        print(f"✅ LLM connected: {test.choices[0].message.content.strip()}")
    except Exception as e:
        print(f"❌ LLM connection failed: {e}")
        print(f"   Check LLM_BASE_URL and LLM_MODEL in .env")
        sys.exit(1)

    print()

    # Create log directory
    run_id = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    run_dir = Path(log_dir) / f"run-{run_id}"
    run_dir.mkdir(parents=True, exist_ok=True)

    summary_lines = [
        f"# Microworld Run — {run_id}",
        f"Model: {model}",
        f"Rounds: {rounds} | Trade rounds: {trade_rounds}",
        "",
    ]

    # ─── Main Loop ────────────────────────────────────────────────────────

    for round_num in range(1, rounds + 1):
        world.current_round = round_num
        print(f"\n{'━'*60}")
        print(f"  ROUND {round_num}/{rounds}")
        print(f"{'━'*60}")
        summary_lines.append(f"\n## Round {round_num}")

        # Check if simulation should end
        alive = world.alive_agents()
        if len(alive) <= 1:
            msg = "Only 1 agent left — simulation ends."
            print(f"\n⚠️  {msg}")
            summary_lines.append(f"\n⚠️ {msg}")
            break

        # ── Phase 1: Production ───────────────────────────────────────────
        print("\n📦 PRODUCTION")
        summary_lines.append("\n### Production")
        production_plans = {}
        for agent_id in world.agents:
            agent = world.get_agent(agent_id)
            if not agent.alive:
                continue
            plan = brain.decide_production(world, agent_id)
            production_plans[agent_id] = plan
            summary_lines.append(f"- {agent.name}: produce {plan}")

        world.phase_production(production_plans)

        # Show inventories after production
        for agent in alive:
            print(f"  {agent.name}: {agent.inventory}")

        # ── Phase 2: Trade ────────────────────────────────────────────────
        print("\n🤝 TRADING")
        summary_lines.append("\n### Trading")
        agent_ids = [a.id for a in alive]

        for sub_round in range(1, trade_rounds + 1):
            if verbose:
                print(f"\n  ─ Trade sub-round {sub_round}/{trade_rounds} ─")

            # Every pair gets a chance to trade
            for a_id, b_id in combinations(agent_ids, 2):
                conversation = []

                # A proposes to B
                proposal = brain.propose_trade(world, a_id, b_id, conversation)
                if proposal:
                    conversation.append(f"{world.get_agent(a_id).name}: {proposal.describe()} - {proposal.message}")

                    # B decides
                    accepted = brain.respond_to_trade(world, b_id, proposal)
                    if accepted:
                        success = world.execute_trade(proposal)
                        status = "✅ executed" if success else "❌ failed (insufficient)"
                        conversation.append(f"{world.get_agent(b_id).name}: accepted → {status}")
                        summary_lines.append(f"- {world.get_agent(a_id).name} → {world.get_agent(b_id).name}: {proposal.describe()} → {status}")
                    else:
                        conversation.append(f"{world.get_agent(b_id).name}: rejected")
                        summary_lines.append(f"- {world.get_agent(a_id).name} → {world.get_agent(b_id).name}: {proposal.describe()} → rejected")

        # ── Phase 3: Consumption ──────────────────────────────────────────
        print("\n🍽️  CONSUMPTION")
        summary_lines.append("\n### Consumption")
        world.phase_consumption()

        for agent in world.agents.values():
            if agent.alive:
                status = f"❤️ {agent.health}HP"
            else:
                status = "💀 DEAD"
            print(f"  {agent.name}: {status} — {agent.inventory}")
            summary_lines.append(f"- {agent.name}: {status} — {agent.inventory}")

        # ── Phase 4: Decay ────────────────────────────────────────────────
        world.phase_decay()

        # Round summary
        print(world.get_round_summary())

    # ─── Final Stats ──────────────────────────────────────────────────────

    print(f"\n{'='*60}")
    print("  SIMULATION COMPLETE")
    print(f"{'='*60}\n")

    stats = world.get_final_stats()

    print(f"Rounds completed: {stats['total_rounds']}")
    print(f"Trades executed: {stats['total_trades']}")
    print(f"Failed trades: {stats['total_failed_trades']}")
    print(f"Deaths: {stats['deaths']}")
    print(f"Gini coefficient: {stats['gini_coefficient']}")
    print()

    for agent_id, agent_stats in stats["agents"].items():
        print(f"{agent_stats['name']}:")
        print(f"  Alive: {agent_stats['alive']} | Health: {agent_stats['health']}")
        print(f"  Net worth: {agent_stats['net_worth']:.0f}")
        print(f"  Rounds survived: {agent_stats['rounds_survived']}")
        print(f"  Produced: {agent_stats['total_produced']}")
        print(f"  Traded away: {agent_stats['total_traded_away']}")
        print(f"  Traded in: {agent_stats['total_traded_in']}")
        print()

    # ─── Save Logs ────────────────────────────────────────────────────────

    # Ledger
    with open(run_dir / "ledger.jsonl", "w") as f:
        for entry in world.export_ledger():
            f.write(json.dumps(entry) + "\n")

    # Summary
    with open(run_dir / "summary.md", "w") as f:
        f.write("\n".join(summary_lines))

    # Stats
    with open(run_dir / "stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\n📁 Logs saved to: {run_dir}/")
    print(f"   ledger.jsonl — {len(world.ledger)} entries")
    print(f"   summary.md — round-by-round narrative")
    print(f"   stats.json — final statistics")


if __name__ == "__main__":
    main()
