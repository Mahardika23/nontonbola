# Fun facts: LLM-generated, grounded in a validated stat sheet

## Context

"Fun facts" are not a field in any data source — they must be synthesized. Two failure modes
bound the design: too rigid (deterministic templates read robotic) or too loose (an LLM left to
free-associate fabricates facts, which is unacceptable on a public-facing page). We want the
LLM's wit but a hard guarantee of truth.

## Decision

Generate fun facts with a constrained LLM (Claude Haiku — cheap, fast), at refresh time, and
**ground + validate** every output:

1. **Ground**: the model receives ONLY a structured stat sheet of verified cached numbers
   (from SQLite). No free web text, no raw HTML — only numbers we already trust.
2. **Cite**: each generated fact must reference the specific stat key it derives from.
3. **Validate**: a programmatic step checks every number the model emits against the source
   stat sheet. Any fact whose numbers don't match is dropped or regenerated.
4. **Store**: surviving facts are written to SQLite. Reads are instant; the LLM is never on the
   request path.

Chosen over pure rule-based templates (the owner wanted more creative angle-finding than
templates give) and over trusting the LLM without validation (unacceptable hallucination risk
for content presented as fact).

## Consequences

- Adds an LLM API dependency and a small per-refresh cost (bounded: a handful of teams per
  refresh, not per request).
- Requires the validation layer to be built and trusted — it is the safety mechanism, not
  optional. If validation can't confirm a fact, the fact does not ship.
- The stat sheet is the contract between the data layer and the fact generator; it must expose
  every number a fact could cite, keyed for validation.
