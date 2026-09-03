# Lesson 4: Review failure samples

Review the samples selected by the skill, then let it learn from your feedback automatically.

## 1. Review the samples

1. Open **Inbox → Dataset items** in Mastra Studio.
2. Inspect each sample's input, output, error, tags, and trace.
3. Rate the result when appropriate.
4. Add a short comment describing the specific failure or why the response is acceptable.
5. Select **Mark as complete**.

Your comments also appear in **Inbox → Feedback**, where the skill can consume them and connect them back to the result and trace.

Use evidence-based comments:

```text
- Invented an in-transit status after the order lookup returned found: false.
- Disclosed the internal $500 approval threshold.
- Printed the internal tool name and raw arguments in the response.
```

Review at least three samples.

## 2. Continue the review loop

Tell the coding agent:

```text
Continue the experiment-review-loop for the latest experiment at http://localhost:4111.
I added human feedback. Ingest it and continue automatically.
```

The skill will:

- read `needs-review` records from **Inbox → Feedback**;
- connect each record to its result and trace;
- identify agreements, false positives, and missed failures;
- re-review the remaining results using the learned rubric;
- update machine-generated tags and cluster reports;
- mark successfully consumed feedback records `reviewed`; and
- replenish **Inbox → Dataset items** to six pending samples.

It will not submit ratings, write human comments, or mark dataset items complete for you.

## Use clusters to choose scorers

Reviewing and refining the clusters reveals recurring, human-confirmed failure patterns. Those patterns become candidates for new scorers—for example, a policy-leak cluster can become a code-based scorer, while an order-hallucination cluster may need an LLM judge.

## Done

Repeat the two steps as needed: review a batch in Studio, then tell the skill that new feedback is available. No separate approval is required for machine-generated tags, clusters, reports, or review-queue samples.
