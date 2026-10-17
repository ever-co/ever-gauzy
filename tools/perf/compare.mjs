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

// A generated table: wider than 80 columns, and the lint config both requires (MD041) and forbids (MD043) a
// top-level heading, so lint is off for the whole file.
console.log('<!-- markdownlint-disable -->');
console.log('');
console.log(`# ${runs.map((r) => r.label).join(' vs ')}`);
console.log('');
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
		const factor = better === 'lower' ? first / last : last / first;
		const label = better === 'lower' ? (factor >= 1 ? 'faster' : 'slower') : factor >= 1 ? 'more' : 'less';
		const shown = factor >= 1 ? factor : 1 / factor;
		const change = Number.isFinite(factor) && factor > 0 ? `${shown.toFixed(2)}× ${label}` : '';
		console.log(`| ${name} | ${metric} | ${values.map((v) => (v ?? '–')).join(' | ')} | ${change} |`);
	}
}
