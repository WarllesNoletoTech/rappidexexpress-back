#!/usr/bin/env node

// Teste somente leitura. Uso:
// API_URL=https://api.exemplo.com/api AUTH_TOKEN=... npm run load:dashboard
const baseUrl = String(
  process.env.API_URL || 'http://localhost:3000/api',
).replace(/\/+$/, '');
const token = String(process.env.AUTH_TOKEN || '').trim();
const concurrency = Math.min(
  20,
  Math.max(1, Number(process.env.CONCURRENCY) || 10),
);

if (!token) {
  console.error('AUTH_TOKEN é obrigatório. Nenhuma requisição foi enviada.');
  process.exit(1);
}

const endpoints = [
  '/user/myself',
  '/city',
  '/user/motoboys',
  '/delivery?page=1&itemsPerPage=20&includeTotal=false',
  '/delivery/counts',
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] || 0
  );
}

async function call(endpoint) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const durationMs = Math.round(performance.now() - startedAt);
  await response.arrayBuffer();
  return { endpoint, durationMs, status: response.status };
}

async function main() {
  const results = (
    await Promise.all(
      Array.from({ length: concurrency }, () =>
        Promise.all(endpoints.map((endpoint) => call(endpoint))),
      ),
    )
  ).flat();

  for (const endpoint of endpoints) {
    const rows = results.filter((result) => result.endpoint === endpoint);
    const durations = rows.map((row) => row.durationMs);
    const errors = rows.filter((row) => row.status >= 400).length;
    console.log(
      `${endpoint} requests=${rows.length} errors=${errors} p50=${percentile(durations, 0.5)}ms p95=${percentile(durations, 0.95)}ms`,
    );
  }

  if (results.some((result) => result.status >= 500)) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Teste interrompido: ${error.message}`);
  process.exitCode = 1;
});
