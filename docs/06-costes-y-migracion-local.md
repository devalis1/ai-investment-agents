# Phase 6: Cost minimization and migration to local inference (optional)

Goal: reduce cloud token costs (or avoid them with local inference) without breaking the public interface.

## Options (per your document)

- Cloud (OpenAI/Gemini) with token measurement.
- Local models (Ollama/LM Studio) for inference without API tokens.
- Hybrid: local first; if it fails or exceeds limits/latency -> cloud fallback.

## Checklist

1. Measure tokens per analysis and estimate monthly cost (cloud).
2. Install and test Ollama or LM Studio locally.
3. Implement a local inference adapter using the same JSON contract.
4. Enable fallback with clear criteria.

## Tests

- Compare “apparent” local vs cloud quality on a small ticker set.
- Measure local latency (CPU vs GPU) and ensure reasonable timeouts.

