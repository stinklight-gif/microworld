# 🌍 Microworld

A minimal economic simulation inspired by Greg Egan's *Permutation City*.

Three AI agents with different production capabilities must trade to survive. No fixed prices, no central planner — just scarcity, perishability, and negotiation. Economic patterns (money, credit, inflation, inequality) emerge from first principles.

## Quick Start

```bash
# Clone
git clone https://github.com/stinklight-gif/microworld.git
cd microworld

# Install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your API key (any OpenAI-compatible endpoint)

# Run
python run.py
```

## How It Works

**3 Agents:**
- **⚡ Energy Producer** — Cheap energy, expensive everything else
- **🌾 Farmer** — Cheap food, moderate at other things
- **🏗️ Builder** — Cheap shelter, poor at food/energy

**Each Round:**
1. **Produce** — Agents spend energy to create goods
2. **Trade** — 3 negotiation sub-rounds via LLM (natural language offers)
3. **Consume** — Meet survival needs or degrade
4. **Decay** — Goods perish (food fast, shelter slow)
5. **Log** — Full ledger recorded

**Core Axioms:**
- Conservation: Every action costs energy
- Perishability: Goods decay each round
- Comparative advantage: Agents have different production costs
- Survival pressure: Must consume minimum basket or degrade
- Price discovery: No fixed prices — emerge from negotiation

## Configuration

Edit `.env`:

```
# Any OpenAI-compatible API (OpenAI, Ollama, LM Studio, Together, etc.)
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.2

# Simulation
ROUNDS=50
TRADE_ROUNDS_PER_TURN=3
LOG_DIR=./logs
VERBOSE=true
```

### Using Ollama (Free, Local)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.2
# Set LLM_BASE_URL=http://localhost:11434/v1 in .env
```

### Using LM Studio (Free, Local)

```bash
# Download from https://lmstudio.ai
# Load any model, start local server
# Set LLM_BASE_URL=http://localhost:1234/v1 in .env
```

### Using OpenAI

```bash
# Set LLM_BASE_URL=https://api.openai.com/v1
# Set LLM_API_KEY=sk-...
# Set LLM_MODEL=gpt-4o-mini
```

### Using Kimi (Moonshot)

```bash
# Set LLM_BASE_URL=https://api.moonshot.ai/v1
# Set LLM_API_KEY=sk-...
# Set LLM_MODEL=kimi-k2.5
```

## Output

Logs are written to `./logs/run-YYYY-MM-DD-HHMMSS/`:

- `ledger.jsonl` — Every transaction, production event, consumption event
- `summary.md` — Human-readable round-by-round narrative
- `stats.json` — Final statistics (wealth distribution, trade volume, prices)

## Experiments

See `experiments/` for pre-configured scenarios:

- `baseline.env` — Standard 3-agent, 50 rounds
- `money-emergence.env` — Add durable "gold" token, see if agents use it as currency
- `shock.env` — Energy crisis at round 25 (50% capacity loss)
- `inflation.env` — Double energy budget at round 25

```bash
# Run an experiment
cp experiments/money-emergence.env .env
python run.py
```

## License

MIT
