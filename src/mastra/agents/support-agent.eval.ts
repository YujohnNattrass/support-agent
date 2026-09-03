import { checks } from '@mastra/evals/checks';
import { expectEval } from '@mastra/evals/vitest';
import { test } from 'vitest';
import { supportAgent } from './support-agent';

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
