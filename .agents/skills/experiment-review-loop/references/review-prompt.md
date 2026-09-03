# Copyable experiment-review prompt

Give this prompt to an agent working in the Mastra project repository.

```text
Analyze the latest Mastra dataset experiment at [MASTRA_URL].

1. Verify the installed Mastra experiment, trace, feedback, and review APIs before using them.
2. Find the most recently created experiment, wait for it to finish if necessary, and report its experiment ID, dataset ID, target, creation time, and status.
3. Fetch every result with pagination. Summarize total results, errors, missing traces, scores, and review states.
4. Detect potential behavioral and infrastructure failures. Keep detector signals provisional and cite evidence for each one.
5. Distinguish actual tool spans from tool syntax printed in assistant text. Distinguish real policy leakage from fabricated policy claims. Keep provider/tool-call serialization errors separate from agent behavior.
6. Generate embeddings, a deterministic UMAP projection, clusters, and interactive JSON and HTML reports under docs/.
7. Automatically queue six diverse review samples, preferring trace-backed representatives and including no more than one no-trace infrastructure failure. Add only machine-generated cluster/signal tags and verify the samples in **Inbox → Dataset items**.
8. Read every `needs-review` record in **Inbox → Feedback** for this experiment. Correlate it by `sourceId`, falling back to `traceId`, then re-read the trace and use that evidence to correct the taxonomy. After successfully incorporating a feedback record, mark that feedback record `reviewed`; leave ambiguous or uncorrelated feedback pending.
9. Apply the learned rubric to unreviewed candidates, update machine-generated tags and reports, then replenish **Inbox → Dataset items** back to six pending samples without resetting completed or reviewed results.

Never submit ratings, write human comments, or mark dataset experiment results complete for me. Marking a consumed feedback inbox record reviewed is allowed and does not complete the dataset item or alter its trace. Always report exact result IDs, trace IDs when available, report paths, queue counts, feedback consumed, automated changes, and any API, Studio, missing-trace, or inference-provider limitations.
```

Replace `[MASTRA_URL]` with the active Studio/server URL, normally `http://localhost:4111`.
