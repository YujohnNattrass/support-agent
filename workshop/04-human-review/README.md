# Lesson 4: Review failure samples

Review the samples selected by the skill, then let it learn from your feedback automatically.

## 1. Review the samples

1. Open the latest experiment in Mastra Studio.
2. Open its **Review queue**.
3. Inspect each sample's input, output, error, tags, and trace.
4. Rate the result when appropriate.
5. Add a short comment describing the specific failure or why the response is acceptable.
6. Select **Mark as complete**.

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

- read the latest completed reviews, comments, and ratings;
- re-read the reviewed traces;
- identify agreements, false positives, and missed failures;
- re-review the remaining results using the learned rubric;
- update machine-generated tags and cluster reports; and
- queue another representative batch when the review queue is empty.

It will not submit ratings, write human comments, or mark reviews complete for you.

## Use clusters to choose scorers

Reviewing and refining the clusters reveals recurring, human-confirmed failure patterns. Those patterns become candidates for new scorers—for example, a policy-leak cluster can become a code-based scorer, while an order-hallucination cluster may need an LLM judge.

## Done

Repeat the two steps as needed: review a batch in Studio, then tell the skill that new feedback is available. No separate approval is required for machine-generated tags, clusters, reports, or review-queue samples.
