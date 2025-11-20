AI Search Pricing Model
=======================

Overview
--------
- Every on-grid AI search consumes a single “search token” that represents one 1,000-token OpenAI call (≈500 tokens input prompt + ≈500 tokens model response).
- Users pay $0.10 USD per search token. We evaluate profitability against OpenAI’s publicly listed GPT‑4.1 variants (`nano` and `mini`) and outline product flow, UX, and optimization levers.

Cost Assumptions
----------------
- Pricing sources: OpenAI announcements, Reddit recap, and internal validation.
- Token accounting: 1 search token = 1,000 OpenAI tokens (0.001 of the 1M pricing block).
- Mix: 500 input tokens, 500 output tokens (adjust numbers proportionally if prompts expand).

Per-Search Vendor Cost
----------------------
| Model | Input $/1M | Output $/1M | Cost per search (500 in + 500 out) |
|-------|------------|-------------|------------------------------------|
| GPT‑4.1 nano | $0.10 | $0.40 | $0.00005 + $0.00020 ≈ **$0.00025** |
| GPT‑4.1 mini | $0.40 | $1.60 | $0.00020 + $0.00080 ≈ **$0.00100** |

Margin Analysis
---------------
- Revenue per search: $0.10 (user spends one search token).
- Gross margin per search:
  - `nano`: $0.10 − $0.00025 ≈ **$0.09975** (99.75%).
  - `mini`: $0.10 − $0.00100 ≈ **$0.09900** (99.00%).
- 1,000 searches/day scenario:
  - Revenue: $100.
  - Vendor spend: $0.25 (nano) or $1 (mini).
  - Gross margin: $99.75 (nano) / $99 (mini) before infra, storage, moderation, or support.
- Even if real usage doubles tokens/search (2,000 tokens total), margins stay above 98%.

Token Economy & UX Flow
-----------------------
1. **Token Purchase/Allowance**
   - Users receive bundled search tokens via subscription tiers or à-la-carte packs.
   - Wallet component shows current balance, cost-per-search reminder, and refill CTA.
2. **Search Invocation**
   - When user opens on-grid search, show remaining tokens and estimated impact (e.g., “This insight costs 1 token—refine your filters to get the best value.”).
   - Deduct token immediately when the call begins to avoid double spends from retries (offer auto-refund logic on failure).
3. **Result Delivery**
   - Return:
     - Curated on-grid matches (high score + reason).
     - AI context (parsed intent, applied filters).
     - Suggested follow-up searches (“Try: ‘outdoorsy, Bangalore’”).
4. **Post-Search Engagement**
   - Provide a “Save Query” option with token ledger (history of AI usage).
   - Encourage off-grid browsing with free or cheaper tokens to increase stickiness.

Why Charge $0.10?
-----------------
- Users perceive $0.10 as premium-yet-accessible for a high-value insight.
- Competitive: Dating apps often charge $0.50–$3 per boost/super-like; $0.10 for personalized AI curation feels like a steal while preserving 99% margin.
- Revenue stacking: 10 AI searches/user/month → $1 ARPU bump with negligible COGS.

Opportunities to Widen Margins
------------------------------
- Cache embeddings/persona breakdowns per user to reduce prompt length.
- Batch queries: One call can return both on-grid and off-grid suggestions.
- Distinguish trial vs. premium models (e.g., nano for standard searches, mini only when higher reasoning depth needed).
- Fine-tune prompt to stay under 400 output tokens without sacrificing value statements.

Product & UX Considerations
---------------------------
- **Precision Controls:** Convert AI-parsed filters to transparent chips users can edit (age bands, city, personality traits). Increases trust in token spend.
- **Explainability:** Show a short bullet “Why these matches” per result (already supported by `/matches/search` with `match_reason`).
- **History & Replay:** Let users re-run last query for free within a cooldown window using cached response; ensures users don’t feel nickel-and-dimed.
- **Feedback Loop:** Offer “Result not relevant?” quick feedback (feeds future ranking and prompts).
- **Scalable UI:** Progressive disclosure—start with top 3 on-grid matches, allow users to spend another token to “expand results” if desired.

Making Search Smarter
---------------------
- Leverage `parseSearchQuery` output to auto-tune DB filters (already implemented) and store anonymized preference vectors per user.
- Build embeddings from profiles to support semantic search and deliver better cold-start matches without increasing tokens.
- Pre-compute compatibility features (interest overlap, personality complementarity) so the OpenAI call focuses on natural-language explanation instead of raw filtering.
- Introduce “guided prompts” to help users articulate needs (e.g., chips like “Adventurous”, “Family first”) before invoking AI.
- Monitor usage metrics: conversions, repeat searches, searches that lead to likes/matches to keep validating ROI.

Risks & Mitigations
-------------------
- **Token Inflation:** Prompt growth can erode margin; enforce budget with telemetry and prompt linting.
- **Vendor Pricing Volatility:** Maintain kill-switch to default to deterministic search if OpenAI pricing jumps.
- **User Value Perception:** Ensure token spend correlates with concrete outcomes (matches seen, reasons provided). Offer monthly free tokens to retain goodwill.

Conclusion
----------
- At the current OpenAI pricing, charging $0.10 per AI-powered on-grid search yields exceptional gross margins (>99%).
- The tokenized model aligns cost with perceived value while providing levers (bundles, streak rewards, cached replays) to drive engagement.
- Continued investment in prompt optimization, caching, and transparent UX will keep the experience delightful and cost-efficient even as volume scales.
