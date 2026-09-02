---
name: experiment-review-loop
description: "Analyze Mastra dataset experiment results, detect and cluster potential failures with embeddings and UMAP, generate an interactive HTML report, send representative results to the Studio review queue, ingest human comments and feedback, and re-review traces. Use when asked to analyze an experiment, cluster failures, prepare review samples, or learn from completed experiment reviews."
license: Apache-2.0
metadata:
  author: support-agent
  version: "1.1.0"
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
- ingests any human feedback already present;
- re-reviews unreviewed results; and
- regenerates machine-generated reports and tags when feedback changes the taxonomy.

These machine operations do not require a separate approval. Never submit a rating, write a human comment, or mark an item complete on the user's behalf. Those actions represent the human reviewer and remain human-only.

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

Then verify both the API review count and the visible Studio queue. If the API reports queued items but Studio does not show them, inspect pagination behavior. Do not claim success until the items are visible. The current Studio version may only load the first result page; if so, disclose the limitation and choose a visible smoke-test sample rather than silently losing items.

## Phase 5: Ingest human reviews

On every skill run, and whenever the user says they added feedback:

1. Re-fetch all experiment results and identify `complete`, `reviewed`, and commented items that have not yet been incorporated into the analysis.
2. Fetch experiment feedback:

   ```text
   GET /api/observability/feedback
   ```

   Filter by `experimentId`. Correlate feedback to results using `sourceId`; use `traceId` to retrieve evidence.
3. Treat the experiment result's comment as authoritative when a result has no trace or no feedback record.
4. Fetch and inspect each reviewed trace, including tool spans and their inputs/results.
5. Compare the human comment with the original detector signals and cluster assignment.
6. State agreements, missed failures, false positives, and taxonomy corrections.

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

Rerun embeddings/UMAP when the taxonomy changes, regenerate both report files, and show a before/after cluster summary. Queue the next representative batch automatically when no items are currently awaiting human review.

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
