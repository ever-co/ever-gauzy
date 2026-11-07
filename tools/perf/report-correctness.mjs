// Correctness snapshot / diff harness for the report endpoints behind Ever Teams' Apps & URLs, Time & Activity,
// Timesheet and weekly report pages (and the Gauzy timesheet reports). These reports pay salaries: a change to them
// ships only when the responses captured before and after it are identical.
//   node tools/perf/report-correctness.mjs capture <label>        -> every case's response under tools/perf/correctness/<label>/
//   node tools/perf/report-correctness.mjs diff <labelA> <labelB> -> compares the two captures case by case (deep, order-sensitive)
// Env: BASE (default http://localhost:3000/api), EMAIL / PASSWORD (admin@ever.co / admin), ANCHOR (the fixed "today" the
// date ranges are built from, so a later capture asks the same days), ONLY=name,name (some endpoints only, added to an
// existing capture). Diff: SORT_SLOTS=1 compares each log's `timeSlots` list as a set (the joins returned it in index
// order, the figures query in startedAt order); IGNORE_KEYS=lastLoginAt,updatedAt drops fields the capture's own
// sign-in changes on the admin user (an employee the activity report embeds).
// Cases: a base request per endpoint, each filter dimension varied one at a time, plus 24 seeded random combinations;
// 17 endpoints × 48 cases = 816 responses per capture (the captures are git-ignored).
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE || 'http://localhost:3000/api';
const [mode, labelA, labelB] = process.argv.slice(2);

// SORT_SLOTS=1 orders every `timeSlots` list by slot id before comparing: the list is a set (the joins returned it in
// index order, the figures query in startedAt order), its numbers are what the reports average.
const sortSlots = process.env.SORT_SLOTS === '1';
// IGNORE_KEYS=lastLoginAt,updatedAt drops fields the environment changes between captures (the capture's own sign-in
// updates the admin user's lastLoginAt / updatedAt, and that user is an employee the activity report embeds).
const ignoreKeys = new Set((process.env.IGNORE_KEYS || '').split(',').filter(Boolean));
function canonical(value, key) {
	if (Array.isArray(value)) {
		const items = value.map((item) => canonical(item));
		if (sortSlots && key === 'timeSlots') items.sort((a, b) => String(a?.id).localeCompare(String(b?.id)));
		return items;
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.filter((k) => !ignoreKeys.has(k))
				.sort()
				.map((k) => [k, canonical(value[k], k)])
		);
	}
	return value;
}

function diff(a, b, path = '$', out = []) {
	if (out.length > 20) return out;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) out.push(`${path}: array length ${a.length} vs ${b.length}`);
		for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
		return out;
	}
	if (a && b && typeof a === 'object' && typeof b === 'object') {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const k of keys) {
			if (!(k in a)) out.push(`${path}.${k}: missing in A`);
			else if (!(k in b)) out.push(`${path}.${k}: missing in B`);
			else diff(a[k], b[k], `${path}.${k}`, out);
		}
		return out;
	}
	if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
	return out;
}

if (mode === 'diff') {
	const dirA = join(here, 'correctness', labelA);
	const dirB = join(here, 'correctness', labelB);
	const files = readdirSync(dirA).filter((f) => f.endsWith('.json') && f !== '_meta.json');
	let same = 0;
	let different = 0;
	let missing = 0;
	for (const f of files) {
		const pb = join(dirB, f);
		if (!existsSync(pb)) {
			missing++;
			console.log(`MISSING in ${labelB}: ${f}`);
			continue;
		}
		const a = JSON.parse(readFileSync(join(dirA, f), 'utf8'));
		const b = JSON.parse(readFileSync(pb, 'utf8'));
		const d = diff(canonical(a.body), canonical(b.body));
		if (a.status !== b.status) d.unshift(`status ${a.status} vs ${b.status}`);
		if (d.length) {
			different++;
			console.log(`DIFF ${f}\n  ${d.slice(0, 8).join('\n  ')}`);
		} else same++;
	}
	console.log(`\n${same} identical, ${different} different, ${missing} missing (of ${files.length})`);
	process.exit(different || missing ? 1 : 0);
}

// ---- capture ----
const login = await fetch(`${base}/auth/login`, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({ email: process.env.EMAIL || 'admin@ever.co', password: process.env.PASSWORD || 'admin' })
}).then((r) => r.json());
if (!login.token) throw new Error('login failed ' + JSON.stringify(login).slice(0, 200));
const { token, user } = login;
const tenantId = user.tenantId;
const headers = { authorization: `Bearer ${token}`, 'tenant-id': tenantId };
const get = (path) => fetch(base + path, { headers }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const orgs = await get(`/organization?${new URLSearchParams({ 'where[tenantId]': tenantId })}`);
const organizationId = user.employee?.organizationId || orgs.body.items[0].id;
const employees = (await get(`/employee/pagination?${new URLSearchParams({ 'where[organizationId]': organizationId, 'where[tenantId]': tenantId, take: '50' })}`)).body.items ?? [];
const teams = (await get(`/organization-team?${new URLSearchParams({ 'where[organizationId]': organizationId, 'where[tenantId]': tenantId })}`)).body.items ?? [];
const projects = (await get(`/organization-projects?${new URLSearchParams({ 'where[organizationId]': organizationId, 'where[tenantId]': tenantId })}`)).body.items ?? [];
const employeeIds = employees.map((e) => e.id).sort();
const teamIds = teams.map((t) => t.id).sort();
const projectIds = projects.map((p) => p.id).sort();
console.log(`base=${base} org=${organizationId} employees=${employeeIds.length} teams=${teamIds.length} projects=${projectIds.length}`);

// Date anchors: a fixed "today" so a capture hours later asks the same days
const anchor = new Date(process.env.ANCHOR || '2026-11-07T12:00:00.000Z');
function range(days, offsetDays = 0) {
	const end = new Date(anchor);
	end.setUTCDate(end.getUTCDate() - offsetDays);
	end.setUTCHours(23, 59, 59, 999);
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - (days - 1));
	start.setUTCHours(0, 0, 0, 0);
	return { startDate: start.toISOString(), endDate: end.toISOString() };
}
const dims = {
	range: [range(7), range(1), range(31), range(92), range(14, 30)],
	timeZone: ['Europe/Kyiv', 'Etc/UTC', 'America/Los_Angeles', 'Asia/Kolkata'],
	activityLevel: [
		{ start: 0, end: 100 },
		{ start: 20, end: 80 },
		{ start: 60, end: 100 },
		{ start: 0, end: 30 },
		null
	],
	logType: [['TRACKED'], ['TRACKED', 'MANUAL'], ['MANUAL'], null],
	employeeIds: [null, employeeIds.slice(0, 1), employeeIds.slice(1, 4), employeeIds.slice(0, 12)],
	teamIds: [null, teamIds.slice(0, 1), teamIds.slice(0, 3)],
	projectIds: [null, projectIds.slice(0, 1), projectIds.slice(0, 5)],
	source: [null, ['DESKTOP'], ['WEB_TIMER', 'DESKTOP']]
};
const endpoints = {
	'daily-date': { path: '/timesheet/time-log/report/daily', extra: { groupBy: 'date' } },
	'daily-employee': { path: '/timesheet/time-log/report/daily', extra: { groupBy: 'employee' } },
	'daily-project': { path: '/timesheet/time-log/report/daily', extra: { groupBy: 'project' } },
	'daily-client': { path: '/timesheet/time-log/report/daily', extra: { groupBy: 'client' } },
	'daily-date-without-team': { path: '/timesheet/time-log/report/daily', extra: { groupBy: 'date', includeTimeWithoutTeam: 'true' } },
	'daily-chart': { path: '/timesheet/time-log/report/daily-chart', extra: {} },
	weekly: { path: '/timesheet/time-log/report/weekly', extra: {} },
	'owed-amount': { path: '/timesheet/time-log/report/owed-amount', extra: {} },
	'statistics-counts': { path: '/timesheet/statistics/counts', extra: {} },
	'activity-report': { path: '/timesheet/activity/report', extra: { groupBy: 'date' } },
	'activity-daily-app': { path: '/timesheet/activity/daily', extra: { 'types[0]': 'APP' } },
	'activity-daily-url': { path: '/timesheet/activity/daily', extra: { 'types[0]': 'URL' } },
	'time-logs': { path: '/timesheet/time-log', extra: {} },
	'owed-report': { path: '/timesheet/time-log/report/owed-report', extra: {} },
	'owed-charts': { path: '/timesheet/time-log/report/owed-charts', extra: {} },
	'time-limit-day': { path: '/timesheet/time-log/time-limit', extra: { duration: 'day' } },
	'time-limit-week': { path: '/timesheet/time-log/time-limit', extra: { duration: 'week' } }
};
// ONLY=name,name limits a capture to some endpoints (added to an existing capture directory)
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

function query(pick, extra) {
	const params = new URLSearchParams({ organizationId, tenantId, ...pick.range, timeZone: pick.timeZone, ...extra });
	if (pick.activityLevel) {
		params.set('activityLevel[start]', String(pick.activityLevel.start));
		params.set('activityLevel[end]', String(pick.activityLevel.end));
	}
	const list = (key, values) => (values ?? []).forEach((v, i) => params.set(`${key}[${i}]`, v));
	list('logType', pick.logType);
	list('employeeIds', pick.employeeIds);
	list('teamIds', pick.teamIds);
	list('projectIds', pick.projectIds);
	list('source', pick.source);
	return params.toString();
}

// Seeded PRNG (mulberry32), so every capture asks the same random combinations
let seed = 20261107;
const rnd = () => ((seed = (seed + 0x6d2b79f5) | 0), (((Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x9e3779b9) ^ 0) >>> 0) / 4294967296);
const basePick = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, v[0]]));
const cases = [{ name: 'base', pick: basePick }];
for (const [dim, values] of Object.entries(dims)) {
	values.forEach((value, i) => {
		if (i === 0) return;
		cases.push({ name: `${dim}-${i}`, pick: { ...basePick, [dim]: value } });
	});
}
for (let i = 0; i < 24; i++) {
	const pick = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, v[Math.floor(rnd() * v.length)]]));
	cases.push({ name: `random-${i}`, pick });
}

const outDir = join(here, 'correctness', labelA || 'capture');
mkdirSync(outDir, { recursive: true });
let n = 0;
const t0 = performance.now();
const timings = {};
for (const [epName, ep] of Object.entries(endpoints)) {
	if (only && !only.has(epName)) continue;
	for (const c of cases) {
		const path = `${ep.path}?${query(c.pick, ep.extra)}`;
		const t = performance.now();
		const r = await get(path);
		const ms = Math.round(performance.now() - t);
		(timings[epName] ??= []).push(ms);
		writeFileSync(join(outDir, `${epName}__${c.name}.json`), JSON.stringify({ path, status: r.status, body: r.body }));
		n++;
	}
	const ts = timings[epName].sort((a, b) => a - b);
	console.log(`${epName.padEnd(26)} ${cases.length} cases  p50 ${ts[Math.floor(ts.length / 2)]} ms  max ${ts[ts.length - 1]} ms`);
}
if (!only) writeFileSync(join(outDir, '_meta.json'), JSON.stringify({ base, organizationId, cases: cases.length, endpoints: Object.keys(endpoints), timings, took: Math.round(performance.now() - t0) }, null, 2));
console.log(`captured ${n} responses to ${outDir} in ${Math.round((performance.now() - t0) / 1000)}s`);
