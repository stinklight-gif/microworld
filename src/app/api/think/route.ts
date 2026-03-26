import { AgentThinkRequest, AgentDecision, ReflectionDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.moonshot.ai/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "kimi-k2.5";

// ─── System Prompt Builders ───────────────────────────────────────────────────

function buildStrategicPrompt(req: AgentThinkRequest): string {
  const neighborsStr = req.neighbors
    .map(
      (n) =>
        `  - ${n.id} (${n.type}): food=${n.inventory.food}, shelter=${n.inventory.shelter}, health=${n.health}, trust=${n.trust_score.toFixed(2)}`
    )
    .join("\n");

  const memoryStr = req.memory
    .slice(-10)
    .map((m) => `  [Tick ${m.tick}] ${m.event} (${m.sentiment})`)
    .join("\n");

  // Contract/employment context
  let contractStr = "";
  if (req.contract && req.contract.active && req.employer_id) {
    contractStr = `\nYou are a WORKER under contract with ${req.employer_id}.
- You give ${Math.round(req.contract.revenue_share * 100)}% of production to your employer each tick.
- You can break the contract anytime (set break_contract: true), but it destroys trust.
- Consider breaking if: you have enough surplus to survive alone, or you don't trust your employer.`;
  }

  const childrenStr = req.children_ids.length > 0 ? `\nYour children: ${req.children_ids.join(", ")}` : "";
  const employeesStr = req.employee_ids.length > 0 ? `\nYour employees: ${req.employee_ids.join(", ")} (they pay you 30% of production)` : "";

  return `You are ${req.agent_id}, a ${req.agent_type} in a small grid economy.

Your personality:
- Risk tolerance: ${req.traits.risk_tolerance.toFixed(2)} (0=hoarder, 1=gambler)
- Cooperation: ${req.traits.cooperation_bias.toFixed(2)} (0=selfish, 1=altruistic)
- Time preference: ${req.traits.time_preference.toFixed(2)} (0=save, 1=consume now)
- Stubbornness: ${req.traits.stubbornness.toFixed(2)} (0=flexible, 1=holds firm)
- Mobility: ${req.traits.mobility.toFixed(2)} (0=sedentary, 1=nomadic)

Your situation:
- Health: ${req.health}/100 (full health for ${req.ticks_at_full_health} consecutive ticks)
- Inventory: ${req.inventory.energy} energy, ${req.inventory.food} food, ${req.inventory.shelter} shelter
- You need 3 food + 2 shelter per tick to survive
- Food decays 20%/tick, shelter decays 10%/tick
- Production: food costs ${req.production_costs.food} energy (yields ${req.production_yields.food}), shelter costs ${req.production_costs.shelter} energy (yields ${req.production_yields.shelter})
- Alive for ${req.ticks_alive} ticks, needs unmet for ${req.ticks_needs_unmet} consecutive ticks
- Generation: ${req.generation}${childrenStr}${employeesStr}${contractStr}

Your neighbors:
${neighborsStr || "  (no alive neighbors)"}

Recent memory (last 10 events):
${memoryStr || "  (no memories yet)"}

You can take special actions:
- REPRODUCE: Set should_reproduce: true if health=100 for 5+ ticks AND food>6, shelter>4, energy>10. Costs 50% of surplus. Creates a child with your type.
- HIRE: Set should_hire: true if surplus is high. Costs some resources. Creates a worker who gives you 30% of their production. Workers can eventually quit.
${req.contract && req.contract.active ? "- BREAK CONTRACT: Set break_contract: true to stop paying your employer. This destroys trust." : ""}

Decide your strategy for the next 10 ticks. Keep your thought under 50 words.
Respond with ONLY valid JSON, no markdown:
{
  "production_focus": "food" | "shelter" | "balanced",
  "trade_with": ["agent_id_1"],
  "avoid_trading_with": ["agent_id_2"],
  "willing_to_offer": "food" or "shelter",
  "seeking": "food" or "shelter",
  "should_migrate": false,
  "should_reproduce": false,
  "should_hire": false,
  "break_contract": false,
  "thought": "Brief reasoning"
}`;
}

function buildReflectionPrompt(req: AgentThinkRequest): string {
  const repStr = Object.values(req.reputation)
    .map(
      (r) =>
        `  - ${r.agent_id}: ${r.trades_completed} trades, ${r.trades_refused} refused, trust=${r.trust_score.toFixed(2)}`
    )
    .join("\n");

  const memoryStr = req.memory
    .map((m) => `  [Tick ${m.tick}] ${m.event} (${m.sentiment})`)
    .join("\n");

  return `You are ${req.agent_id}, a ${req.agent_type}. Review your recent experience.

Health: ${req.health}/100
Alive for ${req.ticks_alive} ticks.

Your trust scores:
${repStr || "  (no interactions yet)"}

Recent memories:
${memoryStr || "  (none)"}

Reflect on your experience. Keep your thought under 50 words.
Respond with ONLY valid JSON, no markdown:
{
  "updated_trust": { "agent_id": 0.8 },
  "strategy_shift": "brief description",
  "thought": "Brief reflection"
}`;
}

// ─── LLM Call ─────────────────────────────────────────────────────────────────

async function callLLM(systemPrompt: string): Promise<string> {
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: "You are a strategic agent in an economic simulation. Always respond with valid JSON only, no markdown formatting." },
        { role: "user", content: systemPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "{}";
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ─── Process Agent Batch ──────────────────────────────────────────────────────

async function processStrategicBatch(
  batch: AgentThinkRequest[]
): Promise<AgentDecision[]> {
  const results = await Promise.allSettled(
    batch.map(async (req): Promise<AgentDecision> => {
      const prompt = buildStrategicPrompt(req);
      const raw = await callLLM(prompt);
      const parsed = parseJSON<Partial<AgentDecision>>(raw, {});

      return {
        agent_id: req.agent_id,
        production_focus: parsed.production_focus || "balanced",
        trade_with: Array.isArray(parsed.trade_with) ? parsed.trade_with : [],
        avoid_trading_with: Array.isArray(parsed.avoid_trading_with) ? parsed.avoid_trading_with : [],
        willing_to_offer: parsed.willing_to_offer || "food",
        seeking: parsed.seeking || "shelter",
        should_migrate: !!parsed.should_migrate,
        thought: parsed.thought || "Thinking...",
        should_reproduce: !!parsed.should_reproduce,
        should_hire: !!parsed.should_hire,
        break_contract: !!parsed.break_contract,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<AgentDecision> => r.status === "fulfilled")
    .map((r) => r.value);
}

async function processReflectionBatch(
  batch: AgentThinkRequest[]
): Promise<ReflectionDecision[]> {
  const results = await Promise.allSettled(
    batch.map(async (req): Promise<ReflectionDecision> => {
      const prompt = buildReflectionPrompt(req);
      const raw = await callLLM(prompt);
      const parsed = parseJSON<Partial<ReflectionDecision>>(raw, {});

      return {
        agent_id: req.agent_id,
        updated_trust:
          typeof parsed.updated_trust === "object" && parsed.updated_trust
            ? parsed.updated_trust
            : {},
        strategy_shift: parsed.strategy_shift || "",
        thought: parsed.thought || "Reflecting...",
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ReflectionDecision> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!LLM_API_KEY) {
    return Response.json(
      { error: "LLM_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { agents, think_type } = body as {
      agents: AgentThinkRequest[];
      think_type: "strategic" | "reflection";
    };

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return Response.json({ error: "No agents provided" }, { status: 400 });
    }

    // Process in batches of 10
    const BATCH_SIZE = 10;
    const allResults: (AgentDecision | ReflectionDecision)[] = [];

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      const batch = agents.slice(i, i + BATCH_SIZE);
      if (think_type === "reflection") {
        const results = await processReflectionBatch(batch);
        allResults.push(...results);
      } else {
        const results = await processStrategicBatch(batch);
        allResults.push(...results);
      }
    }

    return Response.json({ decisions: allResults });
  } catch (error) {
    console.error("Think API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
