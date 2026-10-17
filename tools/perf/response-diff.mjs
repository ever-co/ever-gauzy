#!/usr/bin/env node
/**
 * Compare the JSON responses of two running API builds endpoint by endpoint (the scenario file of api-bench.mjs),
 * to prove a performance change returns the same data. Volatile values are normalised: presigned URL query strings
 * (signature, date, expiry), `x-correlation-id`, and the login token itself.
 *
 * Both builds run on the same port and env (absolute URLs embed API_BASE_URL), one after the other:
 *   BASE=http://localhost:3999/api PG_URL=... SAVE=baseline.responses.json node tools/perf/response-diff.mjs
 *   BASE=http://localhost:3999/api PG_URL=... AGAINST=baseline.responses.json node tools/perf/response-diff.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const BASE = process.env.BASE || 'http://localhost:3999/api';
const SAVE = process.env.SAVE;
const AGAINST = process.env.AGAINST;
// Optional: write a summary of the comparison (no response bodies) for the benchmark's provenance.
const OUT = process.env.OUT;
const EMAIL = process.env.EMAIL || 'admin@ever.co';
const PASSWORD = process.env.PASSWORD || 'admin';
const scenarioFile = process.argv[2] || 'tools/perf/scenarios.json';
const scenarios = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));

async function context(base) {
	const res = await fetch(`${base}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: EMAIL, password: PASSWORD })
	});
	const text = await res.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = undefined;
	}
	if (!res.ok || !data?.token || !data?.user) {
		throw new Error(`login failed: ${res.status} ${text.slice(0, 300)}`);
	}
	return { token: data.token, user: data.user };
}

async function vars(user) {
	const { Client } = require('pg');
	const c = new Client({ connectionString: process.env.PG_URL });
	await c.connect();
	const org = await c.query(
		`select o.id from organization o left join employee e on e."organizationId" = o.id where o."tenantId" = $1 group by o.id order by count(e.id) desc, min(o."createdAt") limit 1`,
		[user.tenantId]
	);
	const emp = await c.query(`select id from employee where "organizationId" = $1 order by "createdAt" limit 1`, [
		org.rows[0].id
	]);
	await c.end();
	return { tenantId: user.tenantId, userId: user.id, organizationId: org.rows[0].id, employeeId: emp.rows[0]?.id };
}

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);

function normalise(value) {
	if (typeof value === 'string') {
		// A presigned URL changes with every signature; its path is what identifies the object.
		return value.replace(/(https?:\/\/[^\s?"]+)\?[^\s"]*X-Amz-[^\s"]*/g, '$1?<signed>');
	}
	if (Array.isArray(value)) return value.map(normalise);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((k) => [k, k === 'lastLoginAt' || k === 'updatedAt' ? '<volatile>' : normalise(value[k])])
		);
	}
	return value;
}

// Paths of row lists whose order changed in the comparison under way (same rows).
let reordered = new Set();

function firstDifference(a, b, at = '$') {
	if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b))
		return `${at}: ${JSON.stringify(a)?.slice(0, 120)} vs ${JSON.stringify(b)?.slice(0, 120)}`;
	if (Array.isArray(a)) {
		if (a.length !== b.length) return `${at}.length: ${a.length} vs ${b.length}`;
		// Rows carrying an id are matched by id: the API states no order for most lists, so the same rows in
		// another order are the same page (reported as reordered, not as a difference). Duplicate or missing
		// ids are still differences.
		const byId = (rows) =>
			rows.every((r) => r && typeof r === 'object' && typeof r.id === 'string') ? rows : null;
		const rowsA = byId(a);
		const rowsB = byId(b);
		if (rowsA && rowsB && a.length > 0) {
			const idsA = rowsA.map((r) => r.id);
			const idsB = new Map(rowsB.map((r) => [r.id, r]));
			if (new Set(idsA).size !== idsA.length || idsB.size !== rowsB.length) return `${at}: duplicate ids`;
			for (const row of rowsA) {
				if (!idsB.has(row.id)) return `${at}: row ${row.id} missing`;
				const d = firstDifference(row, idsB.get(row.id), `${at}[id=${row.id}]`);
				if (d) return d;
			}
			if (idsA.some((id, i) => rowsB[i].id !== id)) reordered.add(at);
			return null;
		}
		for (let i = 0; i < a.length; i++) {
			const d = firstDifference(a[i], b[i], `${at}[${i}]`);
			if (d) return d;
		}
		return null;
	}
	if (a === null || b === null) {
		return a === b ? null : `${at}: ${JSON.stringify(a)?.slice(0, 120)} vs ${JSON.stringify(b)?.slice(0, 120)}`;
	}
	if (typeof a === 'object') {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const k of keys) {
			const d = firstDifference(a[k], b[k], `${at}.${k}`);
			if (d) return d;
		}
		return null;
	}
	return a === b ? null : `${at}: ${JSON.stringify(a)?.slice(0, 120)} vs ${JSON.stringify(b)?.slice(0, 120)}`;
}

const ctx = await context(BASE);
const v = await vars(ctx.user);
const saved = AGAINST ? JSON.parse(fs.readFileSync(AGAINST, 'utf8')) : {};
const summary = {};
const out = {};
let failures = 0;
for (const ep of scenarios.endpoints) {
	const url = fill(ep.path, v);
	const res = await fetch(BASE + url, {
		headers: {
			...(ep.public ? {} : { authorization: `Bearer ${ctx.token}` }),
			'tenant-id': v.tenantId,
			'organization-id': v.organizationId
		}
	});
	const text = await res.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = text;
	}
	out[ep.name] = { status: res.status, body: normalise(body) };
	if (!AGAINST) continue;
	// Normalised again: a capture saved by an older version of this tool may predate a normalisation rule.
	const ra = saved[ep.name] ? { ...saved[ep.name], body: normalise(saved[ep.name].body) } : undefined;
	const rb = out[ep.name];
	reordered = new Set();
	let diff = !ra
		? 'not in saved file'
		: ra.status !== rb.status
			? `status ${ra.status} vs ${rb.status}`
			: firstDifference(ra.body, rb.body);
	// /health reports uptime and timings that differ by nature; its status code must still match.
	if (diff && ep.name === 'health' && ra && ra.status === rb.status) diff = null;
	const order = !diff && reordered.size ? ` (reordered: ${[...reordered].join(', ')})` : '';
	console.log(`${diff ? 'DIFF' : 'same'}  ${ep.name}${diff ? `  ${diff}` : order}`);
	summary[ep.name] = diff
		? { same: false, firstDifference: diff }
		: { same: true, ...(reordered.size ? { reordered: [...reordered] } : {}) };
	if (diff) failures++;
}
if (OUT && AGAINST) {
	fs.writeFileSync(
		OUT,
		JSON.stringify({ against: path.basename(AGAINST), at: new Date().toISOString(), endpoints: summary }, null, 2)
	);
	console.log(`wrote ${OUT}`);
}
if (SAVE) {
	fs.writeFileSync(SAVE, JSON.stringify(out));
	console.log(`saved ${Object.keys(out).length} responses to ${SAVE}`);
}
process.exit(failures ? 1 : 0);
