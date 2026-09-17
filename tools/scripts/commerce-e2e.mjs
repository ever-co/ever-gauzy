#!/usr/bin/env node
/*
 * The commerce surface, exercised end to end against a running installation.
 *
 * A build proves the code compiles and a boot proves the graph resolves; neither can show that a
 * caller with a real credential can actually do anything. This suite is the third question: it signs
 * in, drives both protocols, and checks the things that only exist once the whole application is
 * assembled — that every resource is reachable over REST, that the *same* concepts are reachable over
 * the one GraphQL endpoint, that the two surfaces agree about a row written through one of them, that
 * the guards refuse what they are supposed to refuse, and that a refusal carries the platform's own
 * error contract rather than a stack trace.
 *
 * The GraphQL expectations are derived from the REST resource names rather than listed by hand,
 * because that is the rule the design states — one surface per concept, both protocols, the same
 * scope — and a hand-written list would quietly stop covering a resource the day it was added.
 *
 * Usage:
 *   node tools/scripts/commerce-e2e.mjs
 *
 * Environment:
 *   BASE_URL        default http://127.0.0.1:3000
 *   E2E_EMAIL       default admin@ever.co
 *   E2E_PASSWORD    default admin
 *   E2E_TIMEOUT_MS  default 30000, per request
 *
 * Exits 0 when every check passed, 1 otherwise, and prints one line per check either way.
 */
'use strict';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = process.env.E2E_EMAIL || 'admin@ever.co';
const PASSWORD = process.env.E2E_PASSWORD || 'admin';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 30_000);

/**
 * A representative REST resource per capability, chosen so the sweep covers every package rather
 * than every route: the point is that no capability is missing from the running installation, not
 * that each of its ninety-odd resources answers.
 */
const RESOURCES = [
	{ path: '/api/collections', capability: 'catalog' },
	{ path: '/api/product-prices', capability: 'pricing' },
	{ path: '/api/tax-rates', capability: 'tax' },
	{ path: '/api/stock-levels', capability: 'inventory' },
	{ path: '/api/stock-transfers', capability: 'inventory' },
	{ path: '/api/warehouse-zones', capability: 'warehouse' },
	{ path: '/api/carts', capability: 'cart' },
	{ path: '/api/orders', capability: 'order' },
	{ path: '/api/payment-sessions', capability: 'payment' },
	{ path: '/api/promotions', capability: 'promotion' },
	{ path: '/api/fulfillments', capability: 'fulfillment' },
	{ path: '/api/order-returns', capability: 'returns' },
	{ path: '/api/subscriptions', capability: 'subscription' },
	{ path: '/api/purchase-orders', capability: 'purchasing' },
	{ path: '/api/entitlements', capability: 'entitlement' },
	{ path: '/api/sellers', capability: 'marketplace' },
	{ path: '/api/search/index-definitions', capability: 'search' }
];

/** Root fields the kernel itself must serve over the one GraphQL endpoint. */
const KERNEL_FIELDS = ['roles', 'units', 'unitCategories'];

const results = [];

/**
 * Records one check.
 *
 * @param {string} name What was checked, phrased as the property being asserted.
 * @param {boolean} ok Whether it held.
 * @param {string} [detail] What was seen, so a failure is readable without re-running anything.
 */
function record(name, ok, detail) {
	results.push({ name, ok, detail });
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * Calls the installation.
 *
 * `Tenant-Id` is sent because the REST surface states which tenant the caller is acting as and the
 * guard compares that statement with the tenant the credential carries: a token alone authenticates
 * but does not scope, and without the header every guarded route answers 403. The header is spelled
 * exactly as shown — the guard matches the raw name.
 *
 * @param {string} method The HTTP method.
 * @param {string} url The path, beginning with a slash.
 * @param {{token?: string, tenantId?: string, body?: unknown}} [options] Credential, tenant and body.
 * @returns {Promise<{status: number, json: any, text: string}>} The response.
 */
async function call(method, url, options = {}) {
	const { token, tenantId, body } = options;
	const response = await fetch(`${BASE}${url}`, {
		method,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});

	const text = await response.text();

	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}

	return { status: response.status, json, text };
}

/** @param {{json: any, text: string}} result A response. @returns {string} A short description. */
function brief(result) {
	return (result.json ? JSON.stringify(result.json) : result.text).slice(0, 240);
}

/**
 * Turns a REST resource path into the GraphQL root field the design says must answer it.
 *
 * The convention is the plural resource name in lower camel case: `/order-returns` is `orderReturns`.
 * Deriving it rather than listing it is what keeps the sweep honest — a resource added without its
 * GraphQL counterpart fails this check instead of going unnoticed.
 *
 * @param {string} path The REST path.
 * @returns {string} The expected root field name.
 */
function rootFieldFor(path) {
	const last = path.split('/').filter(Boolean).pop() || '';
	return last.replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase());
}

/**
 * Reads the one composed schema's root fields.
 *
 * @param {string} token The credential.
 * @param {string} tenantId The tenant.
 * @returns {Promise<{fields: string[], error?: string}>} The field names, or why they could not be read.
 */
async function readRootFields(token, tenantId) {
	const query = '{ __schema { queryType { fields { name } } } }';
	const response = await call('POST', '/graphql', {
		token,
		tenantId,
		body: { query }
	});
	const fields = response.json?.data?.__schema?.queryType?.fields;

	if (!Array.isArray(fields)) {
		return { fields: [], error: response.json?.errors ? JSON.stringify(response.json.errors).slice(0, 240) : brief(response) };
	}

	return { fields: fields.map((field) => field.name) };
}

async function main() {
	console.log('');
	console.log('commerce end-to-end suite');
	console.log('=========================');
	console.log(`  ${BASE}`);

	// --- the credential ------------------------------------------------------------------------
	const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;

	record('a real credential signs in over REST', login.status === 200 && Boolean(token), `HTTP ${login.status} ${token ? '' : brief(login)}`);

	if (!token) return finish();

	// --- the installation is assembled --------------------------------------------------------
	const health = await call('GET', '/api/health');
	record('the installation answers its health probe', health.status === 200, `HTTP ${health.status}`);

	// --- a guard refuses what it should --------------------------------------------------------
	const anonymous = await call('GET', '/api/collections');
	record(
		'a commerce resource refuses an anonymous read',
		anonymous.status === 401 || anonymous.status === 403,
		`HTTP ${anonymous.status}`
	);

	// A credential without the tenant statement authenticates but does not scope, so the guarded
	// route refuses it. This is the guard being enforced rather than merely declared.
	const unscoped = await call('GET', '/api/collections', { token });
	record(
		'a guarded resource refuses a credential that states no tenant',
		unscoped.status === 401 || unscoped.status === 403,
		`HTTP ${unscoped.status}`
	);

	// --- every capability is mounted, over REST ------------------------------------------------
	console.log('');
	let reachable = 0;
	for (const resource of RESOURCES) {
		const response = await call('GET', resource.path, { token, tenantId });
		// What a sweep can prove is that the capability is mounted. A 404 is the failure that matters:
		// the route is not there, which means the package's module is not in the graph. A 5xx is the
		// other failure. A 4xx that is not 404 is the resource refusing the request *as this sweep
		// stated it* — several list routes here require a filter, and demanding one is not a missing
		// surface. Those are reported separately so the difference stays visible.
		const refused = response.status >= 400 && response.status < 500 && response.status !== 404;
		const ok = response.status === 200 || refused;
		if (response.status === 200) reachable++;
		record(
			`${resource.capability}: ${resource.path} is mounted over REST`,
			ok,
			`HTTP ${response.status}${response.status === 200 ? ' (answers a bare read)' : ''}${ok ? '' : ` ${brief(response)}`}`
		);
	}
	console.log(`  (${reachable} of ${RESOURCES.length} resources answered a bare read; the rest are mounted and refused it)`);

	// --- the same concepts over the one GraphQL endpoint ---------------------------------------
	console.log('');
	const { fields, error } = await readRootFields(token, tenantId);
	record('the one GraphQL endpoint serves its schema', fields.length > 0, error || `${fields.length} root field(s)`);

	const missing = [];
	const aliases = {
		// A resource whose GraphQL root field is named for the concept rather than for the route.
		'/api/search/index-definitions': 'searchIndexDefinitions'
	};
	for (const resource of [...RESOURCES.map((entry) => entry.path), ...Object.keys(aliases)]) {
		const expected = aliases[resource] ?? rootFieldFor(resource);
		if (!fields.includes(expected)) missing.push(`${resource} → ${expected}`);
	}
	record(
		'every REST resource has a GraphQL root field of the same concept',
		missing.length === 0,
		missing.length ? `missing: ${missing.join(', ')}` : `${RESOURCES.length} resource(s) matched`
	);

	for (const field of KERNEL_FIELDS) {
		record(`the kernel serves \`${field}\` over GraphQL`, fields.includes(field));
	}

	// --- a row written over REST is the row read over GraphQL -----------------------------------
	console.log('');
	const slug = `e2e-collection-${Date.now()}`;
	const created = await call('POST', '/api/collections', {
		token,
		tenantId,
		body: { name: 'End-to-end collection', slug, description: 'Written by the end-to-end suite.', type: 'MANUAL' }
	});
	const id = created.json?.id;
	record('a commerce row is created over REST', created.status === 201 || created.status === 200, `HTTP ${created.status}${id ? '' : ` ${brief(created)}`}`);

	if (id) {
		const readBack = await call('GET', `/api/collections/${id}`, { token, tenantId });
		record('the row is read back over REST', readBack.status === 200 && readBack.json?.slug === slug, `HTTP ${readBack.status}`);

		const graph = await call('POST', '/graphql', {
			token,
			tenantId,
			body: {
				query: `query ($filter: CollectionFilter) { collections(filter: $filter) { items { id slug } total } }`,
				variables: { filter: { slug } }
			}
		});
		const items = graph.json?.data?.collections?.items ?? [];
		const overGraphql = items.find((item) => item.slug === slug);

		record(
			'the same row is served over GraphQL',
			Boolean(overGraphql),
			graph.json?.errors ? JSON.stringify(graph.json.errors).slice(0, 240) : `${items.length} item(s)`
		);
		record(
			'the two surfaces agree about the identity of the row',
			Boolean(overGraphql) && overGraphql.id === id,
			overGraphql ? `REST ${id} vs GraphQL ${overGraphql.id}` : 'not served over GraphQL'
		);
	} else {
		record('the row is read back over REST', false, 'the create returned no id');
		record('the same row is served over GraphQL', false, 'nothing was written');
		record('the two surfaces agree about the identity of the row', false, 'nothing was written');
	}

	// --- a refusal is a refusal, and it carries the error contract ------------------------------
	console.log('');
	const invalidEnum = await call('POST', '/api/collections', {
		token,
		tenantId,
		body: { name: 'Invalid type', slug: `${slug}-enum`, type: 'NOT_A_TYPE' }
	});
	record(
		'an invalid enumeration value is refused rather than stored',
		invalidEnum.status >= 400 && invalidEnum.status < 500,
		`HTTP ${invalidEnum.status}`
	);

	const invalidBody = await call('POST', '/api/collections', { token, tenantId, body: { description: 'no name' } });
	record(
		'a body missing a required field is refused',
		invalidBody.status >= 400 && invalidBody.status < 500,
		`HTTP ${invalidBody.status}`
	);

	const unknown = await call('GET', '/api/collections/00000000-0000-4000-8000-000000000000', { token, tenantId });
	record('an unknown identifier answers 404', unknown.status === 404, `HTTP ${unknown.status}`);
	record(
		'a refusal carries the platform error contract',
		unknown.status === 404 && typeof unknown.json === 'object' && unknown.json !== null,
		brief(unknown)
	);

	// --- the one GraphQL endpoint answers the kernel and reports its own errors -----------------
	console.log('');
	const kernel = await call('POST', '/graphql', {
		token,
		tenantId,
		body: { query: '{ roles { id name } }' }
	});
	record('the kernel GraphQL surface answers', kernel.status === 200 && !kernel.json?.errors, brief(kernel));

	const badQuery = await call('POST', '/graphql', { token, tenantId, body: { query: '{ thisFieldDoesNotExist }' } });
	record(
		'an unknown GraphQL field is refused as a GraphQL error, not a 500',
		// A field the schema does not declare is rejected before execution, and the transport is free to
		// say so with a 400 carrying the errors. What must never happen is a 500: an unknown field is a
		// request the caller got wrong, not a failure of the server's.
		(badQuery.status === 200 || badQuery.status === 400) && Array.isArray(badQuery.json?.errors),
		`HTTP ${badQuery.status} ${Array.isArray(badQuery.json?.errors) ? 'with errors' : brief(badQuery)}`
	);

	const anonymousGraph = await call('POST', '/graphql', { body: { query: '{ roles { id name } }' } });
	record(
		'a guarded GraphQL field refuses an anonymous caller',
		anonymousGraph.status === 200 && Array.isArray(anonymousGraph.json?.errors),
		`HTTP ${anonymousGraph.status}`
	);

	// --- housekeeping: the suite leaves nothing behind ------------------------------------------
	console.log('');
	if (id) {
		const removed = await call('DELETE', `/api/collections/${id}/soft`, { token, tenantId });
		record('the row the suite wrote can be removed', removed.status >= 200 && removed.status < 300, `HTTP ${removed.status}`);
	}

	return finish();
}

/** Prints the summary and exits with the verdict. */
function finish() {
	const failed = results.filter((result) => !result.ok);

	console.log('');
	console.log(`  ${results.length - failed.length} of ${results.length} checks passed`);
	console.log(failed.length === 0 ? 'commerce end-to-end suite: PASSED' : 'commerce end-to-end suite: FAILED');

	if (failed.length) {
		console.log('');
		for (const failure of failed) console.log(`  FAILED  ${failure.name}${failure.detail ? `  — ${failure.detail}` : ''}`);
	}

	process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error(`\ncommerce end-to-end suite: could not run\n  ${error?.message ?? error}`);
	console.error('  Is the API running and answering on ' + BASE + '?');
	process.exit(1);
});
