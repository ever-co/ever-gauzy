#!/usr/bin/env node
/**
 * Q7-W1b end-to-end run: does a payment reach the order, and does the paid order complete?
 *
 * **The defects this run watches.** Nothing wrote the core `payment` row an authorised session stands for,
 * so every capture was refused `PAYMENT_NOT_AUTHORIZED`; a cart's payment collection was never handed to
 * the order the cart became; nothing wrote an AUTHORIZATION / CAPTURE / REFUND row on the order's money
 * ledger, so an order paid in full answered `NOT_PAID` with its whole total outstanding; and
 * `completeIfSettled` had no caller, so no order ever reached `COMPLETED`.
 *
 * The chain: a cart with one line that needs no shipping → a payment collection for the cart → a session,
 * authorised (REST) → the cart is completed (REST) → the order is read over GraphQL (`AUTHORIZED`, the
 * authorisation on its ledger) → the payment is captured over **GraphQL** (`capturePayment`) → the order is
 * read over REST: `CAPTURED`, nothing outstanding, `COMPLETED`, each money fact on its ledger exactly once.
 * Then the operator door: an unpaid order is refused `ORDER_NOT_COMPLETABLE` by both `POST
 * /api/orders/:id/complete` and `completeOrder`, and the completed one is answered as it is.
 *
 * Run by hand against a booted API (see `commerce-wiring-harness.mjs` for the environment):
 *
 *   DB_TYPE=better-sqlite3 DB_ORM=typeorm node dist/apps/api/main.js
 *   node tools/scripts/commerce-payment-order-e2e.mjs
 */
import {
	brief,
	enableCapabilities,
	ensureCatalogue,
	ensureRow,
	finish,
	ok,
	record,
	sameMoney,
	signIn,
	versionOf
} from './commerce-wiring-harness.mjs';

const RUN = 'commerce payment → order end-to-end run';
const PREFIX = 'E2E-Q7-W1B';

/**
 * Opens a cart with one line that needs no shipping.
 *
 * @returns {Promise<undefined | {cart: any, version: string | undefined}>}
 */
async function openCart(session, catalogue, label) {
	const { api, owned } = session;
	const created = await api(
		'POST',
		'/api/carts',
		owned({
			channelId: catalogue.channel.id,
			currency: 'USD',
			currencyDecimals: 2,
			email: 'e2e-q7-w1b@example.com'
		})
	);

	record(
		`${label}: a cart is opened`,
		ok(created) && Boolean(created.json?.id),
		`HTTP ${created.status} ${brief(created)}`
	);

	if (!created.json?.id) return undefined;

	const line = await api(
		'POST',
		`/api/carts/${created.json.id}/lines`,
		owned({
			cartId: created.json.id,
			productId: catalogue.product.id,
			variantId: catalogue.variant.id,
			title: 'E2E Q7-W1b unit',
			quantity: 2,
			unitPrice: '15.00',
			originalUnitPrice: '15.00',
			isTaxInclusive: false,
			isDiscountable: true,
			requiresShipping: false
		}),
		versionOf(created) ? { 'If-Match': versionOf(created) } : undefined
	);

	record(
		`${label}: a line that needs no shipping is added`,
		ok(line),
		`HTTP ${line.status}${ok(line) ? '' : ` ${brief(line)}`}`
	);

	if (!ok(line)) return undefined;

	const cart = (await api('GET', `/api/carts/${created.json.id}`)).json;

	return { cart, version: versionOf({ json: cart }) };
}

/**
 * Completes a cart over REST.
 *
 * @returns {Promise<string | undefined>} The order id.
 */
async function completeCart(session, opened, label) {
	const { api, key } = session;
	const completed = await api(
		'POST',
		`/api/carts/${opened.cart.id}/complete`,
		{ idempotencyKey: key(`${label}-complete`) },
		{ 'Idempotency-Key': key(`${label}-complete`), ...(opened.version ? { 'If-Match': opened.version } : {}) }
	);

	record(
		`${label}: the cart is completed`,
		ok(completed) && Boolean(completed.json?.orderId),
		`HTTP ${completed.status} ${brief(completed)}`
	);

	return completed.json?.orderId;
}

/** The order's money ledger, read over REST. */
async function ledgerOf(session, orderId) {
	return (await session.api('GET', `/api/orders/${orderId}/transactions`)).json?.items ?? [];
}

async function main() {
	console.log('');
	console.log(RUN);
	console.log('='.repeat(RUN.length));

	const session = await signIn('q7-w1b');

	if (!session) return finish(RUN);

	const { api, gql, key, owned, organizationId } = session;

	await enableCapabilities(api, organizationId, [
		'FEATURE_CART',
		'FEATURE_ORDER',
		'FEATURE_PAYMENT',
		'FEATURE_GRAPHQL'
	]);

	const catalogue = await ensureCatalogue(api, organizationId, PREFIX);
	const provider = await ensureRow(api, {
		label: 'a payment provider',
		path: '/api/payment-providers',
		member: 'code',
		value: `${PREFIX}-PROVIDER`,
		body: owned({ code: `${PREFIX}-PROVIDER`, name: 'E2E Q7-W1b provider', isEnabled: true, isTestMode: true })
	});

	if (!catalogue || !provider?.id) return finish(RUN);

	// --- 1. pay at checkout: collection for the cart, session authorised, cart completed (REST) --------
	const paid = await openCart(session, catalogue, 'paid');

	if (!paid) return finish(RUN);

	const amount = String(paid.cart.grandTotal);
	const collection = await api(
		'POST',
		'/api/payment-collections',
		owned({ cartId: paid.cart.id, amount, currency: 'USD' }),
		{ 'Idempotency-Key': key('collection') }
	);

	record(
		'a payment collection is opened for the cart',
		ok(collection) && Boolean(collection.json?.id),
		`HTTP ${collection.status} ${brief(collection)}`
	);

	const opened = await api(
		'POST',
		'/api/payment-sessions',
		owned({ collectionId: collection.json?.id, providerId: provider.id, amount, currency: 'USD' }),
		{ 'Idempotency-Key': key('session') }
	);

	record(
		'a payment session is opened',
		ok(opened) && Boolean(opened.json?.id),
		`HTTP ${opened.status} ${brief(opened)}`
	);

	const authorized = await api(
		'POST',
		`/api/payment-sessions/${opened.json?.id}/authorize`,
		{},
		{
			'Idempotency-Key': key('authorize')
		}
	);

	record(
		'the session is authorised',
		ok(authorized) && authorized.json?.status === 'AUTHORIZED',
		`HTTP ${authorized.status} ${brief(authorized)}`
	);

	const orderId = await completeCart(session, paid, 'paid');

	if (!orderId) return finish(RUN);

	const afterCheckout = (
		await gql(
			`query ($id: ID!) { order(id: $id) { id status paymentStatus paidTotal outstandingTotal grandTotal } }`,
			{
				id: orderId
			}
		)
	).json?.data?.order;

	record(
		'GraphQL: the order knows its payment was authorised at checkout (was NOT_PAID before Q7-W1b)',
		afterCheckout?.paymentStatus === 'AUTHORIZED',
		JSON.stringify(afterCheckout)
	);

	const authorization = (await ledgerOf(session, orderId)).find((row) => row.type === 'AUTHORIZATION');

	record(
		"the authorisation is on the order's ledger, naming the payment it stands for",
		Boolean(authorization) && authorization.referenceType === 'PAYMENT' && sameMoney(authorization.amount, amount),
		JSON.stringify(authorization ?? null)
	);

	if (!authorization?.referenceId) return finish(RUN);

	// --- 2. capture over GraphQL, read the order over REST ------------------------------------------------
	const captured = await gql(
		`mutation ($input: CapturePaymentInput!) { capturePayment(input: $input) { paymentCapture { id amount } userErrors { message } } }`,
		{ input: { paymentId: authorization.referenceId, amount, currency: 'USD', idempotencyKey: key('capture') } }
	);
	const capture = captured.json?.data?.capturePayment?.paymentCapture;

	record(
		'GraphQL: the payment is captured (was PAYMENT_NOT_AUTHORIZED before Q7-W1b)',
		Boolean(capture?.id),
		brief(captured)
	);

	const settled = (await api('GET', `/api/orders/${orderId}`)).json;

	record(
		'REST: the order is captured',
		settled?.paymentStatus === 'CAPTURED',
		`paymentStatus ${settled?.paymentStatus}`
	);
	record(
		'REST: nothing is outstanding on the order',
		sameMoney(settled?.outstandingTotal, 0),
		`outstanding ${settled?.outstandingTotal}`
	);
	record(
		'REST: the paid order with nothing to ship completed by itself',
		settled?.status === 'COMPLETED',
		`status ${settled?.status}`
	);

	const ledger = await ledgerOf(session, orderId);
	const count = (type) => ledger.filter((row) => row.type === type).length;

	record(
		'each money fact is on the ledger exactly once',
		count('AUTHORIZATION') === 1 && count('CAPTURE') === 1,
		ledger.map((row) => `${row.type}:${row.amount}`).join(', ')
	);

	// --- 3. the operator door ---------------------------------------------------------------------------
	const again = await api(
		'POST',
		`/api/orders/${orderId}/complete`,
		{},
		{ 'If-Match': String(settled?.version ?? '') }
	);

	record(
		'REST: completing a completed order answers it as it is',
		ok(again) && again.json?.status === 'COMPLETED',
		`HTTP ${again.status} ${brief(again)}`
	);

	const unpaid = await openCart(session, catalogue, 'unpaid');
	const unpaidOrderId = unpaid ? await completeCart(session, unpaid, 'unpaid') : undefined;

	if (unpaidOrderId) {
		const current = await api('GET', `/api/orders/${unpaidOrderId}`);
		const refused = await api(
			'POST',
			`/api/orders/${unpaidOrderId}/complete`,
			{},
			{ 'If-Match': versionOf(current) ?? '' }
		);

		record(
			'REST: an unpaid order is refused ORDER_NOT_COMPLETABLE, with what stands in the way',
			refused.status === 409 && JSON.stringify(refused.json ?? {}).includes('ORDER_NOT_COMPLETABLE'),
			`HTTP ${refused.status} ${brief(refused)}`
		);

		const viaGraphql = await gql(
			`mutation ($id: ID!, $version: Int) { completeOrder(id: $id, version: $version) { id status } }`,
			{
				id: unpaidOrderId,
				version: Number(versionOf(current))
			}
		);

		record(
			'GraphQL: completeOrder refuses the unpaid order the same way',
			JSON.stringify(viaGraphql.json?.errors ?? []).includes('ORDER_NOT_COMPLETABLE'),
			brief(viaGraphql)
		);
	}

	finish(RUN);
}

main().catch((error) => {
	record('the run completed without an unexpected error', false, error?.stack ?? String(error));
	finish(RUN);
});
