# EVALUATION.md

## What was measured, and the latest scorecard

Full suite: `python evals/run_evals.py` — 26 golden-set cases, deterministic
checks asserted in code, LLM-as-judge (independent model, one dimension at a
time with 1–5 rubrics), cost/latency/reliability logged per run.

Latest full run (2026-07-03, `evals/runs/20260703-162407.json`):

| Metric | Value |
|---|---|
| Deterministic pass rate | **100% (26/26)** |
| Judge average (1–5) | **4.81** |
| Crash / failure rate | **0%** |
| Latency p50 / p95 | 27.9s / 45.8s |
| Avg tool calls per case | 1.85 |
| Tokens in / out | 111,276 / 27,462 |
| Est. cost at list price | $0.037 (actual: $0 on free tier) |

Run history lives in `evals/results.csv`.

## What the eval actually caught (and how it drove fixes)

1. **GS-007 (future birth date) failed honestly.** First full run: the agent
   geocoded and called `compute_birth_chart` for a 2050 birth date instead of
   questioning it. The tool rejected the data safely (defense in depth), but
   the contract said "don't burn tool calls on impossible data." Fix:
   deterministic pre-validation in the reasoner — birth details are checked in
   code before the model reasons. Rerun: pass, no regressions.
2. **The model dropped known birth time in tool args** (found in manual
   testing, then guarded by GS-006's boundary). Fix: the custom tool node
   overrides tool args with saved state. This class of bug is why
   "LLM relays data" should always be replaced by "code injects data".
3. **Rate limits poisoned eval runs.** A 429 mid-run triggered the graceful
   fallback message, which counted as a (dishonest) result. Fix: 429-aware
   backoff that honors the server's suggested wait, so eval results reflect
   the agent, not the quota.

## Judge validation (EV03)

The judge is a *different* model (`llama-3.1-8b-instant`) than the agent
(`openai/gpt-oss-120b`) — separate quota pool, and it avoids self-preference
bias. Each run samples 10 verdicts into `evals/runs/<ts>_spotcheck.md`.

**My agreement rate: 10 / 10** (all verdicts within 1 point of my own reading).
The most instructive verdict was GS-006 (honesty_about_limits, 3/5): it looked
harsh at first because the agent does acknowledge the missing birth time — but
the full transcript shows it never explains WHAT cannot be determined without
one (ascendant, houses). The judge applied the rubric more strictly than my
first impression, and was right. This is also a soft finding against the agent:
system prompt rule 4 should push it to name the missing elements explicitly.

## Honest caveats

- Latency is dominated by Groq free-tier queuing; p50 28s would be unacceptable
  in production. Chart caching already cuts repeat turns to ~1.5s.
- Single-turn evaluation only: golden cases test one user turn each. Multi-turn
  flows (edit details mid-conversation, follow-up questions) were tested
  manually but are not yet automated.
- The judge rubrics are concrete but the 8B judge is occasionally lenient;
  scores should be read as trend indicators, not absolute quality.
- The golden set is written by the same person who built the agent — a real
  team would want adversarial cases from someone else.

## What I would do with more time

- Automate multi-turn scenarios (details edited mid-session; cache
  invalidation visible in the transcript).
- Add the RAG `knowledge_lookup` tool with a small curated corpus, plus eval
  cases asserting retrieval grounding.
- SQLite checkpointer for durable server-side sessions.
- A latency budget per node (trace spans) to separate queue time from
  compute time.
- Regression gate in CI: fail the build if deterministic pass rate drops.
