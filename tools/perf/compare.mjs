#!/usr/bin/env node
/**
 * Print a markdown comparison of two or more api-bench.mjs result files.
 * Usage: node tools/perf/compare.mjs tools/perf/results/baseline.json tools/perf/results/fixed1.json [...]
 */
import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length < 2) {
	console.error('usage: compare.mjs <baseline.json> <after.json> [more.json...]');
	process.exit(1);
}
const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const base = runs[0];
const names = base.results.map((r) => r.name);
const pick = (run, name) => run.results.find((r) => r.name === name);
const ratio = (a, b) => (a && b ? `${(a / b).toFixed(2)}×` : '');

const head = ['endpoint', 'metric', ...runs.map((r) => r.label), `${runs[0].label}→${runs[runs.length - 1].label}`];
console.log(`| ${head.join(' | ')} |`);
console.log(`|${head.map(() => '---').join('|')}|`);
for (const name of names) {
	const rows = [
		['seq p50 ms', (r) => r?.sequential?.p50, 'lower'],
		['seq p90 ms', (r) => r?.sequential?.p90, 'lower'],
		[`c${base.concurrency} rps`, (r) => r?.concurrent?.rps, 'higher'],
		[`c${base.concurrency} p99 ms`, (r) => r?.concurrent?.p99, 'lower'],
		['SQL/req', (r) => r?.sqlPerRequest, 'lower'],
		['Redis/req', (r) => r?.redisPerRequest, 'lower']
	];
	for (const [metric, get, better] of rows) {
		const values = runs.map((run) => get(pick(run, name)));
		if (values.every((v) => v === undefined || v === null)) continue;
		const first = values[0];
		const last = values[values.length - 1];
		const change = better === 'lower' ? ratio(first, last) + ' faster' : ratio(last, first) + ' more';
		console.log(`| ${name} | ${metric} | ${values.map((v) => (v ?? '–')).join(' | ')} | ${first && last ? change : ''} |`);
	}
}
