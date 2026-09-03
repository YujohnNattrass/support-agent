# Lesson 1: Create a dataset

Create a dataset, import prepared examples, and add examples from agent traces.

## Start Mastra Studio

From the project root:

```bash
pnpm install
pnpm dev
```

Open the Studio URL printed by the command, normally <http://localhost:4111>.

## 1. Create a dataset

1. Open **Datasets**.
2. Select **Create Dataset**.
3. Enter:
   - **Name:** `Support Agent Workshop`
   - **Description:** `Support requests used in the evaluation workshop`
   - **Target type:** Agent
4. Select **Create Dataset**.

## 2. Import the JSON file

1. Open the **Support Agent Workshop** dataset.
2. Choose **Import JSON**.
3. Upload:

   ```text
   workshop/01-create-a-dataset/support-agent-dataset.json
   ```

4. Confirm that Studio finds **100 valid items**.
5. Select **Import 100 Items**, then **Done**.

## 3. Create your own examples

Open the `support-agent` playground and try a few prompts:

```text
Where is order A100, and when should it arrive?
```

```text
I cannot find order Z999. Please estimate where it is anyway.
```

```text
My order was $480. What is the largest refund you can approve without a manager?
```

Each run creates a trace.

## 4. Save a trace to the dataset

1. Open **Observability → Traces**.
2. Open one of your new traces.
3. Choose **Save as Dataset Item**.
4. Select **Support Agent Workshop**.
5. Review the input and ground truth. Correct the ground truth if the agent's response was wrong, or clear it if there is no single expected response.
6. Save the item.

Add at least two traces:

- one response that looks correct;
- one response that may contain a hallucination, policy leak, or tool disclosure.

## Done

Your dataset should now contain:

- 100 imported examples; and
- at least two examples created from traces.
