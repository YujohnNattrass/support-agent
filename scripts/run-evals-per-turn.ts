import { runEvals } from '@mastra/core/evals';
import { checks } from '@mastra/evals/checks';
import { supportAgent } from '../src/mastra/agents/support-agent';

const result = await runEvals({
  target: supportAgent,
  scorers: [],
  data: [
    {
      turns: [
        {
          input: 'Use lookupOrderTool to look up order A100 and report its current status.',
          gates: [checks.calledTool('lookupOrderTool')],
          scorers: [{ scorer: checks.includes('shipped', { ignoreCase: true }), threshold: 1 }],
        },
        {
          input: 'Now switch to order A200. Use lookupOrderTool and tell me which product it contains.',
          gates: [checks.calledTool('lookupOrderTool')],
          scorers: [
            {
              scorer: checks.includes('Mechanical Keyboard', { ignoreCase: true }),
              threshold: 1,
            },
          ],
        },
      ],
    },
  ],
});

console.log(
  JSON.stringify(
    {
      verdict: result.verdict,
      turns: result.turnResults,
    },
    null,
    2,
  ),
);
