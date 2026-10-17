#!/usr/bin/env node
/**
 * Ever Gauzy API latency / throughput benchmark.
 *
 * Logs in, resolves tenant / organization / employee ids, then for every endpoint in the scenario file:
 *   1. warms up,
 *   2. runs N sequential requests (pure per-request latency, one in flight),
 *   3. runs C concurrent clients for D seconds (throughput + latency under load),
 *   4. optionally counts the SQL statements PostgreSQL executed per request (pg_stat_statements).
 *
 * Dependency-free except `pg` (only when PG_URL is set), resolved from the repo's node_modules.
 *
 * Usage (from the repo root):
 *   BASE=http://localhost:3999/api EMAIL=admin@ever.co PASSWORD=admin \
 *   PG_URL=postgres://postgres:gauzy@localhost:5432/gauzy_perf \
 *   SEQ=200 CONCURRENCY=16 DURATION=10 LABEL=baseline OUT=tools/perf/results/baseline.json \
 *   node tools/perf/api-bench.mjs [tools/perf/scenarios.json]
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const require = createRequire(path.join(process.cwd(), 'package.json'));

const env = process.env;
const BASE = (env.BASE || 'http://localhost:3999/api').replace(/\/$/, '');
const EMAIL = env.EMAIL || 'admin@ever.co';
const PASSWORD = env.PASSWORD || 'admin';
const SEQ = Number(env.SEQ || 200);
const WARMUP = Number(env.WARMUP || 20);
const CONCURRENCY = Number(env.CONCURRENCY || 16);
const DURATION = Number(env.DURATION || 10);
const LABEL = env.LABEL || 'run';
const OUT = env.OUT || '';
const ONLY = env.ONLY ? env.ONLY.split(',') : null;
const PG_URL = env.PG_URL || '';
// Optional: path to redis-cli, to count Redis commands per request (INFO commandstats).
const REDIS_CLI = env.REDIS_CLI || '';
const REDIS_PORT = env.REDIS_PORT || '6379';

function redis(...args) {
	return execFileSync(REDIS_CLI, ['-p', REDIS_PORT, ...args], { encoding: 'utf8' });
}

function redisReset() {
	if (REDIS_CLI) redis('CONFIG', 'RESETSTAT');
}

function redisCalls() {
	if (!REDIS_CLI) return null;
	const out = redis('INFO', 'commandstats');
	const byCommand = {};
	let total = 0;
	for (const line of out.split(/\r?\n/)) {
		const m = /^cmdstat_([^:]+):calls=(\d+)/.exec(line);
		if (!m || ['info', 'config', 'ping'].includes(m[1])) continue;
		byCommand[m[1]] = Number(m[2]);
		total += Number(m[2]);
	}
	return { total, byCommand };
}
const scenarioFile = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'scenarios.json');

const baseUrl = new URL(BASE);
const lib = baseUrl.protocol === 'https:' ? https : http;
const agent = new lib.Agent({ keepAlive: true, maxSockets: Math.max(CONCURRENCY, 1) });

function request(method, urlPath, { headers = {}, body } = {}) {
	return new Promise((resolve) => {
		const started = performance.now();
		const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
		const req = lib.request(
			{
				method,
				hostname: baseUrl.hostname,
				port: baseUrl.port,
				path: baseUrl.pathname.replace(/\/$/, '') + urlPath,
				agent,
				headers: {
					accept: 'application/json',
					...(payload ? { 'content-type': 'application/json', 'content-length': payload.length } : {}),
					...headers
				}
			},
			(res) => {
				const chunks = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					const ms = performance.now() - started;
					const buf = Buffer.concat(chunks);
					resolve({ status: res.statusCode, ms, bytes: buf.length, body: buf });
				});
			}
		);
		req.on('error', (error) => resolve({ status: 0, ms: performance.now() - started, bytes: 0, error }));
		req.setTimeout(120_000, () => req.destroy(new Error('timeout')));
		if (payload) req.write(payload);
		req.end();
	});
}

function pct(sorted, p) {
	if (!sorted.length) return NaN;
	const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[i];
}

function stats(samples) {
	const s = [...samples].sort((a, b) => a - b);
	const sum = s.reduce((a, b) => a + b, 0);
	const r = (x) => Math.round(x * 100) / 100;
	return { n: s.length, mean: r(sum / (s.length || 1)), p50: r(pct(s, 50)), p90: r(pct(s, 90)), p99: r(pct(s, 99)), min: r(s[0]), max: r(s[s.length - 1]) };
}

function fill(template, vars) {
	return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

let pg = null;
async function pgClient() {
	if (!PG_URL) return null;
	if (pg) return pg;
	const { Client } = require('pg');
	pg = new Client({ connectionString: PG_URL });
	await pg.connect();
	return pg;
}

async function pgReset() {
	const c = await pgClient();
	if (!c) return;
	await c.query('select pg_stat_statements_reset()');
}

async function pgCalls() {
	const c = await pgClient();
	if (!c) return null;
	const { rows } = await c.query(
		`select coalesce(sum(calls),0)::bigint as calls, coalesce(sum(total_exec_time),0) as ms
		   from pg_stat_statements
		  where dbid = (select oid from pg_database where datname = current_database())
		    and query not ilike '%pg_stat_statements%'`
	);
	return { calls: Number(rows[0].calls), ms: Number(rows[0].ms) };
}

async function resolveContext() {
	const login = await request('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	if (login.status >= 300 || login.status === 0) throw new Error(`login failed: ${login.status} ${login.error?.message ?? login.body}`);
	const data = JSON.parse(login.body.toString());
	const token = data.token;
	const user = data.user;
	const vars = { tenantId: user.tenantId, userId: user.id, employeeId: user.employee?.id || user.employeeId || '' };
	const c = await pgClient();
	if (c) {
		// The organization with the most employees, so list endpoints return real pages.
		const org = await c.query(
			`select o.id from organization o left join employee e on e."organizationId" = o.id
			  where o."tenantId" = $1 group by o.id order by count(e.id) desc, min(o."createdAt") limit 1`,
			[user.tenantId]
		);
		vars.organizationId = org.rows[0]?.id;
		if (!vars.employeeId) {
			const emp = await c.query(`select id from employee where "tenantId" = $1 and "organizationId" = $2 order by "createdAt" limit 1`, [user.tenantId, vars.organizationId]);
			vars.employeeId = emp.rows[0]?.id;
		}
		const proj = await c.query(`select id from organization_project where "organizationId" = $1 limit 1`, [vars.organizationId]);
		vars.projectId = proj.rows[0]?.id || '';
	} else {
		vars.organizationId = env.ORGANIZATION_ID;
	}
	return { token, vars };
}

async function runEndpoint(ep, ctx) {
	const headers = { ...(ep.public ? {} : { authorization: `Bearer ${ctx.token}` }), 'tenant-id': ctx.vars.tenantId, 'organization-id': ctx.vars.organizationId };
	const url = fill(ep.path, ctx.vars);
	const method = ep.method || 'GET';
	const body = ep.body ? JSON.parse(fill(JSON.stringify(ep.body), ctx.vars)) : undefined;

	// Warm up and sanity check
	let first;
	for (let i = 0; i < WARMUP; i++) {
		const r = await request(method, url, { headers, body });
		if (i === 0) first = r;
	}
	if (!first || first.status >= 400 || first.status === 0) {
		return { name: ep.name, url, error: `status ${first?.status} ${first?.error?.message || first?.body?.toString().slice(0, 300)}` };
	}

	// Sequential latency + SQL statements per request
	await pgReset();
	redisReset();
	const seq = [];
	const seqStatus = {};
	for (let i = 0; i < SEQ; i++) {
		const r = await request(method, url, { headers, body });
		seq.push(r.ms);
		seqStatus[r.status] = (seqStatus[r.status] || 0) + 1;
	}
	const sql = await pgCalls();
	const rds = redisCalls();

	// Concurrent throughput
	const conc = [];
	const concStatus = {};
	const deadline = performance.now() + DURATION * 1000;
	const t0 = performance.now();
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (performance.now() < deadline) {
				const r = await request(method, url, { headers, body });
				conc.push(r.ms);
				concStatus[r.status] = (concStatus[r.status] || 0) + 1;
			}
		})
	);
	const elapsed = (performance.now() - t0) / 1000;

	return {
		name: ep.name,
		url,
		bytes: first.bytes,
		sequential: { ...stats(seq), status: seqStatus },
		sqlPerRequest: sql ? Math.round((sql.calls / SEQ) * 100) / 100 : null,
		sqlMsPerRequest: sql ? Math.round((sql.ms / SEQ) * 100) / 100 : null,
		redisPerRequest: rds ? Math.round((rds.total / SEQ) * 100) / 100 : null,
		redisCommands: rds ? rds.byCommand : null,
		concurrent: { concurrency: CONCURRENCY, seconds: Math.round(elapsed * 100) / 100, rps: Math.round((conc.length / elapsed) * 10) / 10, ...stats(conc), status: concStatus }
	};
}

async function main() {
	const scenarios = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
	const ctx = await resolveContext();
	console.log(`[${LABEL}] base=${BASE} tenant=${ctx.vars.tenantId} org=${ctx.vars.organizationId} employee=${ctx.vars.employeeId} seq=${SEQ} c=${CONCURRENCY} d=${DURATION}s`);
	const results = [];
	for (const ep of scenarios.endpoints) {
		if (ONLY && !ONLY.includes(ep.name)) continue;
		const r = await runEndpoint(ep, ctx);
		results.push(r);
		if (r.error) {
			console.log(`  ${ep.name.padEnd(28)} ERROR ${r.error}`);
		} else {
			console.log(
				`  ${ep.name.padEnd(28)} seq p50 ${String(r.sequential.p50).padStart(8)}ms p90 ${String(r.sequential.p90).padStart(8)}ms | sql/req ${String(r.sqlPerRequest ?? '-').padStart(6)} redis/req ${String(r.redisPerRequest ?? '-').padStart(5)} | c${CONCURRENCY} ${String(r.concurrent.rps).padStart(7)} rps p50 ${String(r.concurrent.p50).padStart(8)}ms p99 ${String(r.concurrent.p99).padStart(8)}ms | ${r.bytes}B`
			);
		}
	}
	if (OUT) {
		fs.mkdirSync(path.dirname(OUT), { recursive: true });
		fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, base: BASE, seq: SEQ, concurrency: CONCURRENCY, duration: DURATION, at: new Date().toISOString(), results }, null, 2));
		console.log(`wrote ${OUT}`);
	}
	if (pg) await pg.end();
	agent.destroy();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
