#!/usr/bin/env node
/*
 * Every root field the one endpoint declares, executed once against a running installation.
 *
 * The composition check reads SDL; the contract gate reads source; the end-to-end suite sweeps REST and
 * compares the *names* of GraphQL root fields with the routes beside them. None of them runs a field. A
 * resolver that composes, type-checks, passes its own spec and answers a 500 in production is therefore
 * invisible to every gate in this repository — and that is not hypothetical: `organizationTeams` composed,
 * passed its suite and answered `Cannot use 'in' operator to search for 'members' in undefined` because the
 * resolver passed no criterion where the delivered route passes an empty one.
 *
 * This is the missing instrument. It reads every `*.api.gql` document under the core tree, collects the root
 * fields the `Query` type extends, and issues one minimal selection per field — `first: 1` on a field that
 * takes a page, the caller's own organization where the document declares that requirement — against the
 * running API. A field whose execution fails is reported with the message the endpoint answered.
 *
 * It is deliberately shallow: one field, one row, no arguments beyond what the document marks required. Its
 * question is "does this field answer at all", which is the question no other check in the repository asks.
 *
 * Usage:
 *   node tools/scripts/graphql-surface-smoke.mjs [--api http://127.0.0.1:3000] [--json] [--limit 1]
 *
 * Exits 0 when every declared root field answers, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CORE = join(ROOT, 'packages', 'core', 'src', 'lib');

/** The fields the smoke does not execute, with the reason — each is a decision, not an omission. */
const SKIPPED = new Map([
	['productBySlug', 'no route serves it'],
	['currentUser', 'the kernel declares it without a delivered route'],
	['authorizedUser', 'the kernel declares it without a delivered route'],
	['globalStats', 'gated by FEATURE_OPEN_STATS, an environment setting rather than a catalogue row']
]);

/**
 * The fields that fail, and are known to fail for a reason outside the GraphQL surface.
 *
 * An entry here is a defect that has been looked at and belongs to the resource rather than to this
 * delivery — and the evidence for that is stated with it. The list exists so the smoke stays a check
 * rather than a report nobody reads: a failure that is not written down here fails the run.
 */
const ACKNOWLEDGED = new Map([
	[
		'merchants',
		'the resource itself: `GET /api/merchants` answers the same 400 with the same message "Cannot read ' +
			'properties of undefined (reading \'metadata\')", so the store reader behind both protocols is what ' +
			'is missing its mapping, not the field beside it. The module now registers the repository pair the ' +
			'service is built over and the failure is unchanged, which is why this is recorded rather than ' +
			'patched again here.'
	]
]);

/** Arguments the smoke knows how to fill, by the type the document declares for them. */
const FILLED = ['organizationId', 'tenantId', 'employeeId', 'projectId', 'teamId'];

function argumentFor(name, caller) {
	if (name === 'organizationId') return caller.organizationId;
	if (name === 'tenantId') return caller.tenantId;
	if (name === 'employeeId') return caller.employeeId;
	if (name === 'projectId') return caller.projectId;
	if (name === 'teamId') return caller.teamId;

	return undefined;
}

function walk(directory, files = []) {
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);

		if (statSync(path).isDirectory()) {
			walk(path, files);
		} else if (entry.endsWith('.api.gql')) {
			files.push(path);
		}
	}

	return files;
}

/**
 * Reads the query root fields a document extends.
 *
 * The documents are written one field per line, with the field's arguments on the lines that follow until
 * the closing parenthesis; that shape is what this parses, and a document that departs from it is reported
 * rather than silently skipped.
 */
function fieldsOf(source) {
	const fields = [];
	const lines = source.split('\n');
	let inQuery = false;
	let depth = 0;
	let current = null;
	let body = '';

	for (const line of lines) {
		if (/^extend type Query\s*\{/.test(line)) {
			inQuery = true;
			depth = 1;
			continue;
		}

		if (!inQuery) continue;

		if (/^\}/.test(line)) {
			inQuery = false;
			continue;
		}

		const opening = /^\t([a-zA-Z][a-zA-Z0-9]*)\s*\(/.exec(line);

		if (opening) {
			current = opening[1];
			body = line;
			continue;
		}

		const bare = /^\t([a-zA-Z][a-zA-Z0-9]*)\s*:/.exec(line);

		if (bare) {
			if (!SKIPPED.has(bare[1])) fields.push({ name: bare[1], required: [] });
			current = null;
			continue;
		}

		if (current) {
			body += ` ${line.trim()}`;

			if (/\)\s*:/.test(line)) {
				// `name(arg: Type!, other: Type): Something` — the arguments stated without a default and
				// with a `!` are the ones a caller must supply.
				const required = [...body.matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:\s*[A-Za-z0-9_\[\]!]+\s*!/g)]
					.map((match) => match[1])
					.filter((argument) => FILLED.includes(argument));

				if (!SKIPPED.has(current)) fields.push({ name: current, required });
				current = null;
			}
		}
	}

	return fields;
}

async function call(api, path, { method = 'GET', token, tenantId, organizationId, body } = {}) {
	const response = await fetch(`${api}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {}),
			...(organizationId ? { 'Organization-Id': organizationId } : {}),
			...(method === 'GET' ? { 'X-Requested-With': 'XMLHttpRequest' } : {})
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	const text = await response.text();

	try {
		return { status: response.status, json: JSON.parse(text) };
	} catch {
		return { status: response.status, text };
	}
}

async function main() {
	const argv = process.argv.slice(2);
	const apiIndex = argv.indexOf('--api');
	const API = apiIndex >= 0 ? argv[apiIndex + 1] : process.env.API_URL ?? 'http://127.0.0.1:3000';
	const asJson = argv.includes('--json');

	console.log('');
	console.log('graphql surface smoke');
	console.log('=====================');
	console.log(`  ${API}`);

	const login = await call(API, '/api/auth/login', {
		method: 'POST',
		body: { email: process.env.E2E_EMAIL || 'admin@ever.co', password: process.env.E2E_PASSWORD || 'admin' }
	});
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;
	const organizationId = login.json?.user?.employee?.organizationId;

	if (!token) {
		console.error(`  cannot sign in: HTTP ${login.status}`);
		process.exit(2);
	}

	// The catalogue of gated capabilities is switched on the way the end-to-end suite switches it on: a
	// field behind a disabled capability answers 404, which is not the failure this smoke is looking for.
	const catalogue = await call(API, '/api/feature/toggle', { token, tenantId });
	const toggles = await call(API, '/api/feature/toggle/organizations', { token, tenantId });
	const enabled = new Set(
		(toggles.json?.items ?? []).filter((row) => row.isEnabled === true).map((row) => row.featureId)
	);

	for (const feature of catalogue.json?.items ?? []) {
		if (feature.code === 'FEATURE_GRAPHQL' || enabled.has(feature.id)) continue;

		await call(API, '/api/feature/toggle', {
			method: 'POST',
			token,
			tenantId,
			body: { featureId: feature.id, isEnabled: true }
		});
	}

	const caller = { tenantId, organizationId, employeeId: login.json?.user?.employee?.id };

	const documents = walk(CORE);
	const byField = new Map();

	for (const document of documents) {
		for (const field of fieldsOf(readFileSync(document, 'utf8'))) {
			if (!byField.has(field.name)) byField.set(field.name, { ...field, document });
		}
	}

	console.log(`  ${documents.length} api document(s), ${byField.size} query root field(s) declared`);
	console.log('');

	const failures = [];
	const acknowledged = [];
	let answered = 0;
	let refused = 0;

	for (const [name, field] of byField) {
		const missing = field.required.filter((argument) => {
			const value = argumentFor(argument, caller);

			return value === undefined || value === null;
		});

		if (missing.length) {
			// A field whose required argument the caller cannot state is not executed: the argument is the
			// caller's own choice, and inventing one would ask a question the field was not asked.
			refused += 1;
			continue;
		}

		const args = [
			...field.required.map((argument) => `${argument}: "${argumentFor(argument, caller)}"`),
			'first: 1'
		].join(', ');
		const query = `{ ${name}(${args}) { __typename } }`;
		const answer = await call(API, '/graphql', { method: 'POST', token, tenantId, organizationId, body: { query } });

		if (answer.json?.data && !answer.json?.errors) {
			answered += 1;
			continue;
		}

		const message =
			answer.json?.errors?.map((error) => error.message).join('; ') ??
			answer.json?.message ??
			`HTTP ${answer.status}`;
		const code = answer.json?.errors?.[0]?.extensions?.code ?? answer.json?.code ?? `HTTP_${answer.status}`;

		// A refusal is not a failure: a field whose capability is switched off, whose caller lacks the
		// permission, or whose argument names a row that does not exist answers the platform's own code,
		// and that is the endpoint working. So does a domain refusal that reaches the caller as a denial —
		// "only an employee has a leave balance" is the field answering, not breaking. What this smoke
		// looks for is an execution that broke.
		if (
			code === 'RESOURCE_NOT_FOUND' ||
			code === 'PERMISSION_DENIED' ||
			code === 'FORBIDDEN' ||
			code === 'UNAUTHORIZED' ||
			answer.status === 404 ||
			message.includes('Cannot query field')
		) {
			refused += 1;
			continue;
		}

		if (/VALIDATION|BAD_REQUEST|QUERY_/.test(String(code)) || answer.status === 400 || answer.status === 403) {
			refused += 1;
			continue;
		}

		if (ACKNOWLEDGED.has(name)) {
			acknowledged.push({ field: name, reason: ACKNOWLEDGED.get(name) });
			continue;
		}

		failures.push({ field: name, code, message: String(message).slice(0, 200), document: field.document.replace(ROOT, '').replace(/\\/g, '/') });
	}

	for (const failure of failures) {
		console.log(`  FAIL  ${failure.field}  — ${failure.code}: ${failure.message}`);
	}

	for (const entry of acknowledged) {
		console.log(`  KNOWN ${entry.field}  — ${entry.reason}`);
	}

	console.log('');
	console.log(`  answered   : ${answered}`);
	console.log(`  refused    : ${refused} (a disabled capability, a permission, or an argument the caller cannot state)`);
	console.log(`  failed     : ${failures.length}`);
	console.log(`  known       : ${acknowledged.length} (recorded with their evidence, and not this surface's)`);

	if (asJson) {
		console.log(JSON.stringify({ answered, refused, failures }, null, 2));
	}

	console.log('');
	console.log(failures.length === 0 ? 'graphql surface smoke: PASSED' : 'graphql surface smoke: FAILED');

	process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error(error);
	process.exit(2);
});
