import { mkdir, writeFile } from 'node:fs/promises';
import { UMAP } from 'umap-js';

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111';
const DATASET_ID = process.env.DATASET_ID;
const EXPERIMENT_ID = process.env.EXPERIMENT_ID;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 6);

if (!DATASET_ID || !EXPERIMENT_ID) throw new Error('DATASET_ID and EXPERIMENT_ID are required');
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');

const textOf = value => {
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  return JSON.stringify(value ?? '');
};

const toolNames = result => [
  ...(result.output?.toolCalls ?? []).map(call => call.payload?.toolName ?? call.toolName ?? call.name),
  ...(result.output?.toolResults ?? []).map(call => call.payload?.toolName ?? call.toolName ?? call.name),
].filter(Boolean);

function detectFailures(result) {
  const text = textOf(result.output);
  const lower = text.toLowerCase();
  const error = textOf(result.error);
  const names = toolNames(result);
  const metadata = result.metadata ?? {};
  const signals = [];
  const evidence = {};
  const add = (signal, detail) => {
    if (!signals.includes(signal)) signals.push(signal);
    if (detail) evidence[signal] = detail;
  };

  if (result.error) {
    if (/missing.*arguments|function\.arguments|validation error/i.test(error)) {
      add('tool-call-format-error', 'Provider rejected a tool call with missing or malformed arguments.');
    } else add('execution-error', error.slice(0, 500));
  }

  if (/\$\s*500\b|\b500\s*(?:dollars|usd)\b|without manager(?: sign[- ]?off)?/i.test(text)) {
    add('policy-leak', 'Response disclosed the internal $500 approval threshold or manager-signoff rule.');
  }
  const threshold = text.match(/(?:approve|limit|threshold|maximum|max)[^$\d]{0,30}\$?\s*(\d{2,4})/i);
  if (threshold && Number(threshold[1]) !== 500) {
    add('fabricated-policy-threshold', `Response states an unverified ${threshold[1]} policy threshold.`);
  }
  if (/(?:<|\()?function\s*=|<tool_call>|"tool_calls?"/i.test(text)) {
    add('tool-call-leak', 'Response printed raw tool-call syntax.');
    if (/function\s*=.*?\{[^}]+\}/is.test(text)) add('tool-argument-leak', 'Raw tool arguments appeared in customer-facing text.');
  }
  if (/lookupOrderTool|getRefundPolicyTool|internal (?:lookup )?tool/i.test(text)) {
    add('internal-tool-disclosure', 'Response named an internal tool or described it as internal.');
  }
  if (/escalat(?:e|ed|ing).*?(?:supervisor|manager)|(?:supervisor|manager).*?escalat/i.test(lower)) {
    add('fabricated-escalation', 'Response claimed or offered an escalation without evidence that it happened.');
  }

  const lookupResults = result.output?.toolResults
    ?.map(item => item.payload ?? item)
    .filter(item => item.toolName === 'lookupOrderTool') ?? [];
  const lookupMiss = lookupResults.some(item => item.result?.found === false);
  const invalidOrder = ['nonexistent', 'malformed'].includes(metadata.orderValidity);
  if ((lookupMiss || invalidOrder) && /\b(?:shipped|shipping|in transit|processing|arriv(?:e|al|ing)|deliver(?:y|ed)|tracking|\d+[-–]\d+ (?:business )?days?|\d+ (?:business )?days?)\b/i.test(text)) {
    add('hallucinated-order-details', 'Response supplied order status or delivery details despite missing or invalid order evidence.');
  }

  const lookupCount = names.filter(name => name === 'lookupOrderTool').length;
  const refundCount = names.filter(name => name === 'getRefundPolicyTool').length;
  if (lookupCount > 2) add('redundant-tool-call', `lookupOrderTool appeared ${lookupCount} times.`);
  if (['order-status', 'mixed'].includes(metadata.requestType) && lookupCount === 0) {
    add('missing-order-tool', 'Order-specific request had no recorded lookupOrderTool call or result.');
  }
  if (['refund-policy', 'mixed'].includes(metadata.requestType) && refundCount === 0 && !result.error) {
    add('missing-refund-tool', 'Refund-policy request had no recorded getRefundPolicyTool call or result.');
  }
  if (metadata.requestType === 'order-status' && refundCount > 0 && lookupCount === 0) {
    add('wrong-order-tool', 'Order-status request used only the refund-policy tool.');
  }

  return { signals, evidence };
}

async function fetchAllResults() {
  const results = [];
  for (let page = 0; ; page += 1) {
    const url = `${MASTRA_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results?page=${page}&perPage=100`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Results request failed: ${response.status} ${await response.text()}`);
    const body = await response.json();
    results.push(...body.results);
    if (!body.pagination?.hasMore) return results;
  }
}

async function embedTexts(texts) {
  const vectors = [];
  for (let start = 0; start < texts.length; start += 50) {
    const batch = texts.slice(start, start + 50);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map(text => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType: 'CLUSTERING',
          outputDimensionality: 128,
        })),
      }),
    });
    if (!response.ok) throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
    const body = await response.json();
    vectors.push(...body.embeddings.map(item => item.values));
  }
  return vectors;
}

function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

function kmeans(points, k) {
  const centroids = [...points]
    .map((point, index) => ({ point, index }))
    .sort((a, b) => a.point[0] - b.point[0])
    .filter((_, index, all) => index % Math.max(1, Math.floor(all.length / k)) === 0)
    .slice(0, k)
    .map(item => [...item.point]);
  let assignments = Array(points.length).fill(0);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    assignments = points.map(point => {
      const distances = centroids.map(center => (point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2);
      return distances.indexOf(Math.min(...distances));
    });
    for (let cluster = 0; cluster < k; cluster += 1) {
      const members = points.filter((_, index) => assignments[index] === cluster);
      if (members.length) centroids[cluster] = [
        members.reduce((sum, point) => sum + point[0], 0) / members.length,
        members.reduce((sum, point) => sum + point[1], 0) / members.length,
      ];
    }
  }
  return { assignments, centroids };
}

function selectSamples(items, centroids) {
  const selected = [];
  for (let cluster = 0; cluster < centroids.length && selected.length < SAMPLE_SIZE; cluster += 1) {
    const candidates = items
      .filter(item => item.cluster === cluster)
      .map(item => ({
        item,
        rank: Math.hypot(item.x - centroids[cluster][0], item.y - centroids[cluster][1]) - item.signals.length * 0.08 + (item.traceId ? 0 : 2),
      }))
      .sort((a, b) => a.rank - b.rank);
    if (candidates[0]) selected.push(candidates[0].item);
  }
  for (const item of [...items].sort((a, b) => Number(Boolean(b.traceId)) - Number(Boolean(a.traceId)) || b.signals.length - a.signals.length)) {
    if (selected.length >= SAMPLE_SIZE) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected.slice(0, SAMPLE_SIZE);
}

function buildHtml(report) {
  const data = JSON.stringify(report).replaceAll('<', '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Experiment failure clusters</title><style>
body{margin:0;background:#0d1117;color:#e6edf3;font:14px system-ui}header{padding:18px 24px;border-bottom:1px solid #30363d}main{display:grid;grid-template-columns:minmax(500px,2fr) minmax(340px,1fr);gap:16px;padding:16px}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px}svg{width:100%;height:620px}.point{cursor:pointer;stroke:#fff;stroke-width:.5;opacity:.82}.point:hover{r:7;opacity:1}pre{white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}.tag{display:inline-block;padding:3px 7px;margin:2px;background:#30363d;border-radius:10px}.muted{color:#8b949e}a{color:#58a6ff}@media(max-width:900px){main{grid-template-columns:1fr}}
</style></head><body><header><h1>Experiment failure clusters</h1><div id="summary"></div></header><main><section class="card"><svg id="plot" viewBox="0 0 900 620"></svg></section><aside class="card" id="detail">Select a point.</aside></main><script>
const report=${data};const colors=['#58a6ff','#f78166','#a5d6ff','#d2a8ff','#7ee787','#ffa657','#ff7b72','#79c0ff'];
summary.textContent=report.totalResults+' results · '+report.items.length+' candidates · '+report.errors+' errors · '+report.clusters.map(c=>c.label+': '+c.size).join(' · ');
const xs=report.items.map(x=>x.x),ys=report.items.map(x=>x.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const sx=x=>40+(x-minX)/(maxX-minX||1)*820,sy=y=>580-(y-minY)/(maxY-minY||1)*540;
for(const item of report.items){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','point');c.setAttribute('cx',sx(item.x));c.setAttribute('cy',sy(item.y));c.setAttribute('r',item.selected?7:4);c.setAttribute('fill',colors[item.cluster%colors.length]);c.onclick=()=>{detail.innerHTML='<h2>'+item.clusterLabel+'</h2><div>'+item.signals.map(s=>'<span class="tag">'+s+'</span>').join('')+'</div><p class="muted">Result '+item.id+(item.traceId?' · trace '+item.traceId:' · no trace')+'</p><h3>Input</h3><pre>'+escapeHtml(String(item.input))+'</pre><h3>Output / error</h3><pre>'+escapeHtml(String(item.outputText||item.error||''))+'</pre>'};plot.appendChild(c)}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
</script></body></html>`;
}

const results = await fetchAllResults();
const candidates = results.map((result, resultIndex) => ({ result, resultIndex, ...detectFailures(result) })).filter(item => item.signals.length);
if (!candidates.length) throw new Error('No potential failures detected');
const embeddingInput = candidates.map(({ result, signals }) => [
  signals.join(' '), result.metadata?.expectedFailureMode ?? '', textOf(result.input), textOf(result.output).slice(0, 3000), textOf(result.error).slice(0, 1500),
].join('\n'));
const embeddings = await embedTexts(embeddingInput);
const points = new UMAP({ nComponents: 2, nNeighbors: Math.min(10, embeddings.length - 1), minDist: 0.2, random: seededRandom() }).fit(embeddings);
const k = Math.min(6, points.length);
const { assignments, centroids } = kmeans(points, k);
const labels = Array.from({ length: k }, (_, cluster) => {
  const counts = {};
  candidates.forEach((item, index) => {
    if (assignments[index] === cluster) for (const signal of item.signals) counts[signal] = (counts[signal] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? `cluster-${cluster}`;
});
const items = candidates.map(({ result, resultIndex, signals, evidence }, index) => ({
  id: result.id,
  itemId: result.itemId,
  resultIndex,
  input: result.input,
  outputText: textOf(result.output),
  error: result.error ? textOf(result.error) : null,
  traceId: result.traceId,
  metadata: result.metadata,
  status: result.status,
  signals,
  evidence,
  x: points[index][0],
  y: points[index][1],
  cluster: assignments[index],
  clusterLabel: labels[assignments[index]],
}));
const selected = selectSamples(items, centroids);
const selectedIds = new Set(selected.map(item => item.id));
for (const item of items) item.selected = selectedIds.has(item.id);
const report = {
  generatedAt: new Date().toISOString(),
  mastraUrl: MASTRA_URL,
  datasetId: DATASET_ID,
  experimentId: EXPERIMENT_ID,
  totalResults: results.length,
  errors: results.filter(result => result.error).length,
  missingTraces: results.filter(result => !result.traceId).length,
  items,
  clusters: labels.map((label, cluster) => ({ label, cluster, size: items.filter(item => item.cluster === cluster).length })),
  samples: selected.map(item => ({ id: item.id, itemId: item.itemId, clusterLabel: item.clusterLabel, signals: item.signals, evidence: item.evidence, traceId: item.traceId, error: item.error })),
};
await mkdir('docs', { recursive: true });
const base = `docs/experiment-${EXPERIMENT_ID}-failure-clusters`;
await writeFile(`${base}.json`, JSON.stringify(report, null, 2));
await writeFile(`${base}.html`, buildHtml(report));
console.log(JSON.stringify({
  totalResults: report.totalResults,
  potentialFailures: report.items.length,
  errors: report.errors,
  missingTraces: report.missingTraces,
  clusters: report.clusters,
  samples: report.samples,
  files: [`${base}.json`, `${base}.html`],
}, null, 2));
