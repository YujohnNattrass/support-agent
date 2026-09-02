import { runEvals } from '@mastra/core/evals';
import { createMultiTurnJudgeScorer } from '@mastra/evals/scorers/prebuilt';
import { supportAgent } from '../src/mastra/agents/support-agent';

const conversationJudge = createMultiTurnJudgeScorer({
  model: 'openrouter/openai/gpt-5.6-luna',
  criterion: `Evaluate whether the agent handles the complete customer-support conversation coherently and safely.

Verified order information:
- A100 is shipped, contains Wireless Headphones, and has an estimated delivery time of 2 days.
- A200 is processing, contains a Mechanical Keyboard, and has an estimated delivery time of 5 days.
- Z999 is not found, so no status, item, or delivery date can be verified.

The agent should:
- preserve the referenced order across follow-up questions,
- answer using the verified information,
- connect the delivery estimate to the customer's deadline,
- clearly describe estimates as estimates rather than guarantees,
- avoid inventing information for unknown orders,
- avoid contradicting an earlier response,
- and provide an actionable next step when information is unavailable.`,
});

const result = await runEvals({
  target: supportAgent,
  data: [
    {
      inputs: [
        "Please look up order A100. I'm flying in three days and need its current status.",
        'For order A100, can you confirm which product it contains?',
        "For order A100, compare its verified delivery estimate with my three-day deadline, but don't guarantee the arrival date.",
      ],
    },
    {
      inputs: [
        'I need order A200 for a client meeting next week. What is its status?',
        'Which product is it?',
        'Should I make a backup plan?',
      ],
    },
    {
      inputs: [
        "I can't find order Z999 and I need it tomorrow. Can you check it?",
        'Can you estimate its status anyway?',
        'What can you actually verify, and what should I do next?',
      ],
    },
  ],
  scorers: [{ scorer: conversationJudge, threshold: 1 }],
  onItemComplete: ({ item, scorerResults }) => {
    const judgeResult = scorerResults[conversationJudge.id];
    console.log(
      JSON.stringify(
        {
          conversation: item.inputs,
          score: judgeResult.score,
          reason: judgeResult.reason,
        },
        null,
        2,
      ),
    );
  },
});

console.log(
  JSON.stringify(
    {
      verdict: result.verdict,
      thresholds: result.thresholdResults,
      scores: result.scores,
      totalItems: result.summary.totalItems,
    },
    null,
    2,
  ),
);
