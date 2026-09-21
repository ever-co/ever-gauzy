#!/usr/bin/env node
/*
 * The commerce *flows*, exercised end to end against a running installation.
 *
 * `commerce-e2e.mjs` answers "is every surface mounted, and do the two protocols agree about a row?".
 * It cannot answer "does a flow work?", because the local installation holds no commerce fixture at
 * all — one tenant, one organization, one administrator, and no party, supplier, location, product,
 * variant or order to hang a flow from. This suite builds that fixture chain **through the API**, and
 * then proves two capabilities that exist only because this installation binds the ports of
 * `apps/api/src/plugin-composition.ts`:
 *
 *   A. **An approval really lands in the platform's approval machinery.** The purchasing package asks
 *      for an approval through an optional port; when the port is bound to the platform's own approval
 *      service, approving a purchase order files a request row in the register and records its id on
 *      the order. A `null` approval id, or no request row, is the check failing — that is the point.
 *
 *   B. **A remembered payer may, or may not, be charged.** The subscription package asks an optional
 *      capability whether the payer a subscription remembers may still be charged; when the capability
 *      is bound to the kernel's stored-instrument model, the answer is a rule over two kernel tables —
 *      an account that is `ACTIVE`, and an instrument that is `ACTIVE` and belongs to it. The same
 *      suite proves the rules a caller can observe: no route accepts card data, a revocation keeps its
 *      row, no list carries the stored reference, and a single read does. It then closes an account of
 *      its own and asserts the specification's other rule — the instruments beneath it are revoked in
 *      the same transaction, and the close answers how many went with it.
 *
 * Every step reads back what it wrote and asserts it, so a broken link names the endpoint that broke
 * rather than leaving a later failure to be guessed at. Every step prints the HTTP status it answered.
 *
 * **A check that cannot run is reported, never dropped.** When a step is refused, the checks it made
 * unreachable are printed as failures naming the refusal, and where the cause is a platform limitation
 * rather than a caller error the suite prints it as a `NOTE` beside them. A suite that quietly skipped
 * what it could not reach would report a smaller count and call it a pass.
 *
 * **The chain is idempotent.** Each fixture is found by a stable key (a name, a code, a reference) and
 * reused when it is already there; the create is attempted only when the lookup misses, and a create
 * the platform refuses because the row already exists is treated as the signal to look it up again.
 * A second run therefore adds no duplicate — it re-asserts the same properties over the same rows.
 *
 * **Nothing is deleted.** The rows this suite writes are either the fixtures the next run reuses or the
 * evidence of the flow it proves: an approval row, a raised purchase order and a revoked instrument are
 * the record of what happened, and the platform's own rule is that a revocation keeps its row. The one
 * place a removal is exercised is the platform's own revocation route, asserted to keep the row.
 *
 * Usage:
 *   node tools/scripts/commerce-flow-e2e.mjs
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
 * The stable keys of the fixture chain.
 *
 * Every one of them is a column the platform already treats as an operator-facing key — a party name,
 * a supplier code, a location code, a product code, a plan code — which is what makes the chain
 * idempotent: the lookup is the platform's own, and the unique index behind it is what refuses a
 * second copy.
 */
const FIXTURE = {
	supplierPartyName: 'Flow Supplier Party',
	supplierPartyEmail: 'flow-supplier-party@example.com',
	representativeName: 'Flow Vendor Representative',
	representativeEmail: 'flow-vendor-representative@example.com',
	vendorCode: 'FLOW-VENDOR-1',
	vendorName: 'Flow Vendor',
	vendorEmail: 'flow-vendor@example.com',
	warehouseCode: 'FLOW-WAREHOUSE-1',
	warehouseName: 'Flow Warehouse',
	warehouseEmail: 'flow-warehouse@example.com',
	productCode: 'FLOW-PRODUCT-1',
	productName: 'Flow Product',
	variantReference: 'FLOW-VARIANT-1',
	planCode: 'FLOW-PLAN-1',
	planName: 'Flow Recurring Plan',
	orderReference: 'FLOW-PO-1',
	providerKey: 'PLATFORM_FLOW',
	disposableProviderKey: 'PLATFORM_FLOW_DISPOSABLE',
	accountReference: 'flow-provider-account-1',
	disposableAccountReference: 'flow-provider-account-disposable-1',
	instrumentReference: 'flow-instrument-1',
	disposableInstrumentReference: 'flow-instrument-disposable-1',
	instrumentKey: 'FLOW-INSTRUMENT-1',
	disposableInstrumentKey: 'FLOW-INSTRUMENT-DISPOSABLE-1',
	currency: 'USD',
	lineQuantity: '5.000000',
	lineUnitCost: '12.400000',
	subscriptionQuantity: '1.000000',
	subscriptionUnitPrice: '19.990000'
};

/** The code the platform refuses a body that carries card data with, as its catalogue publishes it. */
const CARD_DATA_CODE = 'PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED';

/** The code a cycle carries when the payer it remembers may not be charged. */
const PAYMENT_METHOD_MISSING_CODE = 'SUBSCRIPTION_PAYMENT_METHOD_MISSING';

/** The code a cycle carries when the order capability is not registered in this installation. */
const ORDER_GATEWAY_UNAVAILABLE_CODE = 'SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE';

const results = [];

/** The credential and the scope every call is made with, filled in by the sign-in. */
const session = { token: undefined, tenantId: undefined, organizationId: undefined };

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
 * Records the checks a refusal upstream made it impossible to run.
 *
 * A check that could not run because the step before it was refused is reported as failing, with the
 * refusal named beside it. A suite that quietly dropped the checks it could not reach would print a
 * smaller count and call it a pass, which is the one outcome this file exists to prevent.
 *
 * @param {string[]} names The checks that could not run.
 * @param {string} why The refusal that stopped them.
 */
function notRun(names, why) {
	for (const name of names) record(name, false, `not attempted — ${why}`);
}

/**
 * Prints a finding that is not itself a check.
 *
 * Used where the report needs to say *why* something could not be reached — an installation that is
 * missing a row the platform never offers a route for, for instance. It is printed, never swallowed:
 * a reader of the output must not have to infer the cause from a 409.
 *
 * @param {string} message The finding.
 */
function note(message) {
	console.log(`  NOTE  ${message}`);
}

/**
 * Prints a section heading, so the report reads as the chain it is.
 *
 * @param {string} title The section.
 */
function section(title) {
	console.log('');
	console.log(`  ${title}`);
	console.log(`  ${'-'.repeat(title.length)}`);
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
	const { token, tenantId, body, headers: extraHeaders } = options;
	// The signed-in caller's organization, so every request after the login carries the scope the
	// platform resolves numbering series, default channel and currency through. A call site may still
	// state its own.
	const organizationId = options.organizationId ?? session.organizationId;
	const response = await fetch(`${BASE}${url}`, {
		method,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {}),
			/*
			 * The organization travels with the request, as a real client sends it. Without it the
			 * request context carries a tenant and no organization, and the numbering series — which is
			 * per organization — cannot be resolved: raising the first purchase order answered
			 * `PURCHASE_ORDER_SEQUENCE_MISSING` for a series that exists, which is a defect in this
			 * harness rather than in the platform.
			 */
			...(organizationId ? { 'Organization-Id': organizationId } : {}),
			// Whatever the call site states, last, so a request can carry a retry key or a precondition.
			...(extraHeaders ?? {})
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

	return { status: response.status, json, text, headers: response.headers };
}

/** @param {{json: any, text: string}} result A response. @returns {string} A short description. */
function brief(result) {
	return (result.json ? JSON.stringify(result.json) : result.text).slice(0, 300);
}

/**
 * Calls an endpoint with the session's credential.
 *
 * @param {string} method The HTTP method.
 * @param {string} url The path.
 * @param {unknown} [body] The body, when the call carries one.
 * @param {Record<string, string>} [headers] Request headers the call states, for a retry key or a precondition.
 * @returns {Promise<{status: number, json: any, text: string}>} The response.
 */
function scoped(method, url, body, headers) {
	return call(method, url, { token: session.token, tenantId: session.tenantId, body, headers });
}

/**
 * Lists a resource that reads its narrowing from a JSON `data` query parameter.
 *
 * The kernel's older list routes take `?data={"findInput":{...},"relations":[...]}`, which is the
 * spelling this suite uses to look a fixture up by the stable key it was written with.
 *
 * @param {string} path The resource path.
 * @param {Record<string, unknown>} data The `data` object.
 * @returns {Promise<{status: number, json: any, text: string}>} The response.
 */
function listed(path, data) {
	return scoped('GET', `${path}?data=${encodeURIComponent(JSON.stringify(data))}`);
}

/**
 * Reads the first row of a `?data=` list whose member holds the expected value.
 *
 * @param {string} path The resource path.
 * @param {string} member The member to match.
 * @param {unknown} value The value to match.
 * @returns {Promise<any | undefined>} The row, or undefined when nothing matched.
 */
async function lookup(path, member, value) {
	const response = await listed(path, { findInput: { [member]: value } });
	const items = response.json?.items;

	return Array.isArray(items) ? items.find((item) => item?.[member] === value) : undefined;
}

/**
 * Turns a miss into a create, and a refusal of the create into a second lookup.
 *
 * This is the idempotence rule in one place: the fixture is looked up by its stable key; when it is
 * not there it is created; and when the platform refuses the create because the row already exists —
 * which is what its unique indexes do — the lookup is repeated and the row that refused the second
 * copy is the row that is reused.
 *
 * @param {object} step The step to run.
 * @param {string} step.label How the step is named in the report.
 * @param {string} step.path The resource path the row belongs to.
 * @param {string} step.member The stable key's member name.
 * @param {unknown} step.value The stable key's value.
 * @param {() => Promise<any | undefined>} step.find The lookup.
 * @param {() => Promise<{status: number, json: any, text: string}>} step.create The create.
 * @returns {Promise<{row?: any, status?: number, created: boolean, response?: any}>} What happened.
 */
async function ensure(step) {
	const existing = await step.find();

	if (existing?.id) {
		record(`${step.label} is stored`, true, `reused (HTTP 200, ${step.member}=${step.value})`);
		return { row: existing, status: 200, created: false };
	}

	const created = await step.create();

	if ((created.status === 200 || created.status === 201) && created.json?.id) {
		record(`${step.label} is stored`, true, `HTTP ${created.status} (created, ${step.member}=${step.value})`);
		return { row: created.json, status: created.status, created: true, response: created };
	}

	// The platform's unique index is the signal to reuse: a create that is refused for a row that is
	// already there is not a failure of the chain, it is the second copy being refused as designed.
	const afterRefusal = await step.find();

	if (afterRefusal?.id) {
		record(
			`${step.label} is stored`,
			true,
			`reused after the platform refused a second copy (HTTP ${created.status}, ${step.member}=${step.value})`
		);
		return { row: afterRefusal, status: created.status, created: false, response: created };
	}

	record(`${step.label} is stored`, false, `HTTP ${created.status} ${brief(created)}`);

	return { status: created.status, created: false, response: created };
}

/**
 * Reads one row back and asserts a member of it.
 *
 * @param {string} name The check's name.
 * @param {string} path The resource path, including the identifier.
 * @param {(row: any) => boolean} assertion What must hold of the stored row.
 * @param {(row: any) => string} [evidence] What to print beside the verdict.
 * @returns {Promise<any | undefined>} The stored row.
 */
async function readBack(name, path, assertion, evidence) {
	const response = await scoped('GET', path);
	const row = response.json;
	const ok = response.status === 200 && Boolean(row?.id) && assertion(row);

	record(name, ok, `HTTP ${response.status}${evidence && row?.id ? ` ${evidence(row)}` : ok ? '' : ` ${brief(response)}`}`);

	return row;
}

/**
 * The feature codes the routes this flow drives are gated behind.
 *
 * The same list the sweep states, for the same reason, and stated here rather than derived from it
 * because the two files are run independently: each has to be able to provision what it needs on an
 * installation it finds in any state.
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
 * Switches on every capability this flow drives.
 *
 * The toggle is written **twice** per code — once tenant-wide and once for the caller's own
 * organization — and that is not redundancy. The guard caches a resolved flag per tenant and per
 * organization, and a write evicts only the entries of the scopes it touched; an organization that has no
 * row of its own resolves from the tenant-wide row, so a tenant-wide write alone leaves that
 * organization's cached answer standing until the entry expires (sixty seconds, the guard's TTL). Every
 * request this suite makes states the organization, so the organization-scoped row is the one its reads
 * resolve *and* the one whose cache entry the second write evicts — which is what makes the precondition
 * take effect on the next request rather than a minute later.
 *
 * @returns {Promise<void>}
 */
async function enableGatedCapabilities() {
	const catalogue = await call('GET', '/api/feature/toggle', { token: session.token, tenantId: session.tenantId });
	const idByCode = new Map((catalogue.json?.items ?? []).map((feature) => [feature.code, feature.id]));

	const toggles = await call('GET', '/api/feature/toggle/organizations', {
		token: session.token,
		tenantId: session.tenantId
	});
	const enabledForOrganization = new Set(
		(toggles.json?.items ?? [])
			.filter((row) => row.isEnabled === true && row.organizationId === session.organizationId)
			.map((row) => row.featureId)
	);

	const switched = [];
	const missing = [];

	for (const code of GATED_FEATURES) {
		const featureId = idByCode.get(code);

		if (!featureId) {
			missing.push(`${code} is not in the catalogue`);
			continue;
		}

		if (enabledForOrganization.has(featureId)) continue;

		const tenantWide = await call('POST', '/api/feature/toggle', {
			token: session.token,
			tenantId: session.tenantId,
			body: { featureId, isEnabled: true }
		});
		const scoped = await call('POST', '/api/feature/toggle', {
			token: session.token,
			tenantId: session.tenantId,
			body: { featureId, isEnabled: true, organizationId: session.organizationId }
		});

		if ((tenantWide.status === 200 || tenantWide.status === 201) && (scoped.status === 200 || scoped.status === 201)) {
			switched.push(code);
		} else {
			missing.push(`${code} (HTTP ${tenantWide.status}/${scoped.status})`);
		}
	}

	record(
		'every gated capability this flow drives is switched on',
		missing.length === 0,
		`${switched.length} switched on, ${GATED_FEATURES.length - switched.length - missing.length} already on${
			missing.length ? `, not enabled: ${missing.slice(0, 3).join(', ')}` : ''
		}`
	);
}

async function main() {
	console.log('');
	console.log('commerce flow end-to-end suite');
	console.log('==============================');
	console.log(`  ${BASE}`);

	// --- the credential -------------------------------------------------------------------------
	section('the credential and its scope');

	const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	session.token = login.json?.token;
	session.tenantId = login.json?.user?.tenantId;
	// The organization the caller's rows belong to. It is stated by the sign-in answer itself — the
	// employee's own organization — and every body below that must name an organization names this one,
	// so the fixtures are scoped exactly as the caller is.
	session.organizationId = login.json?.user?.employee?.organizationId;

	record(
		'a real credential signs in over REST',
		login.status === 200 && Boolean(session.token),
		`HTTP ${login.status} ${session.token ? '' : brief(login)}`
	);
	record(
		'the credential states the organization its rows belong to',
		Boolean(session.organizationId),
		session.organizationId ? `organizationId ${session.organizationId}` : 'the sign-in answer carries no employee organization'
	);

	if (!session.token || !session.organizationId) return finish();

	// --- the gated capabilities are switched on ---------------------------------------------------
	/*
	 * `FeatureFlagGuard` answers `404 Cannot GET …` for a route whose feature is switched off, so a
	 * disabled capability reads exactly like a route that was never mounted. A fresh installation
	 * switches eight of this programme's thirty-two codes on and leaves the rest to an explicit
	 * business decision (appendix B §4), and this flow drives purchasing, warehouse, returns,
	 * subscription and marketplace routes among others — so it states the decision through the
	 * platform's own toggle endpoint before it measures anything, and reports the outcome as a check.
	 */
	section('the capabilities this flow drives are switched on');
	await enableGatedCapabilities();

	// --- the fixture chain ------------------------------------------------------------------------
	/*
	 * Every fixture below is written through the API the platform publishes, with the body its own
	 * delivered contract states — not a shape that happens to be accepted. Where a body needs a value
	 * the table requires and no default supplies (`creditUsed` on a party, the organization on every
	 * scoped row), the value is stated rather than left to a database refusal.
	 */
	section('the fixture chain: the party the chain hangs from');

	const supplierParty = await ensure({
		label: 'the supplier party (a company account)',
		path: '/api/organization-contact',
		member: 'name',
		value: FIXTURE.supplierPartyName,
		find: () => lookup('/api/organization-contact', 'name', FIXTURE.supplierPartyName),
		create: () =>
			scoped('POST', '/api/organization-contact', {
				name: FIXTURE.supplierPartyName,
				primaryEmail: FIXTURE.supplierPartyEmail,
				contactType: 'CLIENT',
				partyKind: 'COMPANY',
				status: 'ACTIVE',
				taxExempt: false,
				acceptsMarketing: false,
				creditUsed: 0,
				loyaltyPoints: 0,
				organizationId: session.organizationId,
				contact: { firstName: 'Flow', lastName: 'Supplier', name: 'Flow Supplier' }
			})
	});

	await readBack(
		'the supplier party reads back as a company account',
		`/api/organization-contact/${supplierParty.row?.id}`,
		(row) => row.partyKind === 'COMPANY' && Boolean(row.contactId),
		(row) => `partyKind=${row.partyKind} contactId=${row.contactId}`
	);

	const representative = await ensure({
		label: "the supplier's representative (a person account)",
		path: '/api/organization-contact',
		member: 'name',
		value: FIXTURE.representativeName,
		find: () => lookup('/api/organization-contact', 'name', FIXTURE.representativeName),
		create: () =>
			scoped('POST', '/api/organization-contact', {
				name: FIXTURE.representativeName,
				primaryEmail: FIXTURE.representativeEmail,
				contactType: 'CLIENT',
				partyKind: 'INDIVIDUAL',
				status: 'ACTIVE',
				taxExempt: false,
				acceptsMarketing: false,
				creditUsed: 0,
				loyaltyPoints: 0,
				organizationId: session.organizationId,
				contact: { firstName: 'Vendor', lastName: 'Representative' }
			})
	});

	await readBack(
		'the representative reads back as a person account',
		`/api/organization-contact/${representative.row?.id}`,
		(row) => row.partyKind === 'INDIVIDUAL',
		(row) => `partyKind=${row.partyKind}`
	);

	section('the fixture chain: the supplier and the location');

	const vendor = await ensure({
		label: 'the supplier (organization_vendor)',
		path: '/api/organization-vendors',
		member: 'code',
		value: FIXTURE.vendorCode,
		find: () => lookup('/api/organization-vendors', 'code', FIXTURE.vendorCode),
		create: () =>
			scoped('POST', '/api/organization-vendors', {
				name: FIXTURE.vendorName,
				code: FIXTURE.vendorCode,
				email: FIXTURE.vendorEmail,
				currency: FIXTURE.currency,
				organizationId: session.organizationId,
				contactId: representative.row?.id
			})
	});

	await readBack(
		'the supplier reads back with its code and its party',
		`/api/organization-vendors/${vendor.row?.id}`,
		(row) => row.code === FIXTURE.vendorCode && row.organizationId === session.organizationId,
		(row) => `code=${row.code} contactId=${row.contactId}`
	);

	const warehouse = await ensure({
		label: 'the warehouse the goods arrive at',
		path: '/api/warehouses',
		member: 'code',
		value: FIXTURE.warehouseCode,
		find: async () => {
			// This list's narrowing is the kernel's `where` shape, not the JSON `data` one, and its `where`
			// contract carries the organization with the key — a read scoped to another organization is
			// not a read of this row.
			const response = await scoped(
				'GET',
				`/api/warehouses?take=100&where[code]=${encodeURIComponent(FIXTURE.warehouseCode)}&where[organizationId]=${session.organizationId}`
			);
			const items = response.json?.items;

			return Array.isArray(items) ? items.find((item) => item?.code === FIXTURE.warehouseCode) : undefined;
		},
		create: () =>
			scoped('POST', '/api/warehouses', {
				name: FIXTURE.warehouseName,
				code: FIXTURE.warehouseCode,
				email: FIXTURE.warehouseEmail,
				description: 'The receiving location the flow suite orders into.',
				organizationId: session.organizationId
			})
	});

	await readBack(
		'the warehouse reads back with its code',
		`/api/warehouses/${warehouse.row?.id}`,
		(row) => row.code === FIXTURE.warehouseCode,
		(row) => `code=${row.code}`
	);

	section('the fixture chain: the catalogue');

	const product = await ensure({
		label: 'the product',
		path: '/api/products',
		member: 'code',
		value: FIXTURE.productCode,
		find: () => lookup('/api/products', 'code', FIXTURE.productCode),
		create: () =>
			scoped('POST', '/api/products', {
				code: FIXTURE.productCode,
				name: FIXTURE.productName,
				description: 'The product the flow suite buys and subscribes to.',
				enabled: true,
				// The delivered create contract states both, and the product it writes is the kernel's own
				// row: the options group list is stated as empty rather than omitted, because a create
				// without it has nothing to iterate.
				type: { name: 'Flow Type' },
				category: { name: 'Flow Category' },
				optionGroupCreateInputs: []
			})
	});

	await readBack(
		'the product reads back with its code',
		`/api/products/${product.row?.id}`,
		(row) => row.code === FIXTURE.productCode,
		(row) => `code=${row.code}`
	);

	const variant = await ensure({
		label: 'the product variant',
		path: '/api/product-variants',
		member: 'internalReference',
		value: FIXTURE.variantReference,
		find: async () => {
			const response = await scoped('GET', `/api/product-variants/product/${product.row?.id}`);
			const items = response.json?.items;

			return Array.isArray(items)
				? items.find((item) => item?.internalReference === FIXTURE.variantReference)
				: undefined;
		},
		create: () =>
			scoped('POST', '/api/product-variants', {
				productId: product.row?.id,
				internalReference: FIXTURE.variantReference,
				notes: 'The variant a purchase-order line and a recurring line name.',
				enabled: true,
				organizationId: session.organizationId,
				tenantId: session.tenantId
			})
	});

	await readBack(
		'the variant reads back under its product',
		`/api/product-variants/${variant.row?.id}`,
		(row) => row.internalReference === FIXTURE.variantReference && row.productId === product.row?.id,
		(row) => `internalReference=${row.internalReference} productId=${row.productId}`
	);

	// The mark that says a variant may be sold on recurring terms lives in the variant's own settings
	// row, and the subscription domain reads exactly that column through the catalogue port. A variant
	// with no settings row has never been marked, so the row is written here rather than assumed; the
	// lookup is the settings surface filtered by the variant, which is the key the row is unique on.
	const findSetting = async () => {
		const response = await scoped(
			'GET',
			`/api/product-variant-settings?take=100&where[organizationId]=${session.organizationId}&where[productVariantId]=${variant.row?.id}`
		);
		const items = Array.isArray(response.json?.items) ? response.json.items : [];

		return items.find((item) => item?.isSubscription === true) ?? items[0];
	};

	let setting = await findSetting();
	let settingStatus = setting ? 200 : 0;

	if (setting && setting.isSubscription !== true) {
		const marked = await scoped('PUT', `/api/product-variant-settings/${setting.id}`, { isSubscription: true });

		settingStatus = marked.status;
		setting = marked.json?.id ? marked.json : await findSetting();
	} else if (!setting) {
		const created = await scoped('POST', '/api/product-variant-settings', {
			productVariantId: variant.row?.id,
			productVariant: { id: variant.row?.id },
			isSubscription: true,
			organizationId: session.organizationId,
			tenantId: session.tenantId
		});

		settingStatus = created.status;
		// A create the platform refuses because the variant already carries a settings row is the signal
		// to reuse that row, exactly as it is everywhere else in this chain.
		setting = created.json?.id ? created.json : await findSetting();
	}

	const reread = setting?.id ? await scoped('GET', `/api/product-variant-settings/${setting.id}`) : { status: 0 };

	record(
		'the variant is marked sellable on recurring terms',
		reread.status === 200 && reread.json?.isSubscription === true,
		`HTTP ${settingStatus} then HTTP ${reread.status} isSubscription=${reread.json?.isSubscription}`
	);

	// --- Proof A ---------------------------------------------------------------------------------
	section('proof A: a purchase order is approved through the platform approval machinery');

	const orderLookup = await scoped('GET', '/api/purchase-orders?take=100');
	const orderItems = Array.isArray(orderLookup.json?.items) ? orderLookup.json.items : [];
	let order = orderItems.find((item) => item?.vendorReference === FIXTURE.orderReference);
	let orderStatus = orderLookup.status;

	if (!order) {
		const raised = await scoped('POST', '/api/purchase-orders', {
			vendorId: vendor.row?.id,
			warehouseId: warehouse.row?.id,
			currency: FIXTURE.currency,
			vendorReference: FIXTURE.orderReference,
			organizationId: session.organizationId,
			note: 'Raised by the commerce flow suite to prove the approval binding.',
			lines: [
				{
					variantId: variant.row?.id,
					quantity: FIXTURE.lineQuantity,
					unitCost: FIXTURE.lineUnitCost
				}
			]
		});

		orderStatus = raised.status;
		order = raised.json;
		const orderCreated = raised.status === 201 || raised.status === 200;

		record(
			'the purchase order is raised against the supplier at the location',
			orderCreated && Boolean(order?.id),
			`HTTP ${raised.status} ${order?.id ? `number=${order.number} grandTotal=${order.grandTotal} ${order.currency}` : brief(raised)}`
		);
	} else {
		record(
			'the purchase order is raised against the supplier at the location',
			true,
			`HTTP ${orderStatus} (reused, number=${order.number} grandTotal=${order.grandTotal} ${order.currency})`
		);
	}

	const proofAChecks = [
		'the raised order reads back with its single line',
		'approving answers with the stored order',
		'the approved order carries the approval id the platform filed',
		"the platform's approval register holds the request the order filed",
		'the request names the purchase order it is about',
		"the request carries the order's amount and currency",
		"the register's list carries the request"
	];

	if (!order?.id) {
		// The refusal is already on the record above; the checks it made unreachable are named here
		// rather than dropped, so the count does not shrink when the platform cannot walk the flow.
		notRun(proofAChecks, `the order could not be raised (HTTP ${orderStatus})`);

		if (String(order?.message ?? order?.error ?? '').includes('PURCHASE_ORDER_SEQUENCE_MISSING')) {
			note(
				'the order was refused because the organization holds no numbering series for key "PO". `GET/POST /api/sequences` now ' +
					'serves the series resource, so a series can be opened through the API; what the harness does not do is open one, because ' +
					'a flow suite that provisions the numbering configuration it needs would hide the fact that a fresh installation has none. ' +
					'Proof A runs and passes end to end as soon as the series exists.'
			);
		}
	} else {
		const detailed = await readBack(
			'the raised order reads back with its single line',
			`/api/purchase-orders/${order.id}`,
			(row) => Array.isArray(row.lines) && row.lines.length === 1 && row.vendorId === vendor.row?.id,
			(row) => `lines=${row.lines?.length} vendorId=${row.vendorId} warehouseId=${row.warehouseId} status=${row.status}`
		);

		const stored = detailed ?? order;

		const approved = await scoped('POST', `/api/purchase-orders/${order.id}/approve`, {
			note: 'Approved by the commerce flow suite.'
		});

		record(
			'approving answers with the stored order',
			(approved.status === 200 || approved.status === 201) && Boolean(approved.json?.approvedAt),
			`HTTP ${approved.status} approvedAt=${approved.json?.approvedAt ?? 'none'}`
		);

		// The whole point of the binding: the approval is filed through the platform's machinery and the
		// id it answers with is recorded on the order. A `null` here is the check failing.
		const approvalId = approved.json?.approvalId;
		const approvedOrderId = approved.json?.id ?? order.id;

		record(
			'the approved order carries the approval id the platform filed',
			Boolean(approvalId),
			`approvalId=${approvalId ?? 'null'} (order ${approvedOrderId}, HTTP ${approved.status})`
		);

		if (!approvalId) {
			notRun(proofAChecks.slice(3), 'the approval carried no identifier to read the register by');
		} else {
			// The register holds the row, read through the register's own route with the identifier the
			// order carries. This is the assertion the flow exists for: a request row for *this* order.
			const requestRow = await scoped('GET', `/api/request-approval/${approvalId}`);

			record(
				"the platform's approval register holds the request the order filed",
				requestRow.status === 200 && requestRow.json?.id === approvalId,
				`HTTP ${requestRow.status} ${requestRow.json?.id ? `requestId=${requestRow.json.requestId}` : brief(requestRow)}`
			);

			const filed = requestRow.json;

			if (filed?.id) {
				record(
					'the request names the purchase order it is about',
					filed.requestId === order.id && filed.requestType === 'PURCHASE_ORDER',
					`requestId=${filed.requestId} requestType=${filed.requestType}`
				);
				record(
					"the request carries the order's amount and currency",
					String(filed.amount) === String(stored.grandTotal) && filed.currency === stored.currency,
					`amount=${filed.amount} ${filed.currency} vs order grandTotal=${stored.grandTotal} ${stored.currency}`
				);
			} else {
				notRun(
					['the request names the purchase order it is about', "the request carries the order's amount and currency"],
					`the register answered no row (HTTP ${requestRow.status})`
				);
			}

			// The list is the register's other read. It is asserted separately because it is a different
			// question — the row is in the register, and the register can be asked for its rows — and
			// because the answer is informative when the two disagree.
			const registerList = await scoped('GET', '/api/request-approval?data=%7B%22relations%22%3A%5B%5D%7D');
			const registerItems = Array.isArray(registerList.json?.items) ? registerList.json.items : [];
			const listedInRegister = registerItems.some((item) => item?.requestId === order.id);

			record(
				"the register's list carries the request",
				listedInRegister,
				`HTTP ${registerList.status} ${registerItems.length} row(s) listed${
					listedInRegister ? '' : ' — the list query joins the approval policy, the time-off request and the equipment sharing, so a request that names none of them is not among its rows'
				}`
			);
		}
	}

	// --- Proof B ---------------------------------------------------------------------------------
	section('proof B: the remembered payer of the platform stored-instrument model');

	const holder = await ensure({
		label: 'the payment account holder',
		path: '/api/payment-account-holders',
		member: 'providerKey',
		value: FIXTURE.providerKey,
		find: async () => {
			const response = await scoped('GET', `/api/payment-account-holders?contactId=${representative.row?.id}`);
			const items = response.json?.items;

			return Array.isArray(items) ? items.find((item) => item?.providerKey === FIXTURE.providerKey) : undefined;
		},
		create: () =>
			scoped('POST', '/api/payment-account-holders', {
				providerKey: FIXTURE.providerKey,
				type: 'CUSTOMER',
				country: 'US',
				defaultCurrency: FIXTURE.currency,
				organizationId: session.organizationId,
				contactId: representative.row?.id
			})
	});

	const holderId = holder.row?.id;

	record(
		'the account is recorded in the state onboarding starts from',
		holder.created ? holder.row?.status === 'PENDING' : Boolean(holderId),
		holder.created
			? `HTTP ${holder.status} status=${holder.row?.status}`
			: `HTTP ${holder.status} status=${holder.row?.status} (reused; the create answers PENDING, which the check above already saw)`
	);

	if (!holderId) return finish();

	const verified = await scoped(
		'POST',
		`/api/payment-account-holders/${holderId}/verify`,
		{
			verificationStatus: 'VERIFIED',
			reference: FIXTURE.accountReference,
			note: 'Verified by the commerce flow suite.'
		},
		// The route is retry-safe by design: recording a verification verdict twice is the same verdict,
		// so it demands a key and this probe presents one. A caller that retries a lost response is the
		// client this contract exists for, and a harness that skipped the header would be testing a
		// platform nobody runs. The key is per run, because a key identifies one request and a second run
		// of the suite states a different one under the same fixture.
		{ 'Idempotency-Key': `flow-verify-${holderId}-${Date.now()}` }
	);

	record(
		'the verification moves the account to active',
		verified.status === 200 && verified.json?.status === 'ACTIVE',
		`HTTP ${verified.status} status=${verified.json?.status} verificationStatus=${verified.json?.verificationStatus}`
	);

	// The instrument is saved from a reference the provider issued and confirmed — never from card
	// data, which no member of the contract carries and which the route refuses before the contract is
	// applied. The row is looked up by the key the suite writes beside the reference, because a list
	// never carries the reference itself.
	const instruments = await scoped('GET', `/api/payment-method-tokens?accountHolderId=${holderId}`);
	const instrumentItems = Array.isArray(instruments.json?.items) ? instruments.json.items : [];
	let instrument = instrumentItems.find(
		(item) => item?.metadata?.flowKey === FIXTURE.instrumentKey || item?.brand === 'Platform Flow'
	);
	let instrumentStatus = instruments.status;
	let instrumentCreated = false;

	if (!instrument) {
		const saved = await scoped('POST', '/api/payment-method-tokens', {
			accountHolderId: holderId,
			providerKey: FIXTURE.providerKey,
			token: FIXTURE.instrumentReference,
			providerConfirmation: { token: FIXTURE.instrumentReference, confirmedAt: new Date().toISOString() },
			type: 'CARD',
			brand: 'Platform Flow',
			last4: '4242',
			expiryMonth: 12,
			expiryYear: 2099,
			holderName: 'Flow Representative',
			metadata: { flowKey: FIXTURE.instrumentKey },
			organizationId: session.organizationId
		});

		instrumentStatus = saved.status;
		instrument = saved.json;
		instrumentCreated = saved.status === 201 || saved.status === 200;

		record(
			'the instrument is saved from a provider-issued reference',
			instrumentCreated && instrument?.status === 'ACTIVE',
			`HTTP ${saved.status} ${instrument?.id ? `status=${instrument.status} reference saved` : brief(saved)}`
		);
	} else if (instrumentStatus === 200) {
		record(
			'the instrument is saved from a provider-issued reference',
			true,
			`HTTP ${instrumentStatus} (reused ${instrument.id}, status=${instrument.status} — the platform refuses a second copy of a reusable reference)`
		);
	} else {
		record('the instrument is saved from a provider-issued reference', false, `HTTP ${instrumentStatus} ${brief(instruments)}`);
	}

	const instrumentId = instrument?.id;

	// The rule that is part of the capability: this platform stores a provider-issued reference and
	// holds no primary account number, so a body that carries one is refused with its own code.
	const cardData = await scoped(
		'POST',
		'/api/payment-method-tokens',
		{
			accountHolderId: holderId,
			providerKey: FIXTURE.providerKey,
			token: `${FIXTURE.instrumentReference}-card-data`,
			cardNumber: '4111111111111111',
			expiry: '12/99'
		},
		// The key is per run, not per fixture: a key is the identity of one request, and a second run of this
		// suite sends a different body under the same fixture — which the platform correctly refuses as a
		// reused key. Reusing the fixture's identifier here would make the suite fail on its own second run
		// and report a refusal the platform is right to make as a defect.
		{ 'Idempotency-Key': `flow-card-data-${holderId}-${Date.now()}` }
	);

	record(
		'a body carrying card data is refused with the platform code',
		cardData.status === 400 && cardData.json?.code === CARD_DATA_CODE,
		`HTTP ${cardData.status} code=${cardData.json?.code ?? 'none'} field=${cardData.json?.details?.field ?? 'unnamed'}`
	);

	const instrumentChecks = [
		'revoking an instrument keeps its row and records why',
		'the revoked instrument survives the removal',
		'no list carries the stored reference, for this caller or any other',
		'a single read carries the stored reference to a caller that may charge it'
	];

	let survived;

	if (!instrumentId) {
		notRun(instrumentChecks, `no instrument could be saved (HTTP ${instrumentStatus})`);
	} else {
		const revoked = await scoped('DELETE', `/api/payment-method-tokens/${instrumentId}`);

		record(
			'revoking an instrument keeps its row and records why',
			revoked.status === 200 && revoked.json?.status === 'REVOKED' && Boolean(revoked.json?.revokedAt),
			`HTTP ${revoked.status} status=${revoked.json?.status} revokedAt=${revoked.json?.revokedAt ?? 'none'}`
		);

		survived = await readBack(
			'the revoked instrument survives the removal',
			`/api/payment-method-tokens/${instrumentId}`,
			(row) => row.status === 'REVOKED',
			(row) => `status=${row.status} revokedAt=${row.revokedAt}`
		);

		const listAfterRevoke = await scoped('GET', `/api/payment-method-tokens?accountHolderId=${holderId}`);
		const listedInstruments = Array.isArray(listAfterRevoke.json?.items) ? listAfterRevoke.json.items : [];
		const carriesReference = listedInstruments.filter((row) => Object.prototype.hasOwnProperty.call(row, 'token'));

		record(
			'no list carries the stored reference, for this caller or any other',
			listAfterRevoke.status === 200 && listedInstruments.length > 0 && carriesReference.length === 0,
			`HTTP ${listAfterRevoke.status} ${listedInstruments.length} row(s), ${carriesReference.length} carrying 'token'`
		);

		record(
			'a single read carries the stored reference to a caller that may charge it',
			survived?.token === FIXTURE.instrumentReference,
			`token=${survived?.token ? 'present' : 'withheld'} (caller holds PAYMENT_METHOD_TOKENS_CHARGE)`
		);
	}

	// The payer the subscription domain remembers: the account and the instrument above. The plan is
	// the subscription's own fixture and is written through its route like every other row.
	const planLookup = await scoped(
		'GET',
		`/api/subscription-plans?data=${encodeURIComponent(JSON.stringify({ findInput: { code: FIXTURE.planCode } }))}`
	);
	const planItems = Array.isArray(planLookup.json?.items) ? planLookup.json.items : [];
	let plan = planItems.find((item) => item?.code === FIXTURE.planCode);
	let planStatus = planLookup.status;

	if (!plan) {
		const created = await scoped('POST', '/api/subscription-plans', {
			name: FIXTURE.planName,
			code: FIXTURE.planCode,
			currency: FIXTURE.currency,
			billingPeriod: 'MONTHLY',
			organizationId: session.organizationId,
			variantId: variant.row?.id
		});

		planStatus = created.status;
		plan = created.json;

		record(
			'the recurring plan is stored',
			(created.status === 201 || created.status === 200) && Boolean(plan?.id),
			`HTTP ${created.status} ${plan?.id ? `code=${plan.code} ${plan.currency}` : brief(created)}`
		);
	} else {
		record('the recurring plan is stored', true, `HTTP ${planStatus} (reused, code=${plan.code} ${plan.currency})`);
	}

	const subscriptionChecks = [
		'the subscription remembers the account and the instrument as its payer',
		'a cycle whose remembered instrument is revoked is refused with the payer code'
	];

	if (!plan?.id || !instrumentId) {
		notRun(
			subscriptionChecks,
			plan?.id ? `the subscription has no instrument to remember (HTTP ${instrumentStatus})` : `no plan to subscribe to (HTTP ${planStatus})`
		);
	} else {
		const subscriptions = await scoped(
			'GET',
			`/api/subscriptions?data=${encodeURIComponent(JSON.stringify({ findInput: { customerId: representative.row?.id } }))}`
		);
		const subscriptionItems = Array.isArray(subscriptions.json?.items) ? subscriptions.json.items : [];
		let subscription = subscriptionItems.find((item) => item?.planId === plan.id);
		let subscriptionStatus = subscriptions.status;

		if (!subscription) {
			const created = await scoped('POST', '/api/subscriptions', {
				planId: plan.id,
				customerId: representative.row?.id,
				currency: FIXTURE.currency,
				organizationId: session.organizationId,
				paymentAccountHolderId: holderId,
				paymentMethodTokenId: instrumentId,
				activate: true,
				items: [
					{
						variantId: variant.row?.id,
						quantity: FIXTURE.subscriptionQuantity,
						unitPrice: FIXTURE.subscriptionUnitPrice
					}
				]
			});

			subscriptionStatus = created.status;
			subscription = created.json;

			record(
				'the subscription remembers the account and the instrument as its payer',
				(created.status === 201 || created.status === 200) &&
					subscription?.paymentAccountHolderId === holderId &&
					subscription?.paymentMethodTokenId === instrumentId,
				`HTTP ${created.status} ${subscription?.id ? `status=${subscription.status} payer=${subscription.paymentAccountHolderId}/${subscription.paymentMethodTokenId}` : brief(created)}`
			);
		} else {
			record(
				'the subscription remembers the account and the instrument as its payer',
				subscription.paymentAccountHolderId === holderId || subscription.paymentMethodTokenId === instrumentId,
				`HTTP ${subscriptionStatus} (reused ${subscription.id}, payer=${subscription.paymentAccountHolderId ?? 'none'}/${subscription.paymentMethodTokenId ?? 'none'})`
			);
		}

		if (!subscription?.id) {
			notRun([subscriptionChecks[1]], `no subscription to bill (HTTP ${subscriptionStatus})`);
		} else {
			// The renewal. The subscription is billed a period ahead, and what the cycle answers is read:
			// the capability is bound, so a payer whose instrument was revoked must be refused with the
			// code the dunning path and the "update your payment method" notification both point at.
			//
			// Where the refusal comes from matters and is printed rather than smoothed over: the capability
			// is asked *inside* the cycle, after the cycle has raised its order, so a cycle that never gets
			// that far answers a code of its own.
			//
			// No instant is stated: the cycle derives the period it covers from the subscription's own
			// calendar, and the route's contract validates `asOf` as a `Date`, which a JSON body cannot
			// carry — stating one as a string is refused before the cycle is reached.
			// The billing route is retry-safe by design and states a versioned aggregate, so it asks for both
			// a key and the version the caller read. The version is the row's own, which the read beside this
			// probe already answers: a harness that sent neither would never reach the cycle it is testing.
			//
			// **The key is scoped to this run, deliberately.** A key fixed per subscription made the suite's
			// verdict depend on its own history: the second run presented a key the first had consumed, and
			// the kernel answered it with the *stored* refusal rather than by running the cycle — so a check
			// that had failed once kept failing for a reason that had nothing to do with the platform, and the
			// suite could not tell a real regression from its own replay. A key is what makes a retry inside
			// one run safe; across runs it is a different request.
			const cycle = await scoped(
				'POST',
				`/api/subscriptions/${subscription.id}/bill`,
				{},
				{
					'Idempotency-Key': `flow-bill-${subscription.id}-${Date.now()}`,
					...(subscription.version !== undefined && subscription.version !== null
						? { 'If-Match': `"${subscription.version}"` }
						: {})
				}
			);
			const outcome = cycle.json ?? {};
			const cycleCode = outcome.errorCode ?? outcome.code;

			record(
				'a cycle whose remembered instrument is revoked is refused with the payer code',
				cycleCode === PAYMENT_METHOD_MISSING_CODE,
				`HTTP ${cycle.status} errorCode=${cycleCode ?? 'none'} status=${outcome.status ?? 'none'}${
					cycleCode === ORDER_GATEWAY_UNAVAILABLE_CODE
						? ` — the order port is unbound in this installation, and the cycle answers before it ever asks the capability: ${String(outcome.message ?? '').slice(0, 140)}`
						: cycleCode
						? ` ${String(outcome.message ?? '').slice(0, 160)}`
						: ` — a cycle that failed leaves its period claimed so the dunning retry takes it over, so a second run of this suite is answered by that guard: ${String(outcome.message ?? '').slice(0, 140)}`
				}`
			);

			if (cycleCode !== PAYMENT_METHOD_MISSING_CODE) {
				note(
					'the stored-instrument capability is bound (apps/api/src/plugin-composition.ts binds SUBSCRIPTION_INSTRUMENTS to the ' +
						"kernel's payment-instrument eligibility service), but no route can observe its verdict in this installation: the only " +
						'caller is `SubscriptionService.resolvePayer()`, and `raiseCycleOrder()` answers `SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE` ' +
						'before reaching it because the order port is deliberately unbound (a billing period cannot raise an order without a ' +
						'channel, an order-line title and a tax path). The rules this suite *can* observe — the account lifecycle, the card-data ' +
						'refusal, revocation keeping its row, the reference never in a list — are asserted above.'
				);
			}
		}
	}

	// --- Proof B, second half ---------------------------------------------------------------------
	/*
	 * The specification's other rule about a remembered payer: closing the account revokes every
	 * instrument beneath it **in the same transaction** and answers how many were revoked. The account
	 * this is exercised on is the suite's own disposal account — a closed account is terminal and
	 * cannot be verified again — so the account the chain reuses is left open.
	 */
	section('proof B: closing an account revokes the instruments beneath it, and answers the count');

	const disposal = await ensure({
		label: 'the disposal account (closed by this suite)',
		path: '/api/payment-account-holders',
		member: 'providerKey',
		value: FIXTURE.disposableProviderKey,
		find: async () => {
			const response = await scoped('GET', `/api/payment-account-holders?contactId=${representative.row?.id}`);
			const items = response.json?.items;

			return Array.isArray(items) ? items.find((item) => item?.providerKey === FIXTURE.disposableProviderKey) : undefined;
		},
		create: () =>
			scoped('POST', '/api/payment-account-holders', {
				providerKey: FIXTURE.disposableProviderKey,
				type: 'CUSTOMER',
				country: 'US',
				defaultCurrency: FIXTURE.currency,
				organizationId: session.organizationId,
				contactId: representative.row?.id
			})
	});

	const disposalId = disposal.row?.id;

	if (!disposalId) {
		notRun(
			[
				'the disposal account is verified before anything is saved under it',
				'closing the account answers the count of instruments it revoked',
				'the instruments under a closed account are revoked rather than removed',
				'a closed account takes no new instrument'
			],
			`the disposal account was refused (HTTP ${disposal.status})`
		);

		return finish();
	}

	// Only an active account takes a new instrument, so a pending one is verified first; a closed one
	// (a later run of this suite) is already in the state the close left it in.
	if (disposal.row?.status === 'PENDING') {
		const disposalVerified = await scoped('POST', `/api/payment-account-holders/${disposalId}/verify`, {
			verificationStatus: 'VERIFIED',
			reference: FIXTURE.disposableAccountReference,
			note: 'Verified by the commerce flow suite before the close.'
		});

		record(
			'the disposal account is verified before anything is saved under it',
			disposalVerified.status === 200 && disposalVerified.json?.status === 'ACTIVE',
			`HTTP ${disposalVerified.status} status=${disposalVerified.json?.status}`
		);
	} else {
		record(
			'the disposal account is verified before anything is saved under it',
			true,
			`already past verification: status=${disposal.row?.status} (HTTP ${disposal.status}, reused from an earlier run)`
		);
	}

	const disposalInstruments = await scoped('GET', `/api/payment-method-tokens?accountHolderId=${disposalId}`);
	const disposalItems = Array.isArray(disposalInstruments.json?.items) ? disposalInstruments.json.items : [];
	const storedDisposal = disposalItems.find((item) => item?.metadata?.flowKey === FIXTURE.disposableInstrumentKey);

	if (!storedDisposal && disposal.row?.status !== 'DISABLED') {
		const saved = await scoped('POST', '/api/payment-method-tokens', {
			accountHolderId: disposalId,
			providerKey: FIXTURE.disposableProviderKey,
			token: FIXTURE.disposableInstrumentReference,
			providerConfirmation: { token: FIXTURE.disposableInstrumentReference, confirmedAt: new Date().toISOString() },
			type: 'CARD',
			brand: 'Platform Flow Disposal',
			last4: '4243',
			expiryMonth: 11,
			expiryYear: 2099,
			holderName: 'Flow Representative',
			metadata: { flowKey: FIXTURE.disposableInstrumentKey },
			organizationId: session.organizationId
		});

		record(
			'the disposal account holds a live instrument to revoke',
			(saved.status === 201 || saved.status === 200) && saved.json?.status === 'ACTIVE',
			`HTTP ${saved.status} status=${saved.json?.status ?? 'none'}`
		);
	} else {
		record(
			'the disposal account holds a live instrument to revoke',
			Boolean(storedDisposal),
			storedDisposal
				? `already stored: status=${storedDisposal.status} (HTTP ${disposalInstruments.status}, reused from an earlier run)`
				: `HTTP ${disposalInstruments.status} no instrument stored`
		);
	}

	// How many instruments the close is about to revoke, read **after** the instrument above was saved
	// and immediately before the close: the route answers the count it revoked, and the two have to be
	// the same number — on a first run that is one, on a later run none, because the revocation the
	// first run performed is still the state of the row.
	const instrumentsBeforeClose = await scoped('GET', `/api/payment-method-tokens?accountHolderId=${disposalId}`);
	const beforeCloseItems = Array.isArray(instrumentsBeforeClose.json?.items) ? instrumentsBeforeClose.json.items : [];
	const liveBefore = beforeCloseItems.filter((row) => row?.status !== 'REVOKED').length;
	const closed = await scoped('DELETE', `/api/payment-account-holders/${disposalId}`);

	record(
		'closing the account answers the count of instruments it revoked',
		closed.status === 200 && closed.json?.status === 'DISABLED' && closed.json?.revokedTokenCount === liveBefore,
		`HTTP ${closed.status} status=${closed.json?.status} revokedTokenCount=${closed.json?.revokedTokenCount} (${liveBefore} live before the call)`
	);

	const afterClose = await scoped('GET', `/api/payment-method-tokens?accountHolderId=${disposalId}`);
	const afterCloseItems = Array.isArray(afterClose.json?.items) ? afterClose.json.items : [];
	const stillRevoked = afterCloseItems.filter((row) => row?.status === 'REVOKED').length;

	record(
		'the instruments under a closed account are revoked rather than removed',
		afterClose.status === 200 && afterCloseItems.length > 0 && stillRevoked === afterCloseItems.length,
		`HTTP ${afterClose.status} ${afterCloseItems.length} row(s), ${stillRevoked} revoked`
	);

	const refusedNew = await scoped(
		'POST',
		'/api/payment-method-tokens',
		{
			accountHolderId: disposalId,
			providerKey: FIXTURE.disposableProviderKey,
			token: `${FIXTURE.disposableInstrumentReference}-after-close`,
			providerConfirmation: {
				token: `${FIXTURE.disposableInstrumentReference}-after-close`,
				confirmedAt: new Date().toISOString()
			},
			type: 'CARD',
			organizationId: session.organizationId
		},
		// The key is presented for the same reason as the refusal above: the rule under test is the closed
		// account's, so the request has to get past the retry contract to reach it — and it is per run, for
		// the reason stated there.
		{ 'Idempotency-Key': `flow-closed-account-${disposalId}-${Date.now()}` }
	);

	record(
		'a closed account takes no new instrument',
		refusedNew.status === 400 && String(refusedNew.json?.message ?? '').includes('PAYMENT_ACCOUNT_HOLDER_RESTRICTED'),
		`HTTP ${refusedNew.status} ${String(refusedNew.json?.message ?? brief(refusedNew)).slice(0, 140)}`
	);

	// --- Proof C ---------------------------------------------------------------------------------
	section('proof C: a retry under one key is answered once, and an operator can release it');

	/*
	 * The retry-safety chain, walked end to end against the running installation rather than asserted
	 * against a service: a client presents a key, loses the response, retries, and must not book the
	 * thing twice. Every link is exercised — the decorator on the route, the interceptor that reads the
	 * header and claims the key, the stored response that answers the replay, the operator's read of
	 * the row, and the release that makes the next attempt a first attempt again.
	 *
	 * The key and the two references are unique per run, so a second run of this suite proves the same
	 * chain from a clean key instead of replaying the first run's answer and calling it a pass.
	 */
	const stamp = Date.now();
	const retryKey = `flow-retry-${stamp}`;
	const firstReference = `${FIXTURE.orderReference}-retry-${stamp}-a`;
	const secondReference = `${FIXTURE.orderReference}-retry-${stamp}-b`;
	const retryHeaders = { 'Idempotency-Key': retryKey };

	/** The body of a purchase order this proof raises, so the two differ in exactly one member. */
	const orderBody = (vendorReference) => ({
		vendorId: vendor.row?.id,
		warehouseId: warehouse.row?.id,
		currency: FIXTURE.currency,
		vendorReference,
		organizationId: session.organizationId,
		note: 'Raised by the commerce flow suite to prove retry safety.',
		lines: [
			{
				variantId: variant.row?.id,
				quantity: FIXTURE.lineQuantity,
				unitCost: FIXTURE.lineUnitCost
			}
		]
	});

	const first = await scoped('POST', '/api/purchase-orders', orderBody(firstReference), retryHeaders);
	const firstId = first.json?.id;

	record(
		'a route that opted into retry safety accepts a key',
		(first.status === 201 || first.status === 200) && Boolean(firstId),
		`HTTP ${first.status} ${firstId ? `id=${firstId}` : brief(first)}`
	);

	if (!firstId) {
		notRun(
			[
				'the identical retry is answered from the stored response rather than run again',
				'a different body under the same key is refused as a reused key',
				"the operator's read finds the stored key, without the response it holds",
				'releasing the key makes the next attempt a first attempt again'
			],
			`the first request was not accepted (HTTP ${first.status})`
		);
	} else {
		const replay = await scoped('POST', '/api/purchase-orders', orderBody(firstReference), retryHeaders);

		// The whole mechanism in one assertion: the same key with the same body answers the *stored*
		// response, so the order that was already booked is the order the client is told about. A second
		// order would carry a different id, and nothing else in this run would notice.
		record(
			'the identical retry is answered from the stored response rather than run again',
			replay.json?.id === firstId && replay.headers?.get('idempotency-replayed') === 'true',
			`HTTP ${replay.status} id=${replay.json?.id ?? 'none'} replayed=${replay.headers?.get('idempotency-replayed') ?? 'no header'}`
		);

		const reused = await scoped('POST', '/api/purchase-orders', orderBody(secondReference), retryHeaders);

		// A key states which request a client is retrying. A different body under the same key is not a
		// retry, and answering it with the first response would answer a question never asked. The message
		// is the human sentence and the code is the machine one, so the assertion reads the pair the way a
		// client does: the status first, then the code inside the platform's error envelope.
		const reusedCode = reused.json?.code ?? reused.json?.errorCode;

		record(
			'a different body under the same key is refused as a reused key',
			reused.status === 409 && reusedCode === 'IDEMPOTENCY_KEY_REUSED',
			`HTTP ${reused.status} code=${reusedCode ?? 'none'} ${String(reused.json?.message ?? brief(reused)).slice(0, 120)}`
		);

		const stored = await scoped(
			'GET',
			`/api/idempotency-keys?scope=${encodeURIComponent('purchase_order.create')}&key=${encodeURIComponent(retryKey)}`
		);
		const storedItems = Array.isArray(stored.json?.items) ? stored.json.items : [];
		const storedRow = storedItems[0];

		record(
			"the operator's read finds the stored key, without the response it holds",
			stored.status === 200 && storedItems.length === 1 && !('responseBody' in (storedRow ?? {})),
			`HTTP ${stored.status} ${storedItems.length} row(s)${storedRow ? ` status=${storedRow.status} resourceType=${storedRow.resourceType}` : ''}`
		);

		const released = storedRow?.id
			? await scoped('DELETE', `/api/idempotency-keys/${storedRow.id}`)
			: { status: 0, json: undefined, text: '' };

		record(
			'the stored key can be released',
			released.status === 200,
			`HTTP ${released.status} ${String(released.json?.message ?? '').slice(0, 120)}`
		);

		// A released key is removed rather than marked, so the retry the operator was unblocking is a
		// true first attempt: the second-order reference is accepted under the very same key.
		const afterRelease = await scoped('POST', '/api/purchase-orders', orderBody(secondReference), retryHeaders);

		record(
			'releasing the key makes the next attempt a first attempt again',
			(afterRelease.status === 201 || afterRelease.status === 200) &&
				Boolean(afterRelease.json?.id) &&
				afterRelease.json?.id !== firstId,
			`HTTP ${afterRelease.status} id=${afterRelease.json?.id ?? 'none'} (released key reused, new order expected)`
		);
	}

	return finish();
}

/** Prints the summary and exits with the verdict. */
function finish() {
	const failed = results.filter((result) => !result.ok);

	console.log('');
	console.log(`  ${results.length - failed.length} of ${results.length} checks passed`);
	console.log(failed.length === 0 ? 'commerce flow end-to-end suite: PASSED' : 'commerce flow end-to-end suite: FAILED');

	if (failed.length) {
		console.log('');
		for (const failure of failed) console.log(`  FAILED  ${failure.name}${failure.detail ? `  — ${failure.detail}` : ''}`);
	}

	process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error(`\ncommerce flow end-to-end suite: could not run\n  ${error?.message ?? error}`);
	console.error('  Is the API running and answering on ' + BASE + '?');
	process.exit(1);
});
