# Lesson 3: Analyze experiment errors

Use the `experiment-review-loop` skill to analyze the latest experiment and prepare samples for human review.

## 1. Activate the skill

Give your coding agent this prompt:

```text
Activate the experiment-review-loop skill at .agents/skills/experiment-review-loop/SKILL.md.
Analyze the latest experiment at http://localhost:4111.
```

The clustering step requires `GOOGLE_GENERATIVE_AI_API_KEY` in `.env`.

## 2. Let the skill run

The skill will automatically:

- find the most recently created experiment;
- read every result and linked trace;
- identify potential failures with evidence;
- generate UMAP cluster JSON and HTML reports;
- select six representative samples; and
- add those samples to the Studio review queue.

It should report the selected experiment and dataset IDs, result counts, cluster names and sizes, report paths, and queued result IDs.

## 3. Review the analysis

Open the HTML report and inspect several points from different clusters. Then confirm that the six selected samples appear in the experiment's review queue.

Detector signals and clusters are machine-generated suggestions. Human review in the next lesson will refine them.

## Done

You should now have an error analysis, an interactive cluster report, and six samples waiting for human review.
