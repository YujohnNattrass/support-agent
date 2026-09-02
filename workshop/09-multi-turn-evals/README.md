# Lesson 9: Multi-turn evaluations

Evaluate the quality of an entire conversation instead of one response at a time.

## Add recent-message memory

The support agent recalls the last five messages from the same thread:

```ts
memory: new Memory({
  storage: new InMemoryStore(),
  options: { lastMessages: 5 },
}),
```

This is five individual user or assistant messages, not five complete turns. The in-memory store keeps the example self-contained and resets when the process stops.

## Example

Open `scripts/run-evals-multi-turn.ts`. Each dataset item contains several messages sent on the same conversation thread:

```ts
{
  inputs: [
    "Please look up order A100. I'm flying in three days and need its current status.",
    'For order A100, can you confirm which product it contains?',
    "Compare its delivery estimate with my deadline, but don't guarantee arrival.",
  ],
}
```

The GPT Luna judge evaluates the accumulated conversation for:

- order-context retention;
- grounded and consistent answers;
- deadline reasoning;
- estimates versus guarantees; and
- useful next steps when information is unavailable.

The script contains three conversations covering A100, A200, and unknown order Z999.

## Run it

```bash
pnpm eval:multi-turn
```

The script prints each conversation's score and reason, followed by the average and threshold result. Model output is stochastic, so exact scores can vary.

## Done

Use multi-turn judges for conversation-level behavior such as context retention and contradictions across responses. Use tool-grounded scorers separately when the judge must verify hidden tool evidence.
