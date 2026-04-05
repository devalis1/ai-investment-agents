# Phase 3: AI logic with *structured output*

Goal: generate `recommendation` and `reasoning` using structured inputs (JSON) and ensure the output is valid JSON.

## Input contract (inputs)

The backend will send something like:

- `ticker`
- `price_current`
- `rsi`
- `headlines` — **3–5** short lines from Yahoo Finance search news (`apps/backend/src/fetcher/headlines.ts`), title plus publisher when available. Empty when the provider fails (cycle still runs; reasoning uses price + RSI only).
- portfolio context (shares/avg_price if applicable)

**Analyst JSON output** remains only `recommendation` + `reasoning` (no schema change for headlines in v1).

## Output contract (outputs)

Expected output (JSON):

- `recommendation` (suggested enum: `Hold` / `Buy` / `Sell`)
- `reasoning` (string)

## Implementation checklist

1. In the backend, request valid JSON output (Structured Outputs if using cloud).
2. Validate JSON with a schema (e.g. zod / JSON schema).
3. If it fails:
   - retry with a stricter prompt
   - or fallback to another model (if applicable)
4. Persist the result in `ai_insights` with a reference to `asset_id`.

## Notes on local models (Ollama / Qwen "thinking")

- Some local models can produce empty output when "thinking" is enabled and the visible output token budget is exhausted.
- For Qwen thinking models in Ollama, set `think: false` as a top-level request parameter (handled in code) to avoid empty responses.
- Keep outputs short and deterministic when possible (`temperature: 0`) to reduce recommendation drift across runs.

## Decision policy (RSI → recommendation)

To reduce recommendation drift across reruns, the backend enforces a deterministic policy mapping RSI directly to the `recommendation` field:

- If `rsi < 30` → `Buy`
- If `30 <= rsi <= 70` → `Hold`
- If `rsi > 70` → `Sell`

**Rationale**: without an explicit policy, the model may “rationalize” different actions (e.g. `Hold` vs `Buy`) for the same inputs due to sampling variability and ambiguous instructions. We still allow headlines/news to shape the **`reasoning`**, but the **`recommendation` must strictly follow RSI** so repeated runs are stable and easy to test.

## Tests

- High RSI cases (e.g. RSI > 70 suggests sell) and verify the model does not return values outside the enum.
- Empty news cases (ensure the reasoning remains coherent).

## Quick stability test procedure

Run the cycle twice with the same tickers and compare the printed recommendations:

```bash
TICKERS=AAPL,MSFT,NVDA npm run dev:cycle
TICKERS=AAPL,MSFT,NVDA npm run dev:cycle
```

Expected: For any ticker where RSI is unchanged between runs, `recommendation` should be identical (drift should be significantly reduced).

