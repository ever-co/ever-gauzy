#!/usr/bin/env node
/**
 * Q7-W1c end-to-end run: does an order use the promotion it was granted, and does the limit hold?
 *
 * **The defect this run watches.** The cart asks the promotion engine what a code grants (R3-07) and
 * nothing ever recorded that the promotion was used: `promotion_usage` stayed empty, `usageCount` never
 * moved, and a promotion limited to one order could be redeemed by every order.
 *
 * The chain, with a fresh promotion limited to **one** order (a new code per run, so the limit is fresh):
 * 1. cart A gets the code and is completed over REST → the promotion's ledger (`GET
 *    /api/promotions/:id/usage`) holds one `REGISTERED` redemption for the order, and GraphQL
 *    `promotion { usageCount }` says 1;
 * 2. cart B gets the same code and is completed over **GraphQL** (`completeCheckout`) → refused: the
 *    engine grants nothing more, or the checkout answers `PROMOTION_USAGE_LIMIT_REACHED` — and either way
 *    no second redemption is written;
 * 3. order A is cancelled over REST → the redemption is reverted and `usageCount` is back to 0;
 * 4. two carts granted a fresh one-use code are completed **concurrently** → exactly one order, the other
 *    refused `PROMOTION_USAGE_LIMIT_REACHED`, one live redemption.
 *
 * Run by hand against a booted API (see `commerce-wiring-harness.mjs` for the environment):
 *
 *   DB_TYPE=better-sqlite3 DB_ORM=typeorm node dist/apps/api/main.js
 *   node tools/scripts/commerce-promotion-usage-e2e.mjs
 */
import {
	brief,
	enableCapabilities,
	ensureCatalogue,
	ensurePromotion,
	finish,
	ok,
	record,
	signIn,
	versionOf
} from './commerce-wiring-harness.mjs';

const RUN = 'commerce promotion usage end-to-end run';
const PREFIX = 'E2E-Q7-W1C';

/**
 * Opens a cart with one line and applies a promotion code to it over REST.
 *
 * @returns {Promise<undefined | {cart: any, applied: boolean}>}
 */
async function cartWithCode(session, catalogue, code, label) {
	const { api, owned } = session;
	const created = await api(
		'POST',
		'/api/carts',
		owned({
			channelId: catalogue.channel.id,
			currency: 'USD',
			currencyDecimals: 2,
			email: 'e2e-q7-w1c@example.com'
		})
	);

	if (!created.json?.id) {
		record(`${label}: a cart is opened`, false, brief(created));

		return undefined;
	}

	const cartId = created.json.id;
	const line = await api(
		'POST',
		`/api/carts/${cartId}/lines`,
		owned({
			cartId,
			productId: catalogue.product.id,
			variantId: catalogue.variant.id,
			title: 'E2E Q7-W1c unit',
			quantity: 1,
			unitPrice: '30.00',
			originalUnitPrice: '30.00',
			requiresShipping: false
		}),
		versionOf(created) ? { 'If-Match': versionOf(created) } : undefined
	);

	record(
		`${label}: a cart with one line is opened`,
		ok(line),
		`HTTP ${line.status}${ok(line) ? '' : ` ${brief(line)}`}`
	);

	const applied = await api(
		'POST',
		`/api/carts/${cartId}/promotions`,
		owned({ cartId, code }),
		versionOf(line) ? { 'If-Match': versionOf(line) } : undefined
	);
	const cart = (await api('GET', `/api/carts/${cartId}`)).json;

	return { cart, applied: ok(applied) && Number(cart?.discountTotal ?? 0) > 0 };
}

/** The promotion's redemption ledger over REST, and its counter over GraphQL. */
async function usageOf(session, promotionId) {
	const ledger = (await session.api('GET', `/api/promotions/${promotionId}/usage`)).json;
	const counter = (
		await session.gql(`query ($id: ID!) { promotion(id: $id) { id usageCount } }`, { id: promotionId })
	).json?.data?.promotion?.usageCount;

	return { rows: ledger?.items ?? (Array.isArray(ledger) ? ledger : []), counter };
}

async function main() {
	console.log('');
	console.log(RUN);
	console.log('='.repeat(RUN.length));

	const session = await signIn('q7-w1c');

	if (!session) return finish(RUN);

	const { api, gql, key, organizationId } = session;

	await enableCapabilities(api, organizationId, [
		'FEATURE_CART',
		'FEATURE_ORDER',
		'FEATURE_PROMOTION',
		'FEATURE_GRAPHQL'
	]);

	const code = `${PREFIX}-ONCE-${Date.now()}`;
	const catalogue = await ensureCatalogue(api, organizationId, PREFIX);
	const promotion = await ensurePromotion(api, organizationId, { code, value: '5', usageLimit: 1 });

	if (!catalogue || !promotion?.id) return finish(RUN);

	// --- 1. the first order uses it ------------------------------------------------------------------
	const first = await cartWithCode(session, catalogue, code, 'cart A');

	record(
		'cart A is granted the promotion',
		Boolean(first?.applied),
		JSON.stringify({ discountTotal: first?.cart?.discountTotal })
	);

	if (!first?.applied) return finish(RUN);

	const completed = await api(
		'POST',
		`/api/carts/${first.cart.id}/complete`,
		{ idempotencyKey: key('a-complete') },
		{
			'Idempotency-Key': key('a-complete'),
			...(versionOf({ json: first.cart }) ? { 'If-Match': versionOf({ json: first.cart }) } : {})
		}
	);
	const orderId = completed.json?.orderId;

	record('REST: cart A is completed', Boolean(orderId), `HTTP ${completed.status} ${brief(completed)}`);

	if (!orderId) return finish(RUN);

	const afterFirst = await usageOf(session, promotion.id);
	const registered = afterFirst.rows.filter((row) => row.orderId === orderId && row.status === 'REGISTERED');

	record(
		'REST: the order holds one registered redemption of the promotion (none was written before Q7-W1c)',
		registered.length === 1,
		JSON.stringify(afterFirst.rows.map((row) => ({ status: row.status, orderId: row.orderId })))
	);
	record('GraphQL: the promotion counts one use', afterFirst.counter === 1, `usageCount ${afterFirst.counter}`);

	// --- 2. the limit holds for the second order -----------------------------------------------------
	const second = await cartWithCode(session, catalogue, code, 'cart B');

	if (second?.cart?.id) {
		const done = await gql(
			`mutation ($input: CompleteCheckoutInput!) { completeCheckout(input: $input) { orderId } }`,
			{ input: { cartId: second.cart.id, version: second.cart.version, idempotencyKey: key('b-complete') } }
		);
		const secondOrderId = done.json?.data?.completeCheckout?.orderId;
		const afterSecond = await usageOf(session, promotion.id);
		const live = afterSecond.rows.filter((row) => row.status !== 'REVERTED');

		record(
			'GraphQL: a second order cannot redeem a promotion limited to one',
			!second.applied ||
				!secondOrderId ||
				JSON.stringify(done.json?.errors ?? []).includes('PROMOTION_USAGE_LIMIT_REACHED'),
			`granted ${second.applied}, order ${secondOrderId ?? 'none'} ${brief(done)}`
		);
		record('no second live redemption was written', live.length === 1, `${live.length} live redemption(s)`);
	}

	// --- 3. cancelling gives the use back ------------------------------------------------------------
	const current = await api('GET', `/api/orders/${orderId}`);
	const cancelled = await api(
		'POST',
		`/api/orders/${orderId}/cancel`,
		{ reason: 'e2e Q7-W1c' },
		{
			'If-Match': versionOf(current) ?? ''
		}
	);

	record(
		'REST: order A is cancelled',
		ok(cancelled) && cancelled.json?.status === 'CANCELED',
		`HTTP ${cancelled.status} ${brief(cancelled)}`
	);

	const afterCancel = await usageOf(session, promotion.id);

	record(
		"REST: the cancelled order's redemption is reverted",
		afterCancel.rows.some((row) => row.orderId === orderId && row.status === 'REVERTED'),
		JSON.stringify(afterCancel.rows.map((row) => ({ status: row.status, orderId: row.orderId })))
	);
	record('GraphQL: the promotion has its use back', afterCancel.counter === 0, `usageCount ${afterCancel.counter}`);

	// --- 4. two checkouts racing for the last use (CodeRabbit on #10897) ------------------------------
	// Both carts are granted the code while it still has its one use; both are completed at the same time.
	// The engine's counter is a conditional write, so exactly one checkout takes the use and the other is
	// refused before any order of its own is written.
	const raceCode = `${PREFIX}-RACE-${Date.now()}`;
	const racePromotion = await ensurePromotion(api, organizationId, { code: raceCode, value: '5', usageLimit: 1 });
	const x = racePromotion?.id ? await cartWithCode(session, catalogue, raceCode, 'race cart X') : undefined;
	const y = racePromotion?.id ? await cartWithCode(session, catalogue, raceCode, 'race cart Y') : undefined;

	if (x?.applied && y?.applied) {
		const complete = (cart, scope) =>
			api(
				'POST',
				`/api/carts/${cart.id}/complete`,
				{ idempotencyKey: key(scope) },
				{
					'Idempotency-Key': key(scope),
					...(versionOf({ json: cart }) ? { 'If-Match': versionOf({ json: cart }) } : {})
				}
			);
		const [first, second] = await Promise.all([complete(x.cart, 'race-x'), complete(y.cart, 'race-y')]);
		const placed = [first, second].filter((answer) => Boolean(answer.json?.orderId));
		const refused = [first, second].filter((answer) => !answer.json?.orderId);
		const live = (await usageOf(session, racePromotion.id)).rows.filter((row) => row.status !== 'REVERTED');

		record(
			'a concurrent pair redeems a one-use promotion once',
			placed.length === 1 && refused.length === 1,
			`HTTP ${first.status} / ${second.status}`
		);
		record(
			'the losing checkout is refused PROMOTION_USAGE_LIMIT_REACHED',
			refused.length === 1 && JSON.stringify(refused[0].json ?? {}).includes('PROMOTION_USAGE_LIMIT_REACHED'),
			brief(refused[0] ?? { json: {}, text: '' })
		);
		record('the promotion holds exactly one live redemption', live.length === 1, `${live.length} live`);
	} else {
		record('both race carts are granted the one-use promotion', false, `X ${x?.applied}, Y ${y?.applied}`);
	}

	finish(RUN);
}

main().catch((error) => {
	record('the run completed without an unexpected error', false, error?.stack ?? String(error));
	finish(RUN);
});
