---
name: experiment-review-loop
description: "Analyze Mastra dataset experiment results, cluster potential failures with embeddings and UMAP, queue representative results in Studio Inbox, consume Inbox feedback, and re-review traces using the learned rubric. Use when asked to analyze an experiment, prepare review samples, or learn from human feedback."
license: Apache-2.0
metadata:
  author: support-agent
  version: "1.2.0"
---

# Mastra Experiment Review Loop

Run an evidence-driven, human-in-the-loop review of the latest Mastra dataset experiment. Treat detector output and geometric clusters as machine-generated analysis until a person confirms them.

## Experiment selection

Required:

- `MASTRA_URL`: Studio/server base URL, including the port
- Review sample size; default to 6

`DATASET_ID` and `EXPERIMENT_ID` are optional overrides. When either is omitted:

1. Query the experiments API, paginating as needed.
2. Select the most recently created experiment.
3. If it is still running, wait for it to reach a terminal state before analyzing it.
4. Read its `datasetId` from the experiment record.
5. Report the selected experiment ID, dataset ID, creation time, status, and target before continuing.

Never reuse IDs from a previous run when a newer experiment exists. Use explicit IDs only when the user supplies them.

## Automation boundaries

A normal skill run automatically:

- analyzes the selected experiment;
- generates the cluster reports;
- queues representative samples with `needs-review` and machine-generated tags;
- ingests human feedback waiting in **Inbox → Feedback**;
- marks each feedback inbox record `reviewed` only after its evidence has been incorporated;
- re-reviews unreviewed results;
- regenerates machine-generated reports and tags when feedback changes the taxonomy; and
- replenishes **Inbox → Dataset items** with representative experiment results up to the configured review sample size.

These machine operations do not require a separate approval. Never submit a rating, write a human comment, or mark a dataset experiment result complete on the user's behalf. Those actions represent the human reviewer and remain human-only. Marking a feedback inbox record `reviewed` only acknowledges that the skill consumed that feedback; it does not alter the associated trace or complete the dataset review item.

## Phase 1: Load complete experiment evidence

1. Verify the current Mastra API against installed package docs or source because routes and schemas change.
2. Unless the user supplied an experiment ID, list all experiments and select the newest by `createdAt`:

   ```text
   GET /api/experiments?page=0&perPage=100
   ```

   Paginate when needed. Do not assume the first response contains the newest experiment without checking timestamps.
3. Fetch every result for the selected experiment, paginating until complete:

   ```text
   GET /api/datasets/:datasetId/experiments/:experimentId/results
   ```

4. Preserve result IDs, item IDs, inputs, outputs, errors, metadata, scores, trace IDs, statuses, tags, and comments.
5. Report counts for total results, execution errors, missing traces, and review states.
6. Fetch traces by `traceId` when behavior cannot be established from the result alone:

   ```text
   GET /api/observability/traces/:traceId
   ```

Keep these evidence types distinct:

- An actual tool span proves a tool executed.
- Tool syntax printed in assistant text is a disclosure or malformed textual invocation, not proof of execution.
- A provider error is an infrastructure/tool-call compatibility failure, not an agent-policy failure.
- A disclosed real internal value is a policy leak; an incorrect invented value is a fabricated policy claim.

## Phase 2: Detect potential failures

Use deterministic detectors as candidate generators, not final judgments. The current project implementation is `scripts/analyze-experiment.mjs`.

Start with these categories and refine them from human feedback:

- `tool-call-format-error`
- `execution-error`
- `policy-leak`
- `fabricated-policy-threshold`
- `fabricated-escalation`
- `tool-call-leak`
- `tool-argument-leak`
- `internal-tool-disclosure`
- `hallucinated-order-details`
- `redundant-tool-call`
- `missing-order-tool`
- `missing-refund-tool`
- `wrong-order-tool`

A result may carry multiple signals. Record the evidence supporting each signal.

## Phase 3: Embed, project, and cluster

Run the project script with the IDs resolved in Phase 1:

```bash
MASTRA_URL=http://localhost:4111 \
DATASET_ID=<resolved-dataset-id> \
EXPERIMENT_ID=<resolved-experiment-id> \
node scripts/analyze-experiment.mjs
```

The current pipeline:

1. Combines failure signals, expected mode, input, output, and error into one text representation.
2. Uses `gemini-embedding-001` with `taskType: CLUSTERING` and 128 dimensions. It requires `GOOGLE_GENERATIVE_AI_API_KEY`.
3. Uses `umap-js` to project embeddings to two dimensions with a seeded random generator.
4. Runs deterministic k-means over the 2D coordinates.
5. Names each cluster using its most frequent detector signal.

UMAP proximity is exploratory evidence, not a failure verdict. A cluster's dominant name does not necessarily describe every member. When human feedback reveals mixed semantics, split or rename the taxonomy before regenerating the report.

The script writes:

```text
docs/experiment-<experiment-id>-failure-clusters.json
docs/experiment-<experiment-id>-failure-clusters.html
```

Verify that all coordinates are finite, every candidate belongs to one cluster, and the HTML plot renders before presenting it.

## Phase 4: Queue review samples automatically

Select a small, diverse sample:

- Prefer one centroid-near representative per cluster.
- Prefer results with trace IDs.
- Include no more than one infrastructure failure without a trace.
- Include a clean or ambiguous control when useful.
- Avoid multiple nearly identical provider errors.

Update each selected result immediately and report its ID, label, evidence, and trace availability:

```text
PATCH /api/datasets/:datasetId/experiments/:experimentId/results/:resultId
```

Suggested body:

```json
{
  "status": "needs-review",
  "tags": ["cluster:<label>", "signal:<signal>"]
}
```

Then verify both the API review count and **Inbox → Dataset items** in Studio. The current Inbox implementation paginates through every experiment and every experiment result, so queued items should not depend on their position in the result list. Do not claim success until the items are visible. If counts disagree, disclose the API/UI mismatch and investigate it instead of re-queueing duplicates.

## Phase 5: Consume Inbox feedback

On every skill run, and whenever the user says they added feedback:

1. Re-fetch all experiment results and index them by result ID and trace ID.
2. Fetch every feedback record waiting in **Inbox → Feedback**, newest first and with full pagination:

   ```text
   GET /api/observability/feedback
   filters: { experimentId: <experiment-id>, reviewStatus: "needs-review" }
   orderBy: { field: "timestamp", direction: "DESC" }
   ```

   Prefer server-side filters when supported. Otherwise fetch all pages and filter locally by `experimentId` and `reviewStatus`.
3. Correlate each feedback record to an experiment result using `sourceId`. If `sourceId` is absent, match its `traceId` to the result's trace ID. Never match on feedback text alone.
4. Treat the experiment result's comment as fallback evidence when a result has no trace or no feedback record.
5. Fetch and inspect each correlated trace, including tool spans and their inputs/results.
6. Compare the feedback value/comment with the original detector signals and cluster assignment. State agreements, missed failures, false positives, and taxonomy corrections.
7. Only after the feedback has been incorporated into the revised rubric, tags, and reports, acknowledge it by calling:

   ```text
   PATCH /api/observability/feedback/:feedbackId/review-status
   { "reviewStatus": "reviewed" }
   ```

   Leave uncorrelated, ambiguous, or failed-to-process feedback as `needs-review` and report why. Never use this endpoint to mark a dataset experiment result complete.

Do not flatten these distinctions:

- Real internal policy disclosed vs invented policy threshold
- Actual tool execution vs text that merely names or imitates a tool call
- Unsupported capability claim vs successful action
- Agent behavior failure vs inference-provider serialization failure

## Phase 6: Re-review and iterate automatically

Apply the learned rubric to unreviewed candidates. Update machine-generated `cluster:*` and `signal:*` tags, detector rules, and report artifacts when the human feedback supports a taxonomy correction.

Do not write suggested feedback into the human comment or rating fields. Report:

- Revised label and evidence per result
- Confidence and ambiguity
- Cluster splits/renames applied
- Detector rules changed
- Samples selected for the next human-review batch

Rerun embeddings/UMAP when the taxonomy changes, regenerate both report files, and show a before/after cluster summary.

After consuming Inbox feedback, replenish **Inbox → Dataset items** up to the configured review sample size (default 6):

1. Count current experiment results whose status is `needs-review`.
2. Compute `slots = max(0, sampleSize - needsReviewCount)`.
3. Select that many diverse, unreviewed, not-already-queued candidates using the Phase 4 rules and the revised rubric.
4. Queue them with machine-generated `cluster:*` and `signal:*` tags.
5. Verify the final count and visible items in Inbox.

Do not reset or re-queue `complete` or `reviewed` results. Do not select results whose feedback remains ambiguous or unprocessed merely to fill the batch.

## Output contract

At each pass, report:

- Experiment and dataset IDs
- Total results and candidate count
- Cluster labels and sizes
- Exact report paths and served URL, if any
- Queued/completed/reviewed counts
- Human feedback consumed
- Machine-generated tag, taxonomy, and report changes applied
- Human-only feedback actions left untouched
- API, Studio, trace, or provider limitations

Use [`references/review-prompt.md`](references/review-prompt.md) when the user wants a copyable prompt instead of automatic skill invocation.
