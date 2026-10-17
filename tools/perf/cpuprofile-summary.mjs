#!/usr/bin/env node
/**
 * Summarize a V8 .cpuprofile (from `node --cpu-prof`) by self time per function and per package, and by
 * inclusive (total) time per function, so a profile taken under load points at what the API spends CPU on.
 *
 * Usage: node tools/perf/cpuprofile-summary.mjs <file.cpuprofile> [topN=40] [filter-regex]
 *   filter-regex: only count samples whose stack contains a frame whose url or name matches (e.g. "typeorm").
 */
import fs from 'node:fs';

const [, , file, topArg, filterArg] = process.argv;
if (!file) {
	console.error('usage: cpuprofile-summary.mjs <file.cpuprofile> [topN] [filter-regex]');
	process.exit(1);
}
const TOP = Number(topArg || 40);
const filter = filterArg ? new RegExp(filterArg) : null;
const profile = JSON.parse(fs.readFileSync(file, 'utf8'));

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);

// Sample durations: timeDeltas[i] is the time between sample i-1 and i.
const dt = new Map();
const { samples, timeDeltas } = profile;
for (let i = 0; i < samples.length; i++) {
	// Chrome DevTools' convention: a sample stands for the interval up to the NEXT sample. The last sample has no
	// next one, so it counts for nothing rather than repeating its own preceding interval.
	const d = (timeDeltas[i + 1] ?? 0) / 1000; // ms
	dt.set(i, d);
}

function pkgOf(url) {
	if (!url) return '(native/vm)';
	const u = url.replace(/\\/g, '/');
	const nm = u.lastIndexOf('/node_modules/');
	if (nm >= 0) {
		const rest = u.slice(nm + 14).split('/');
		return rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
	}
	if (u.startsWith('node:')) return 'node:' + u.slice(5).split('/')[0];
	if (u.includes('/dist/apps/api/main.js')) return '(api bundle)';
	if (u.includes('/packages/')) return '@gauzy/' + u.split('/packages/')[1].split('/')[0];
	return u.split('/').slice(-2).join('/');
}

function label(n) {
	const cf = n.callFrame;
	const name = cf.functionName || '(anonymous)';
	const url = (cf.url || '').replace(/\\/g, '/');
	const short = url ? url.split('/').slice(-2).join('/') : '';
	return `${name} ${short}:${cf.lineNumber + 1}`;
}

const selfByFn = new Map();
const selfByPkg = new Map();
const totalByFn = new Map();
let total = 0;
let idle = 0;
let gc = 0;

for (let i = 0; i < samples.length; i++) {
	const id = samples[i];
	const d = dt.get(i);
	const n = nodes.get(id);
	const name = n.callFrame.functionName;
	// Build stack
	const stack = [];
	for (let cur = id; cur !== undefined; cur = parent.get(cur)) stack.push(nodes.get(cur));
	if (filter && !stack.some((s) => filter.test(s.callFrame.url || '') || filter.test(s.callFrame.functionName || ''))) continue;
	total += d;
	if (name === '(idle)') {
		idle += d;
		continue;
	}
	if (name === '(garbage collector)') gc += d;
	const l = label(n);
	selfByFn.set(l, (selfByFn.get(l) || 0) + d);
	const p = name === '(garbage collector)' ? '(gc)' : pkgOf(n.callFrame.url);
	selfByPkg.set(p, (selfByPkg.get(p) || 0) + d);
	const seen = new Set();
	for (const s of stack) {
		const sl = label(s);
		if (seen.has(sl)) continue;
		seen.add(sl);
		totalByFn.set(sl, (totalByFn.get(sl) || 0) + d);
	}
}

const busy = total - idle;
if (busy <= 0) {
	console.log(`profile: ${file}
no busy samples${filter ? ` matching ${filter}` : ''} (sampled ${total.toFixed(0)}ms, all idle)`);
	process.exit(0);
}
const fmt = (v) => `${v.toFixed(0).padStart(8)}ms ${((v / busy) * 100).toFixed(1).padStart(5)}%`;
console.log(`profile: ${file}`);
console.log(`sampled ${total.toFixed(0)}ms, idle ${idle.toFixed(0)}ms, busy ${busy.toFixed(0)}ms, gc ${gc.toFixed(0)}ms (${((gc / busy) * 100).toFixed(1)}% of busy)`);
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('\n== self time by package');
for (const [k, v] of top(selfByPkg, 30)) console.log(`${fmt(v)}  ${k}`);
console.log('\n== self time by function');
for (const [k, v] of top(selfByFn, TOP)) console.log(`${fmt(v)}  ${k}`);
console.log('\n== inclusive time by function');
for (const [k, v] of top(totalByFn, TOP)) console.log(`${fmt(v)}  ${k}`);
