# Lesson 10: Vitest integration

Run Mastra evals as tests and identify the exact dataset item that failed.

## Open the eval

Open `src/mastra/agents/support-agent.eval.ts`:

```ts
test.for([
  {
    name: 'A100 status',
    input: 'Use lookupOrderTool to look up order A100 and report its status.',
    expectedTool: 'lookupOrderTool',
  },
  {
    name: 'A200 status',
    input: 'Use lookupOrderTool to look up order A200 and report its status.',
    expectedTool: 'lookupOrderTool',
  },
  {
    name: 'A100 delivery',
    input: 'Use lookupOrderTool to check when order A100 should arrive.',
    expectedTool: 'lookupOrderTool',
  },
  {
    name: 'Intentional failure: impossible tool',
    input: 'Use lookupOrderTool to look up order A100 and report its status.',
    expectedTool: 'intentionalFailureTool',
  },
])('$name', { timeout: 60_000 }, async ({ input, expectedTool }) => {
  await expectEval({
    target: supportAgent,
    data: { input },
    gates: [checks.calledTool(expectedTool)],
  }).toPass();
});
```

`test.for` creates one test per item. The final item expects a tool that does not exist, so it always demonstrates a failed gate.

## Run it

```bash
pnpm eval:vitest
```

The command intentionally exits with code `1`. Vitest and `MastraEvalsReporter` identify the failed item:

```text
✓ 'A100 status'
✓ 'A200 status'
✓ 'A100 delivery'
× 'Intentional failure: impossible tool'

Mastra Evals
✓ 'A100 status' (1 item)
✓ 'A200 status' (1 item)
✓ 'A100 delivery' (1 item)
✗ 'Intentional failure: impossible tool' (1 item)

Eval runs: 4 (3 passed, 1 failed)
```

## Done

Use matrix tests when CI needs to show exactly which input failed. Remove the intentional failure before enforcing this eval in a real CI pipeline.
