#!/usr/bin/env node
/**
 * The return-receipt end-to-end run: does the order learn that goods came back?
 *
 * **This file exists because nothing watched a receipt, and a defect lived in that silence.**
 * `order_line.returnReceivedQuantity` is one of the five sums `deriveFulfillmentStatus` reads to decide
 * `PARTIALLY_RETURNED` against `RETURNED`, and until this programme's last landing it was **written by
 * nothing in the repository** — announced in the migrations, the contract, the entity and the SDL, read
 * once by the derivation, and assigned only on a unit-test fixture. So a customer could send goods back,
 * have them received into the warehouse and refunded, and the order went on answering `NOT_FULFILLED`.
 *
 * Every instrument the repository had was green while that was true. `commerce-e2e.mjs` lists
 * `/api/order-returns` among the surfaces it checks and drives nothing; `commerce-flow-e2e.mjs` says in
 * its own header that it drives returns and contains no step that mentions one; the unit suites assert
 * the derivation against a fixture that sets the counter by hand. **What none of them did was drive a
 * receipt over HTTP and then read the order back**, which is the one thing that can tell a wired path
 * from an unwired one — the same gap that twice let a declared port be called by nothing.
 *
 * So this run builds the shortest chain that can produce the state: a channel, a warehouse, an order, a
 * line, the fulfilment that ships it, then a return that is approved and received — and then it asks the
 * **GraphQL** surface what the order and its line now say. Two assertions are the point of the file:
 * the line's counter moved, and the order's `fulfillmentStatus` is no longer `NOT_FULFILLED`.
 *
 * It is run by hand against a booted API, like the two suites beside it:
 *
 *   DB_TYPE=better-sqlite3 DB_ORM=typeorm node dist/apps/api/main.js
 *   node tools/scripts/return-receipt-e2e.mjs
 *
 * Environment: `BASE_URL` (default `http://127.0.0.1:3000`), `E2E_EMAIL`, `E2E_PASSWORD`,
 * `E2E_TIMEOUT_MS`.
 *
 * **The wall this file first recorded is gone, and what it measured is kept because it found the cause.**
 * Every receipt used to be refused: `POST …/receive` with `If-Match: 2` for a return at version 2 answered
 * `409 ENTITY_VERSION_CONFLICT { expectedVersion: 2, actualVersion: 1 }`, the refused receipt still moved
 * the return to version 3, and `actualVersion` was 1 whatever the return held. The 1 was the **stock
 * level's** version: the inventory engine read the accepted version off the request and applied the
 * return's number to the level row the receipt posts goods against. Two commits closed it — e0c50c97ab
 * (a stated version is the level's only when the route declares `STOCK_LEVEL_VERSION_TARGET`) and
 * 6efecfb554 (a receipt refused before its header write no longer moves the version on) — and this run
 * passed 17 of 17 against a booted API (better-sqlite3, TypeORM) afterwards.
 *
 * The assertions are deliberately able to fail on a receipt that did nothing: the order is read after the
 * return is raised and before the receipt, the request counter (`returnRequestedQuantity`, doc 10 I-12)
 * must show the units asked for, and the fulfilment status must move from what it was to `RETURNED`.
 */

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = process.env.E2E_EMAIL || 'admin@ever.co';
const PASSWORD = process.env.E2E_PASSWORD || 'admin';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 30_000);

/** The fixtures this run needs, by a stable key so a re-run reuses what the last one made. */
const FIXTURE = {
	channelCode: 'E2E-RETURNS-CHANNEL',
	channelName: 'E2E returns channel',
	warehouseCode: 'E2E-RETURNS-WH',
	warehouseName: 'E2E returns warehouse',
	warehouseEmail: 'e2e-returns@example.com',
	productCode: 'E2E-RETURNS-PRODUCT',
	productName: 'E2E returns product',
	variantReference: 'E2E-RETURNS-VARIANT',
	currency: 'USD'
};

/**
 * The capability gates this run's routes sit behind.
 *
 * `FeatureFlagGuard` answers `404` for a route whose feature is switched off, so a disabled capability
 * and an unmounted one are indistinguishable from outside — the run states the decision it is testing
 * under rather than reporting a default-off package as missing.
 */
const GATED_FEATURES = [
	'FEATURE_ORDER',
	'FEATURE_FULFILLMENT',
	'FEATURE_RETURNS',
	'FEATURE_INVENTORY',
	'FEATURE_WAREHOUSE',
	'FEATURE_GRAPHQL'
];

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
 * `Tenant-Id` is sent because a token authenticates but does not scope: the guard compares the
 * statement with the tenant the credential carries, and without the header every guarded route answers
 * 403. The header is spelled exactly as shown — the guard matches the raw name.
 *
 * @param {string} method The HTTP method.
 * @param {string} url The path, beginning with a slash.
 * @param {{token?: string, tenantId?: string, body?: unknown, headers?: Record<string, string>}} [options]
 * Credential, tenant, body and any header the route itself demands.
 * @returns {Promise<{status: number, json: any, text: string}>} The response.
 */
async function call(method, url, options = {}) {
	const { token, tenantId, body, headers } = options;
	const response = await fetch(`${BASE}${url}`, {
		method,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {}),
			...(headers ?? {})
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
 * Switches on every capability this run's routes sit behind.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {string} organizationId The organization the toggles are stated for, which is how the platform
 * scopes a feature decision — a toggle that named no organization is a tenant-wide row the run would be
 * reading a different answer from.
 * @returns {Promise<void>}
 */
async function enableGatedCapabilities(api, organizationId) {
	const catalogue = await api('GET', '/api/feature/toggle');
	const idByCode = new Map((catalogue.json?.items ?? []).map((feature) => [feature.code, feature.id]));
	const toggles = await api('GET', '/api/feature/toggle/organizations');
	const enabled = new Set(
		(toggles.json?.items ?? []).filter((row) => row.isEnabled === true).map((row) => row.featureId)
	);

	const missing = [];

	for (const code of GATED_FEATURES) {
		const featureId = idByCode.get(code);

		if (!featureId) {
			missing.push(`${code} is not in the catalogue`);
			continue;
		}

		if (enabled.has(featureId)) continue;

		const answer = await api('POST', '/api/feature/toggle', { featureId, isEnabled: true, organizationId });

		if (answer.status !== 200 && answer.status !== 201) {
			missing.push(`${code} (HTTP ${answer.status})`);
		}
	}

	record(
		'every capability this run drives is switched on',
		missing.length === 0,
		missing.length ? `not enabled: ${missing.join(', ')}` : `${GATED_FEATURES.length} capabilities on`
	);
}

/**
 * Finds a fixture row by one member, or creates it.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {{path: string, member: string, value: string, body: Record<string, unknown>, label: string}} step
 * The lookup and the create.
 * @returns {Promise<any | undefined>} The stored row.
 */
async function ensureRow(api, step) {
	const listed = await api('GET', step.path);
	const items = Array.isArray(listed.json?.items) ? listed.json.items : [];
	const existing = items.find((row) => row?.[step.member] === step.value);

	if (existing?.id) {
		record(`${step.label} is available`, true, `reused (${step.member}=${step.value})`);

		return existing;
	}

	const created = await api('POST', step.path, step.body);

	if ((created.status === 200 || created.status === 201) && created.json?.id) {
		record(`${step.label} is available`, true, `HTTP ${created.status} (created)`);

		return created.json;
	}

	// A create refused because the row is already there is the unique index doing its job, so the
	// lookup is repeated before the step is called a failure.
	const afterRefusal = (await api('GET', step.path)).json?.items?.find((row) => row?.[step.member] === step.value);

	record(
		`${step.label} is available`,
		Boolean(afterRefusal?.id),
		afterRefusal?.id ? `reused after a refusal (HTTP ${created.status})` : `HTTP ${created.status} ${brief(created)}`
	);

	return afterRefusal;
}

/**
 * Asks the GraphQL surface what an order and its lines say.
 *
 * The read is the second half of this file's point: the receipt is written over REST and the *answer* is
 * read over GraphQL, so the two surfaces are compared rather than one being trusted.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {string} orderId The order to read.
 * @returns {Promise<any | undefined>} The order as the schema answers it.
 */
async function readOrder(api, orderId) {
	const query =
		`query ($id: ID!) { order(id: $id) { id fulfillmentStatus ` +
		`lines { id returnRequestedQuantity returnReceivedQuantity returnDismissedQuantity } } }`;
	const answered = await api('POST', '/graphql', { query, variables: { id: orderId } });

	return answered.json?.data?.order;
}

/** Prints the summary and exits with the run's verdict. */
function finish() {
	const failed = results.filter((result) => !result.ok);
	console.log('');
	console.log(`  ${results.length - failed.length} of ${results.length} checks passed`);

	if (failed.length) {
		console.log('');
		for (const result of failed) {
			console.log(`  FAILED: ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
		}
	}

	console.log(`  return receipt end-to-end run: ${failed.length ? 'FAILED' : 'PASSED'}`);
	process.exit(failed.length ? 1 : 0);
}

async function main() {
	console.log('');
	console.log('return receipt end-to-end run');
	console.log('=============================');
	console.log(`  ${BASE}`);

	const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;
	// The channel and the warehouse are organization-scoped resources, and the guard compares the row's
	// organization with the caller's — the employee record the credential carries is where it is stated.
	const organizationId = login.json?.user?.employee?.organizationId;

	record(
		'a real credential signs in over REST',
		login.status === 200 && Boolean(token),
		`HTTP ${login.status}${token ? '' : ` ${brief(login)}`}`
	);

	if (!token) return finish();

	if (!organizationId) {
		record('the credential names the organization it acts in', false, brief(login));

		return finish();
	}

	const api = (method, path, body, headers) => call(method, path, { token, tenantId, body, headers });

	/**
	 * The key a required-idempotency route is called under.
	 *
	 * `POST /api/fulfillments` and `POST /api/order-returns/:id/receive` declare
	 * `@Idempotent({ required: true })`, so a call without a key is refused with
	 * `IDEMPOTENCY_KEY_REQUIRED` — which is the platform telling the caller that a shipment is not
	 * something to create twice by accident. The key is fresh per run rather than stable: the bodies
	 * differ between runs (each places a new order), and a key reused under a different body is refused
	 * as `IDEMPOTENCY_KEY_REUSED` rather than replayed.
	 *
	 * @param {string} scope What the key is for.
	 * @returns {Record<string, string>} The header.
	 */
	const retrySafe = (scope) => ({ 'Idempotency-Key': `e2e-return-receipt-${scope}-${Date.now()}` });

	/**
	 * States the organization every write in this run belongs to.
	 *
	 * `TenantOrganizationBaseDTO` is the base of nearly every create on this surface and it requires the
	 * organization explicitly: the `Tenant-Id` header scopes the caller, and the row still has to say
	 * which of the tenant's organizations owns it — a create that named none is refused with
	 * `organizationId must be a UUID`, which is what the first run of this file reported.
	 *
	 * @param {Record<string, unknown>} body The create's own fields.
	 * @returns {Record<string, unknown>} The body with the organization stated.
	 */
	const owned = (body) => ({ ...body, organizationId });

	await enableGatedCapabilities(api, organizationId);

	// --- the shortest chain that can produce the state ------------------------------------------
	const channel = await ensureRow(api, {
		label: 'a sales channel',
		path: '/api/channels',
		member: 'code',
		value: FIXTURE.channelCode,
		body: {
			name: FIXTURE.channelName,
			code: FIXTURE.channelCode,
			defaultCurrency: FIXTURE.currency,
			organizationId
		}
	});
	const warehouse = await ensureRow(api, {
		label: 'a warehouse to receive into',
		path: '/api/warehouses',
		member: 'code',
		value: FIXTURE.warehouseCode,
		body: {
			name: FIXTURE.warehouseName,
			code: FIXTURE.warehouseCode,
			email: FIXTURE.warehouseEmail,
			organizationId
		}
	});

	if (!channel?.id || !warehouse?.id) return finish();

	// The catalogue rows the line names. A stock movement has to be tied to a variant — the return's own
	// ledger movement is refused without one — so a line that names no variant cannot be received back.
	const product = await ensureRow(api, {
		label: 'a product',
		path: '/api/products',
		member: 'code',
		value: FIXTURE.productCode,
		body: {
			code: FIXTURE.productCode,
			name: FIXTURE.productName,
			description: 'The product the return receipt run sends back.',
			enabled: true,
			type: { name: 'E2E returns type' },
			category: { name: 'E2E returns category' },
			optionGroupCreateInputs: [],
			organizationId
		}
	});

	if (!product?.id) return finish();

	const variant = await ensureRow(api, {
		label: 'a variant of it',
		path: '/api/product-variants',
		member: 'internalReference',
		value: FIXTURE.variantReference,
		body: {
			productId: product.id,
			internalReference: FIXTURE.variantReference,
			notes: 'The variant the returned line names.',
			enabled: true,
			organizationId
		}
	});

	if (!variant?.id) return finish();

	const order = await api('POST', '/api/orders', owned({ channelId: channel.id, currency: FIXTURE.currency }));

	record(
		'an order is placed',
		(order.status === 200 || order.status === 201) && Boolean(order.json?.id),
		`HTTP ${order.status} ${order.json?.id ? `id=${order.json.id}` : brief(order)}`
	);

	if (!order.json?.id) return finish();

	const orderId = order.json.id;
	const line = await api('POST', '/api/order-lines', owned({
		orderId,
		productId: product.id,
		// The variant is what the receipt's own stock movement is posted against: the ledger refuses a
		// movement it cannot tie to one, so a line with no variant cannot be received back at all.
		variantId: variant.id,
		title: 'E2E returned unit',
		quantity: 2,
		// `originalUnitPrice` is what the line was sold at before any discount, it is `NOT NULL` on the
		// table with no default, and the DTO marks it optional — so a create that omits it is refused by
		// the database and answered as "A required field is missing.", which is what this run's second
		// attempt reported. The field is stated here because the column requires it.
		unitPrice: 10,
		originalUnitPrice: 10,
		isTaxInclusive: false,
		isDiscountable: true,
		requiresShipping: true,
		position: 0
	}));

	record(
		'a line is added to it',
		(line.status === 200 || line.status === 201) && Boolean(line.json?.id),
		`HTTP ${line.status} ${line.json?.id ? `id=${line.json.id}` : brief(line)}`
	);

	if (!line.json?.id) return finish();

	const orderLineId = line.json.id;
	const shipped = await api('POST', '/api/fulfillments', owned({
		orderId,
		direction: 'OUTBOUND',
		warehouseId: warehouse.id,
		lines: [{ orderLineId, quantity: 2 }]
	}), retrySafe('fulfillment'));

	record(
		'the line ships, which is what a return is measured against',
		(shipped.status === 200 || shipped.status === 201) && Boolean(shipped.json?.id),
		`HTTP ${shipped.status}${shipped.json?.id ? ` id=${shipped.json.id}` : ` ${brief(shipped)}`}`
	);

	// --- the return, approved and received ------------------------------------------------------
	const raised = await api('POST', '/api/order-returns', owned({
		orderId,
		currency: FIXTURE.currency,
		lines: [{ orderLineId, quantity: '2' }]
	}));
	const returnId = raised.json?.id;

	// The line's identifier is read back from the stored return rather than taken from the create
	// response: what a create echoes is the request it accepted, and the receipt names a row.
	const stored = returnId ? await api('GET', `/api/order-returns/${returnId}`) : { json: undefined };
	const returnLineId = stored.json?.lines?.[0]?.id ?? raised.json?.lines?.[0]?.id;

	record(
		'a return is requested against the fulfilled line',
		(raised.status === 200 || raised.status === 201) && Boolean(returnId && returnLineId),
		`HTTP ${raised.status}${returnId ? ` id=${returnId} line=${returnLineId ?? 'not answered'}` : ` ${brief(raised)}`}`
	);


	if (!returnId || !returnLineId) return finish();

	// **What the order says once the return is asked for, before anything comes back.** Two readings are
	// taken here. The requested-return counter is the bound doc 10 invariant I-12 holds the received one
	// to, and nothing in the returns flow wrote it: a return of two units left it at 0. And the status is
	// recorded so the receipt's effect can be told apart from the shipment's — the fulfilment above
	// already recomputed the order, so it is `FULFILLED` before any receipt, and a check that only asked
	// for "not `NOT_FULFILLED`" afterwards passed whether or not the receipt moved anything.
	const requestedRead = await readOrder(api, orderId);
	const requestedLine = (requestedRead?.lines ?? []).find((entry) => entry.id === orderLineId);
	const statusBeforeReceipt = requestedRead?.fulfillmentStatus;

	record(
		"the order line's requested-return counter moved by what the return asks for",
		Number(requestedLine?.returnRequestedQuantity ?? 0) === 2,
		`returnRequestedQuantity=${requestedLine?.returnRequestedQuantity ?? 'not answered'}`
	);
	record(
		'diagnostic: the fulfilment status before the receipt',
		true,
		`fulfillmentStatus=${statusBeforeReceipt ?? 'not answered'}`
	);

	/**
	 * The version a write must be predicated on.
	 *
	 * Every transition of a return is `@Versioned`, so a call that states no version is refused with
	 * `VERSION_REQUIRED` — the platform refusing to let one operator's decision be written over another
	 * reader's stale copy. The version is read here rather than carried from the create response because
	 * the approve has already moved it by the time the receive runs.
	 *
	 * @returns {Promise<string>} The header value for the next write.
	 */
	const readVersion = async (label) => {
		const current = await api('GET', `/api/order-returns/${returnId}`);

		record(
			`diagnostic: the version and status before the ${label}`,
			true,
			`version=${current.json?.version ?? 'none'} status=${current.json?.status ?? 'none'}`
		);

		return String(current.json?.version ?? '');
	};

	const approved = await api(
		'POST',
		`/api/order-returns/${returnId}/approve`,
		{ note: 'e2e approval' },
		{ 'If-Match': await readVersion('approve') }
	);

	record(
		'the return is approved, which is the state a receipt requires',
		approved.status === 200 || approved.status === 201,
		`HTTP ${approved.status}${approved.status === 200 || approved.status === 201 ? '' : ` ${brief(approved)}`}`
	);

	const receiptBody = owned({
		warehouseId: warehouse.id,
		lines: [{ lineId: returnLineId, receivedQuantity: 2, damagedQuantity: 0, restock: true }]
	});
	const statedVersion = await readVersion('receive');
	let received = await api('POST', `/api/order-returns/${returnId}/receive`, receiptBody, {
		...retrySafe('receive'),
		'If-Match': statedVersion
	});
	let acceptedBy = received.status < 300 ? 'REST' : undefined;

	// **When REST refuses the version the caller just read, the other surface is asked the same question.**
	// `If-Match` is a contract — a client states the version it read — and the two surfaces state it
	// differently: REST in a header, GraphQL as a member of the input. Which of them accepts the receipt
	// is recorded rather than worked around, because a receipt that only one surface can drive is a
	// finding about the platform and not a detail of this run.
	if (!acceptedBy) {
		record(
			'the version a read just stated is accepted by the REST receipt route',
			false,
			`read version=${statedVersion}, refused HTTP ${received.status} ` +
				`${received.json?.code ?? ''} actualVersion=${received.json?.details?.actualVersion ?? 'none'}`
		);

		// **The remedy the platform itself names.** The conflict says "Read it again and reapply your
		// change", so that is what a client is entitled to expect to work: the version is read afresh and
		// the same receipt is sent again. What the row holds after the refusal is recorded too, because a
		// refused write that still *moved* the version is a different defect from one that only misread
		// it — and the difference decides whether the fix is in the guard's read or in the write.
		const afterRefusal = await readVersion('refused REST receipt');
		const reapplied = await api('POST', `/api/order-returns/${returnId}/receive`, receiptBody, {
			...retrySafe('receive-reapplied'),
			'If-Match': afterRefusal
		});

		acceptedBy = reapplied.status < 300 ? 'REST (re-read and reapplied)' : undefined;

		record(
			'the remedy the conflict names — read it again and reapply — reaches the receipt',
			Boolean(acceptedBy),
			`HTTP ${reapplied.status} with If-Match=${afterRefusal}` +
				`${
					reapplied.status < 300
						? ''
						: ` ${reapplied.json?.code ?? ''} actualVersion=${reapplied.json?.details?.actualVersion ?? 'none'}`
				}`
		);

		// **The discriminator.** A plain versioned update on the same row, with the same freshly-read
		// version, tells the next reader whether the defect is the receipt's route or the returns service's
		// write path — and it is one call rather than another wave of guessing.
		const plainUpdate = await api(
			'PUT',
			`/api/order-returns/${returnId}`,
			{ note: 'e2e version probe' },
			{ 'If-Match': await readVersion('plain versioned update') }
		);

		record(
			'a plain versioned update on the same row is accepted',
			plainUpdate.status < 300,
			`HTTP ${plainUpdate.status}${plainUpdate.status < 300 ? '' : ` ${plainUpdate.json?.code ?? ''} actualVersion=${plainUpdate.json?.details?.actualVersion ?? 'none'}`}`
		);
	}

	record(
		'the goods are received back into the warehouse',
		Boolean(acceptedBy),
		`accepted by ${acceptedBy ?? 'neither surface'}`
	);

	// --- what the order now says, read over the other surface -----------------------------------
	const read = await readOrder(api, orderId);
	const readLine = (read?.lines ?? []).find((entry) => entry.id === orderLineId);
	const counter = Number(readLine?.returnReceivedQuantity ?? 0);

	// **The assertion this file was written for.** Before the counter had a writer this was `0` however
	// many units came back, because nothing assigned the column.
	record(
		"the order line's received-return counter moved by what arrived",
		counter === 2,
		`returnReceivedQuantity=${readLine?.returnReceivedQuantity ?? 'not answered'}`
	);

	// And the consequence the counter exists for: the derivation reads it, so the order must now say the
	// goods came back. The order has one line of two, both units shipped and both received, so the one
	// correct answer is `RETURNED` — and it has to differ from what the order said before the receipt,
	// which was the shipment's `FULFILLED`. The check this replaces accepted anything but `NOT_FULFILLED`,
	// which the shipment had already produced: it passed with the receipt's recompute removed.
	record(
		'the order’s fulfilment status says the goods came back, which the shipment alone did not',
		read?.fulfillmentStatus === 'RETURNED' && read.fulfillmentStatus !== statusBeforeReceipt,
		`before=${statusBeforeReceipt ?? 'not answered'} after=${read?.fulfillmentStatus ?? 'not answered'}`
	);

	// Doc 10 invariant I-12, read off the order the way a client reads it: what came back — sound, broken
	// or dismissed — never exceeds what was asked back.
	const requestedAfter = Number(readLine?.returnRequestedQuantity ?? 0);
	const dismissed = Number(readLine?.returnDismissedQuantity ?? 0);

	record(
		'what came back is bounded by what was asked back (I-12)',
		readLine !== undefined && counter + dismissed <= requestedAfter,
		`received=${readLine?.returnReceivedQuantity ?? 'not answered'} dismissed=${
			readLine?.returnDismissedQuantity ?? 'not answered'
		} requested=${readLine?.returnRequestedQuantity ?? 'not answered'}`
	);

	const settled = await api('GET', `/api/order-returns/${returnId}`);

	record(
		'the return itself is in a received state',
		['RECEIVED', 'PARTIALLY_RECEIVED'].includes(settled.json?.status),
		`status=${settled.json?.status ?? 'not answered'}`
	);

	return finish();
}

main().catch((error) => {
	console.log('');
	console.log(`  the run could not finish: ${error?.message ?? error}`);
	process.exit(1);
});
