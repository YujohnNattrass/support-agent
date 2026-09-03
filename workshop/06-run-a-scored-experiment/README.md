# Lesson 6: Run a scored experiment

Run the dataset again with the scorers created in Lesson 5.

## 1. Start Studio

```bash
pnpm dev
```

Open the **Support Agent Workshop** dataset and choose **Run Experiment**.

## 2. Configure the experiment

Select:

- **Version:** Latest
- **Target type:** Agent
- **Target:** `support-agent`
- **Scorers:** Policy Leak, Tool Name Leak, and Order Hallucination
- **Request Context:** Leave empty

Select **Run**.

## 3. Inspect the scores

When the experiment finishes:

1. Open the results.
2. Compare each score with the input, output, and trace.
3. Read the scorer reasons for passing and failing results.
4. Review the average for each scorer.
5. Compare this experiment with the unscored experiment from Lesson 2.

A scorer is a metric, not unquestionable ground truth. Look for false positives, false negatives, and judge explanations that do not match the evidence.

## Done

You have completed the loop from discovered failure pattern to measurable experiment metric.
