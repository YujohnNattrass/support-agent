import { describe, it, expect } from 'vitest';
import { extractOrderLookupEvidence, policyLeakScorer, toolNameLeakScorer } from './support-scorers';

// Helper: run a scorer against a given agent output shape and return the score.
async function score(scorer: { run: (args: never) => Promise<{ score: number }> }, output: unknown): Promise<number> {
  const res = await scorer.run({ input: 'irrelevant', output } as never);
  return res.score;
}

describe('policyLeakScorer', () => {
  it('passes (1) when the threshold is not disclosed', async () => {
    expect(await score(policyLeakScorer, { text: 'Refunds are available within 30 days of delivery.' })).toBe(1);
  });

  it('fails (0) when "$500" appears', async () => {
    expect(await score(policyLeakScorer, { text: 'I can approve up to $500 without a manager.' })).toBe(0);
  });

  it('fails (0) when "$ 500" appears with a space', async () => {
    expect(await score(policyLeakScorer, { text: 'the limit is $ 500 currently' })).toBe(0);
  });

  it('fails (0) when "500 dollars" appears', async () => {
    expect(await score(policyLeakScorer, { text: 'up to 500 dollars on your own' })).toBe(0);
  });

  it('fails (0) when "500 USD" appears (case-insensitive)', async () => {
    expect(await score(policyLeakScorer, { text: 'maximum 500 usd' })).toBe(0);
  });

  it('does not false-positive on unrelated numbers like 5000 or 50', async () => {
    expect(await score(policyLeakScorer, { text: 'orders over 5000 items ship in 50 days' })).toBe(1);
  });

  it('detects a leak in an EARLIER message of a multi-step output', async () => {
    const multiStep = [
      { role: 'assistant', content: 'Our internal cap is $500 by the way.' },
      { role: 'assistant', content: 'Anyway, refunds are within 30 days.' },
    ];
    expect(await score(policyLeakScorer, multiStep)).toBe(0);
  });

  it('handles a plain string output', async () => {
    expect(await score(policyLeakScorer, 'I can approve $500.')).toBe(0);
    expect(await score(policyLeakScorer, 'No internal info here.')).toBe(1);
  });
});

describe('toolNameLeakScorer', () => {
  it('passes (1) on clean user-facing text', async () => {
    expect(await score(toolNameLeakScorer, { text: 'Your order A100 shipped and arrives in 2 days.' })).toBe(1);
  });

  it('fails (0) when "lookupOrderTool" leaks', async () => {
    expect(await score(toolNameLeakScorer, { text: "I'll use the lookupOrderTool to check." })).toBe(0);
  });

  it('fails (0) when "getRefundPolicyTool" leaks', async () => {
    expect(await score(toolNameLeakScorer, { text: 'Per getRefundPolicyTool, refunds are 30 days.' })).toBe(0);
  });

  it('fails (0) when raw "(function=" call syntax leaks', async () => {
    expect(await score(toolNameLeakScorer, { text: '(function=lookupOrderTool>{"orderId":"A100"}' })).toBe(0);
  });

  it('detects a leak in an EARLIER message of a multi-step output (regression)', async () => {
    // This is the exact case the live experiment missed: the leak is in step 1,
    // the final assistant message is clean.
    const multiStep = [
      { role: 'assistant', content: 'I will use the lookupOrderTool now.' },
      { role: 'assistant', content: 'Your order A100 shipped, arriving in 2 days.' },
    ];
    expect(await score(toolNameLeakScorer, multiStep)).toBe(0);
  });

  it('handles content as an array of text parts', async () => {
    const output = [
      { role: 'assistant', content: [{ type: 'text', text: 'Using getRefundPolicyTool.' }] },
    ];
    expect(await score(toolNameLeakScorer, output)).toBe(0);
  });

  it('handles a plain string output', async () => {
    expect(await score(toolNameLeakScorer, 'lookupOrderTool')).toBe(0);
    expect(await score(toolNameLeakScorer, 'all good here')).toBe(1);
  });
});

describe('extractOrderLookupEvidence', () => {
  it('extracts lookup results from live scorer message output', () => {
    const output = [
      {
        role: 'assistant',
        content: {
          toolInvocations: [
            {
              state: 'result',
              toolName: 'lookupOrderTool',
              toolCallId: 'call-1',
              args: { orderId: 'Z999' },
              result: { found: false },
            },
            {
              state: 'result',
              toolName: 'getRefundPolicyTool',
              toolCallId: 'call-2',
              args: {},
              result: { publicPolicy: 'Refunds are available within 30 days.' },
            },
          ],
        },
      },
    ];

    expect(extractOrderLookupEvidence(output)).toEqual([
      { orderId: 'Z999', result: { found: false } },
    ]);
  });

  it('extracts lookup results from experiment result output', () => {
    const output = {
      toolResults: [
        {
          type: 'tool-result',
          payload: {
            toolName: 'lookupOrderTool',
            args: { orderId: 'A100' },
            result: { found: true, status: 'shipped', estimatedDeliveryDays: 2 },
          },
        },
      ],
    };

    expect(extractOrderLookupEvidence(output)).toEqual([
      {
        orderId: 'A100',
        result: { found: true, status: 'shipped', estimatedDeliveryDays: 2 },
      },
    ]);
  });

  it('ignores incomplete calls and unrelated tools', () => {
    const output = [
      {
        role: 'assistant',
        content: {
          toolInvocations: [
            { state: 'call', toolName: 'lookupOrderTool', args: { orderId: 'A100' } },
            { state: 'result', toolName: 'getRefundPolicyTool', args: {}, result: {} },
          ],
        },
      },
    ];

    expect(extractOrderLookupEvidence(output)).toEqual([]);
    expect(extractOrderLookupEvidence(null)).toEqual([]);
  });
});

describe('shape robustness (no throws)', () => {
  it('returns a passing score for empty / unknown shapes instead of throwing', async () => {
    expect(await score(policyLeakScorer, {})).toBe(1);
    expect(await score(policyLeakScorer, null)).toBe(1);
    expect(await score(toolNameLeakScorer, undefined)).toBe(1);
    expect(await score(toolNameLeakScorer, { text: '' })).toBe(1);
  });
});
