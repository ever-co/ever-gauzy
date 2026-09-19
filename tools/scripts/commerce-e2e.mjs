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
	// The variant list is read because it is the one resource of the catalogue that is *mounted and
	// unreadable*: it asked for a relation named `settings` where the entity declares `setting`, so every
	// call answered `500`. A sweep that only checks that a resource is mounted does not see that, which is
	// why the list is read here rather than only the products it hangs from.
	{ path: '/api/product-variants', capability: 'catalog' },
	// The rest of the catalogue's own resources, read for the same reason: each is a capability the
	// catalogue's GraphQL surface must answer for, and a resource that is mounted but cannot be read is
	// invisible to a sweep that only looks for a route.
	{ path: '/api/products', capability: 'catalog' },
	{ path: '/api/product-categories', capability: 'catalog' },
	{ path: '/api/product-types', capability: 'catalog' },
	{ path: '/api/product-options', capability: 'catalog' },
	{ path: '/api/product-variant-price', capability: 'catalog' },
	{ path: '/api/product-variant-settings', capability: 'catalog' },
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
	{ path: '/api/search/index-definitions', capability: 'search' },
	// The party-data kernel the commerce packages target: a group is what a price list, a promotion and a
	// shipping rule are addressed to, so the resource is swept here rather than assumed.
	{ path: '/api/contact-groups', capability: 'contact' },
	// The facets the catalogue attaches to a product, and the classification a facet belongs to.
	{ path: '/api/tags', capability: 'catalog' },
	{ path: '/api/tag-types', capability: 'catalog' },
	// The reference data every amount and every address on the platform resolves against.
	{ path: '/api/currency', capability: 'kernel' },
	{ path: '/api/country', capability: 'kernel' },
	// The configuration the rest of the programme reads: which capabilities are served at all, and what
	// the tenant's settings say about how they behave.
	{ path: '/api/feature/toggle', capability: 'kernel' },
	{ path: '/api/tenant-setting', capability: 'kernel' },
	{ path: '/api/tenant-ui-preferences', capability: 'kernel' },
	// The parties an order, an invoice and a subscription all point at.
	{ path: '/api/contact', capability: 'contact' },
	{ path: '/api/organization-contact', capability: 'contact' },
	// What a buyer is sent and what a seller is owed.
	{ path: '/api/invoices', capability: 'invoice' },
	{ path: '/api/invoice-item', capability: 'invoice' }
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
 * The feature codes the sweep's routes are gated behind.
 *
 * `FeatureFlagGuard` answers `404 Cannot GET …` for a route whose feature is switched off — it hides
 * the surface rather than admitting that it exists — so a disabled capability and an unmounted one are
 * indistinguishable to a sweep. An installation provisioned from scratch switches eight of this
 * programme's thirty-two codes on and leaves the rest to an explicit business decision (appendix B §4),
 * and a suite that does not state that decision reports every default-off capability as missing: that is
 * exactly what a fresh installation produced the first time this file ran against one.
 *
 * The sweep therefore states it, through the platform's own toggle endpoint, before it measures
 * anything — and the enablement is itself one of the checks, so a deployment where the toggle refuses
 * is reported rather than silently worked around.
 */
const GATED_FEATURES = [
	'FEATURE_ORDER',
	'FEATURE_CART',
	'FEATURE_CATALOG',
	'FEATURE_PRICING',
	'FEATURE_TAX',
	'FEATURE_PROMOTION',
	'FEATURE_INVENTORY',
	'FEATURE_GRAPHQL',
	'FEATURE_WAREHOUSE',
	'FEATURE_FULFILLMENT',
	'FEATURE_RETURNS',
	'FEATURE_SUBSCRIPTION',
	'FEATURE_PURCHASING',
	'FEATURE_ENTITLEMENT',
	'FEATURE_MARKETPLACE',
	'FEATURE_SEARCH',
	'FEATURE_MULTI_CURRENCY',
	'FEATURE_MULTI_REGION',
	'FEATURE_MULTI_WAREHOUSE',
	'FEATURE_B2B_CREDIT',
	'FEATURE_ORDER_APPROVALS',
	'FEATURE_GIFT_CARDS',
	'FEATURE_WEBHOOKS',
	'FEATURE_EXTERNAL_SEARCH',
	'FEATURE_SEARCH_INDEX',
	'FEATURE_BACKORDERS',
	'FEATURE_PRICE_TIERS',
	'FEATURE_BULK_API',
	'FEATURE_DATA_EXPORT',
	'FEATURE_TAX_PROVIDER',
	'FEATURE_SUBSCRIPTION_BILLING',
	'FEATURE_SELLER_PAYOUT_SCHEDULER'
];

/**
 * Switches on every capability the sweep is about to read.
 *
 * @param {string} token The credential.
 * @param {string} tenantId The tenant the caller is acting as.
 * @returns {Promise<void>}
 */
async function enableGatedCapabilities(token, tenantId) {
	const catalogue = await call('GET', '/api/feature/toggle', { token, tenantId });
	const idByCode = new Map((catalogue.json?.items ?? []).map((feature) => [feature.code, feature.id]));

	const toggles = await call('GET', '/api/feature/toggle/organizations', { token, tenantId });
	const enabled = new Set(
		(toggles.json?.items ?? []).filter((row) => row.isEnabled === true).map((row) => row.featureId)
	);

	const switched = [];
	const missing = [];

	for (const code of GATED_FEATURES) {
		const featureId = idByCode.get(code);

		if (!featureId) {
			missing.push(`${code} is not in the catalogue`);
			continue;
		}

		if (enabled.has(featureId)) continue;

		const answer = await call('POST', '/api/feature/toggle', {
			token,
			tenantId,
			body: { featureId, isEnabled: true }
		});

		if (answer.status === 200 || answer.status === 201) {
			switched.push(code);
		} else {
			missing.push(`${code} (HTTP ${answer.status})`);
		}
	}

	record(
		'every gated commerce capability is switched on for this run',
		missing.length === 0,
		`${switched.length} switched on, ${GATED_FEATURES.length - switched.length - missing.length} already on${
			missing.length ? `, not enabled: ${missing.slice(0, 3).join(', ')}` : ''
		}`
	);
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

	// --- the gated capabilities are switched on ------------------------------------------------
	await enableGatedCapabilities(token, tenantId);

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
		'/api/search/index-definitions': 'searchIndexDefinitions',
		// The delivered route is singular and the concept is plural: `/api/product-variant-price` is the
		// price of a variant, and the schema names the collection for what it collects. The reference
		// resources below are the same case: a route named for an installation-wide table, and a field
		// named for the rows it answers.
		'/api/product-variant-price': 'productVariantPrices',
		'/api/currency': 'currencies',
		'/api/country': 'countries',
		'/api/feature/toggle': 'featureToggles',
		'/api/tenant-setting': 'tenantSettings',
		'/api/contact': 'contacts',
		'/api/organization-contact': 'organizationContacts',
		'/api/invoice-item': 'invoiceItems'
	};
	// An alias key may also name a resource the sweep reads, so the two lists are unioned rather than
	// concatenated: a resource in both is one check, not two.
	for (const resource of [...new Set([...RESOURCES.map((entry) => entry.path), ...Object.keys(aliases)])]) {
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

	/*
	 * The code, not only the shape. Every failure on this surface is promised the same `code`, `status`
	 * and `traceId` its REST counterpart reports, because a client switches its retry and its message
	 * lookup on the pair. Wiring the error formatter to the wrong error — the copy the transport has
	 * already normalised, rather than the exception that was thrown — answered `INTERNAL_ERROR` for
	 * every failure and dropped the details, which no assertion on the HTTP status can see.
	 */
	const validationError = badQuery.json?.errors?.[0]?.extensions;
	record(
		'a document the schema rejects carries the platform validation code',
		validationError?.code === 'VALIDATION_FAILED' && validationError?.status === 400,
		`${badQuery.json?.errors?.[0]?.message ?? 'no error'} → ${JSON.stringify(validationError)}`
	);

	// The same failure over both surfaces: a node read of an identifier that does not exist.
	const missingNode = await call('POST', '/graphql', {
		token,
		tenantId,
		body: { query: '{ collection(id: "00000000-0000-4000-8000-0000000000ff") { id } }' }
	});
	const missingExtensions = missingNode.json?.errors?.[0]?.extensions;
	record(
		'a GraphQL refusal carries the code and status its REST route reports',
		missingExtensions?.code === 'RESOURCE_NOT_FOUND' && missingExtensions?.status === 404,
		`${missingNode.json?.errors?.[0]?.message ?? 'no error'} → ${JSON.stringify(missingExtensions)}`
	);

	record(
		'no stacktrace reaches the GraphQL caller',
		!(missingExtensions?.stacktrace || missingExtensions?.exception),
		`extensions: ${Object.keys(missingExtensions ?? {}).join(', ') || 'none'}`
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
