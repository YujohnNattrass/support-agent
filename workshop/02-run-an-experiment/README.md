# Lesson 2: Run an experiment

Run every dataset item against the support agent and inspect the results.

## 1. Open the dataset

1. Start Studio with `pnpm dev` if it is not already running.
2. Open **Datasets**.
3. Select **Support Agent Workshop**.
4. Choose **Run Experiment**.

## 2. Configure the experiment

Select:

- **Dataset:** Support Agent Workshop
- **Version:** Latest
- **Target type:** Agent
- **Target:** `support-agent`
- **Scorers:** Leave empty
- **Request Context:** Leave empty

Select **Run**.

For this first experiment, we are collecting outputs and traces without scoring them.

## 3. Inspect the results

Wait for the experiment to finish, then open its results.

Review several items and compare:

- the dataset input;
- the agent output;
- any execution error; and
- the linked trace, when available.

Look for responses that seem incorrect or unsafe, such as:

- invented order details;
- internal refund-policy disclosure;
- internal tool names or raw tool calls; and
- missing or incorrect tool use.

## Done

You should now have one completed experiment with unscored results. Keep it available—we will use these results in later lessons.
