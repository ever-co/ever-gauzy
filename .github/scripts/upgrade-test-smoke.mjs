#!/usr/bin/env node
/*
 * The upgrade test's smoke checks (.github/scripts/upgrade-test.sh): the super admin signs in, reads
 * itself over REST, and — on the after image — GraphQL answers and one commerce list resolves.
 *
 * Self-contained (no imports) because the upgrade test pipes it into the after image's Node on stdin.
 *
 * Environment:
 *   BASE_URL        the API, e.g. http://gauzy-upgrade-api:3000
 *   E2E_EMAIL       the super admin's e-mail
 *   E2E_PASSWORD    its password
 *   SMOKE_COMMERCE  "true" adds the GraphQL checks (the before image is develop's: no commerce schema)
 *   SMOKE_GET_PATHS optional, comma-separated GET routes (e.g. of the plugins a boot switched on) that must answer 200
 *   E2E_TIMEOUT_MS  default 30000, per request
 *
 * Prints one PASS/FAIL line per check; exits 0 only when every check passed.
 */
'use strict';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = process.env.E2E_EMAIL || '';
const PASSWORD = process.env.E2E_PASSWORD || '';
const COMMERCE = process.env.SMOKE_COMMERCE === 'true';
const GET_PATHS = (process.env.SMOKE_GET_PATHS || '')
	.split(',')
	.map((path) => path.trim())
	.filter((path) => path.startsWith('/'));
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 30_000);

let failures = 0;

function record(name, ok, detail) {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function call(method, path, { token, tenantId, body } = {}) {
	try {
		const response = await fetch(`${BASE}${path}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(tenantId ? { 'Tenant-Id': tenantId } : {})
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const text = await response.text();
		let json;
		try {
			json = JSON.parse(text);
		} catch {
			json = undefined;
		}
		return { status: response.status, json, text };
	} catch (error) {
		return { status: 0, json: undefined, text: String(error?.message ?? error) };
	}
}

const brief = (response) => `HTTP ${response.status} ${(response.text || '').slice(0, 200)}`;

async function main() {
	const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;
	record(
		'POST /api/auth/login (super admin)',
		login.status < 300 && Boolean(token),
		token ? `HTTP ${login.status}` : brief(login)
	);
	if (!token) return;

	const me = await call('GET', '/api/user/me', { token, tenantId });
	// The payload must be the super admin that signed in (UserController.findMe returns the User row).
	const who = me.json?.email;
	record('GET /api/user/me', me.status === 200 && who === EMAIL, me.status === 200 ? String(who) : brief(me));

	// The routes of the plugins the boot switched on (the upgrade test's gated-plugins boot): each answers 200 to
	// the super admin, so the plugin is loaded, its tables exist and its permissions were granted.
	for (const path of GET_PATHS) {
		const response = await call('GET', path, { token, tenantId });
		record(
			`GET ${path}`,
			response.status === 200,
			`HTTP ${response.status}${response.status === 200 ? '' : ` ${(response.text || '').slice(0, 160)}`}`
		);
	}

	if (!COMMERCE) return;

	const typename = await call('POST', '/graphql', { token, tenantId, body: { query: '{ __typename }' } });
	record(
		'GraphQL { __typename }',
		typename.status === 200 && typename.json?.data?.__typename === 'Query',
		typename.json?.data?.__typename ?? brief(typename)
	);

	const collections = await call('POST', '/graphql', {
		token,
		tenantId,
		body: { query: '{ collections(page: { first: 1 }) { totalCount nodes { id } } }' }
	});
	const total = collections.json?.data?.collections?.totalCount;
	record(
		'GraphQL commerce list: collections',
		collections.status === 200 && typeof total === 'number' && !collections.json?.errors,
		typeof total === 'number'
			? `totalCount ${total}`
			: JSON.stringify(collections.json?.errors ?? collections.text).slice(0, 240)
	);
}

main()
	.then(() => process.exit(failures === 0 ? 0 : 1))
	.catch((error) => {
		console.log(`FAIL  smoke checks could not run  (${error?.message ?? error})`);
		process.exit(1);
	});
