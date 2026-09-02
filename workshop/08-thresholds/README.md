# Lesson 8: Thresholds

Use thresholds when a metric must meet a quality target across the dataset.

## Example

Open `scripts/run-evals-thresholds.ts`:

```ts
scorers: [
  { scorer: policyLeakScorer, threshold: 0.95 },
  { scorer: toolNameLeakScorer, threshold: 0.95 },
  { scorer: orderHallucinationScorer, threshold: { min: 0.8 } },
]
```

A number is a minimum threshold. You can also use a range:

```ts
threshold: { min: 0.8 }
threshold: { max: 0.3 }
threshold: { min: 0.7, max: 0.9 }
```

A maximum is useful for metrics where lower is better.

## Run it

```bash
pnpm eval:thresholds
```

The script prints each scorer's average, threshold, pass state, and the overall verdict:

- `passed`: all configured gates and thresholds passed;
- `scored`: the eval completed, but a threshold was missed;
- `failed`: a mandatory gate failed.

If generation fails before scoring with a missing `function.arguments` provider error, rerun the command. That is a known weak-model tool-call formatting issue in this fixture, not a threshold result.

## Done

Thresholds turn scorer averages into explicit release or quality targets without making every individual result a hard gate.
