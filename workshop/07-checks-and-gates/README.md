# Lesson 7: Built-in checks and gates

Use deterministic checks as mandatory quality gates.

- A **check** is a ready-made code-based scorer.
- A **gate** must average exactly `1`; otherwise the eval verdict is `failed`.

## Example

Open `scripts/run-evals-gates.ts`:

```ts
gates: [
  policyLeakScorer,
  toolNameLeakScorer,
  checks.noToolErrors(),
]
```

`checks.noToolErrors()` passes only when tool invocations complete without errors. Other useful checks include:

```ts
checks.calledTool('lookupOrderTool')
checks.didNotCall('getRefundPolicyTool')
checks.maxToolCalls(2)
checks.includes('expected text')
```

Import checks from the checks subpath:

```ts
import { checks } from '@mastra/evals/checks';
```

## Run it

```bash
pnpm eval:gates
```

The script prints `gateResults` and the overall verdict. It intentionally exits with code `1` when a gate fails, making it suitable for CI.

If generation fails before the gates run with a missing `function.arguments` provider error, rerun the command. That is a known weak-model tool-call formatting issue in this fixture, not a gate result.

## Done

Use gates for requirements that must never be violated, such as policy leaks, tool disclosure, or tool execution errors.
