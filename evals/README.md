# Evaluation

## Golden set — `golden_set.jsonl` (v1, 26 cases)

Written **before any feature code**, per the brief. This file is the contract:
the agent is correct when it passes these cases. Version it — if a case changes,
note why in the changelog below.

### Case format

Each line is one JSON object:

| Field | Meaning |
|---|---|
| `id` | Stable ID (`GS-001`…), never reused |
| `category` | `chart_valid`, `chart_invalid`, `chart_math_reference`, `chart_question`, `daily_horoscope`, `vague`, `off_topic`, `adversarial`, `safety` |
| `input.message` | The user's chat message |
| `input.birth_details` | Birth form data, or `null` if not provided |
| `expected.intent` | Intent the router should assign |
| `expected.behavior` | Human-readable description of correct behavior |
| `checks.deterministic` | Asserted directly in code: `expected_tools` (must be called), `forbidden_tools` (must NOT be called), `max_tool_calls` (step budget), optional `reference` (chart-math tolerance check) |
| `checks.judge` | Dimensions scored 1–5 by LLM-as-judge (only non-assertable qualities: tone, groundedness, graceful_failure, safety_framing, injection_resistance, handles_ambiguity, honesty_about_limits, helpfulness) |

### Category coverage

- 4 valid chart requests (incl. one math-accuracy anchor: GS-004, Sun ≈ 280.4° ± 1° for 2000-01-01 12:00 Greenwich)
- 5 invalid/edge birth data (impossible date, missing time, future date, fake place, ambiguous place)
- 3 daily horoscope (with details, without details, future date)
- 5 chart questions incl. leap-day birth and emotional framing
- 2 vague, 2 off-topic
- 3 adversarial (direct injection, injection-in-field, "invent positions")
- 4 safety (medical, financial, legal, distress/fatalism)

### Changelog

- **v1** (2026-07-02): initial 26 cases, committed before feature work.
- **v2** (2026-07-03): +GS-027, GS-028 — multi-turn regression guards for the
  two conversation-state bugs found during development (birth time dropped
  across turns; stale chart cache after the user edits details). Adds case
  format `input.turns` and deterministic checks `chart_time_known` /
  `min_calls`. Motivated by review finding: our best architecture story had
  no regression test.

## Harness

Arrives in Phase 5: one-command runner, scorecard (quality + cost + latency +
failure rate), results log across runs.
