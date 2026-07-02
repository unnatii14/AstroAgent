# AstroAgent

An agentic AI astrologer for Aradhana — computes real birth charts, reasons over
planetary data with tools, and answers questions conversationally.

**Status: Phase 0 — project skeleton + golden set. No features yet.**

## Structure

```
backend/    LangGraph agent + FastAPI server (Python)
frontend/   React chat UI (added in Phase 3)
evals/      Golden set + eval harness
```

## Setup (backend)

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy ..\.env.example ..\.env  # then put your real ANTHROPIC_API_KEY in .env
```

## Evaluation

The golden set lives at `evals/golden_set.jsonl` — written *before* any feature,
as the contract for agent behavior. See `evals/README.md` for the case format.

Harness + one-command runner arrive in Phase 5.

## Architecture, graph diagram, known limitations

To be written as the build progresses.
