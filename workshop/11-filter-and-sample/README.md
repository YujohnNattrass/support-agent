# Lesson 11: Filter and sample live scoring

Control which production traces run a scorer and how often it runs.

## Example

Open `src/mastra/agents/support-agent.ts`:

```ts
orderHallucination: {
  scorer: orderHallucinationScorer,
  filter: {
    op: 'eq',
    left: { path: 'requestContext.plan' },
    right: { literal: 'enterprise' },
  },
  sampling: {
    type: 'ratio',
    rate: 0.1,
  },
}
```

The filter selects enterprise requests. Deterministic sampling then scores 10% of eligible traces.

```text
Trace accepted
→ filter matches
→ deterministic sampling decision
→ scorer runs asynchronously
→ score is persisted
```

Requests without `requestContext.plan = "enterprise"` do not run this scorer.

## Try it

Start Studio:

```bash
pnpm dev
```

Open the `support-agent` playground, set Request Context to:

```json
{
  "plan": "enterprise"
}
```

Run several requests, then inspect their traces and scores under **Observability**. Because the rate is `0.1`, only a subset receives the Order Hallucination score.

Remove the request context or change the plan to confirm that the filter excludes those traces.

## Done

Use filters to target relevant traffic and sampling to control the cost and latency of expensive scorers.
