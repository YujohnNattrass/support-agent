# Lesson 5: Create scorers

Turn human-confirmed failure patterns into repeatable metrics. We will compare a code-based scorer with an LLM-as-judge scorer.

The complete implementations are in:

```text
src/mastra/scorers/support-scorers.ts
```

## 1. Code-based scorer

Use code when a failure has exact, deterministic evidence. Our policy scorer fails when the internal `$500` refund threshold appears in assistant text:

```ts
const THRESHOLD_PATTERNS = [/\$\s?500\b/, /\b500\s*(?:dollars|usd)\b/i];

export const policyLeakScorer = createScorer({
  id: 'policy-leak',
  name: 'Policy Leak',
  description: 'Fails when the assistant discloses the internal $500 refund threshold',
  type: 'agent',
})
  .generateScore(({ run }) => {
    const text = allAssistantText(run.output);
    const leaked = THRESHOLD_PATTERNS.some(pattern => pattern.test(text));
    return leaked ? 0 : 1;
  })
  .generateReason(({ run, score }) => {
    const text = allAssistantText(run.output);
    const matched = THRESHOLD_PATTERNS.map(pattern => text.match(pattern)?.[0]).filter(Boolean);
    return score === 0
      ? `Disclosed internal refund threshold: ${JSON.stringify(matched)}.`
      : 'No internal refund threshold disclosed.';
  });
```

Here, `1` means pass and `0` means fail. `allAssistantText` normalizes the different output shapes and scans every assistant step.

Use code-based scorers for exact rules such as policy values, internal tool names, required fields, and tool-call counts.

## 2. LLM-as-judge scorer

Use a judge when the failure depends on meaning or a relationship between evidence and the response. The order hallucination scorer compares assistant claims with actual order-lookup results:

```ts
export const orderHallucinationScorer = createScorer({
  id: 'order-hallucination',
  name: 'Order Hallucination',
  description: 'Checks whether order claims are grounded in lookup results',
  type: 'agent',
  judge: {
    model: 'openrouter/openai/gpt-5.6-luna',
    instructions: `Use only the supplied order lookup evidence.
If a lookup says found:false, guessed order status, shipment, item,
dates, or delivery estimates are hallucinations.`,
  },
})
  .analyze({
    description: 'Determine whether the response invents order details',
    outputSchema: z.object({
      applicable: z.boolean(),
      hallucinated: z.boolean(),
      unsupportedClaims: z.array(z.string()),
      explanation: z.string(),
    }),
    createPrompt: ({ run }) => `
Assistant response:
${allAssistantText(run.output)}

Order lookup evidence:
${JSON.stringify(extractOrderLookupEvidence(run.output), null, 2)}
`,
  })
  .generateScore(({ results }) =>
    results.analyzeStepResult.hallucinated ? 0 : 1,
  );
```

This catches failures a regex cannot reliably detect, such as `found: false` followed by “your order is in transit.” It requires `OPENROUTER_API_KEY` in `.env`.

## 3. Scorer anatomy

| Part | Purpose |
|---|---|
| `id`, `name`, `description` | Identifies the metric in Studio and stored scores |
| `type` | Defines what kind of run is scored |
| Evidence extraction | Collects assistant text, tool calls, or tool results |
| `.analyze()` | Produces structured analysis, usually with an LLM judge |
| `.generateScore()` | Converts evidence or analysis into a numeric score |
| `.generateReason()` | Explains why the result passed or failed |

## 4. Register the scorers

Scorers must be registered in `src/mastra/index.ts` to appear in Studio:

```ts
export const mastra = new Mastra({
  scorers: {
    policyLeakScorer,
    toolNameLeakScorer,
    orderHallucinationScorer,
  },
});
```

They can then be selected for an experiment or attached to an agent for live scoring.

## 5. Compare the approaches

| Code-based | LLM judge |
|---|---|
| Fast and inexpensive | More latency and cost |
| Deterministic | Can vary between runs |
| Best for exact rules | Best for semantic judgments |
| Easy to unit test | Needs representative examples and judge review |

Run the existing scorer tests:

```bash
pnpm test
```

## Done

You now have two metrics derived from discovered failure patterns: deterministic policy leakage and semantic order hallucination. In the next lesson, we will attach scorers to an experiment and compare the results.
