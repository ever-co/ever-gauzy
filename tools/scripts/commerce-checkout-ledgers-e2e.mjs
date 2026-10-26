#!/usr/bin/env node
/**
 * Q7-W1a end-to-end run: does the order keep the discount and the tax the cart was priced at?
 *
 * **The defect this run watches.** `OrderService.createFromCart` copied a cart's lines, shipping methods
 * and addresses and none of its `adjustment` / `tax_line` rows, so every order placed through checkout
 * was re-totalled from empty ledgers: its discount and tax were zero and its grand total was not the
 * amount the buyer was shown. Unit suites could not see it — their fixtures write the order's own rows —
 * and no committed run completed a cart and read the order back.
 *
 * So this run prices a cart (a line and a discount), completes it twice — once over REST
 * (`POST /api/carts/:id/complete`) and once over GraphQL (`completeCheckout`) — and reads each order back
 * over the other surface, asserting that the order's `discountTotal`, `taxTotal` and `grandTotal` are the
 * cart's at the moment it was completed.
 *
 * The discount is a real promotion (seeded: 5 off the order, by code) that the cart asks the engine for —
 * since R3-07 the cart records only what the engine grants — applied with `POST /api/carts/:id/promotions` /
 * `applyCartPromotion`, and a refused discount **fails** the run: an undiscounted cart cannot show a
 * dropped discount. Tax is compared, not required: the platform's tax rows
 * need a region, a regime and a rate (the tax package's own fixtures), and the carry-over of tax lines is
 * pinned row by row in `order-cart-ledger-carryover.service.spec.ts` and `order.service.spec.ts`.
 *
 * Run by hand against a booted API:
 *
 *   DB_TYPE=better-sqlite3 DB_ORM=typeorm node dist/apps/api/main.js
 *   node tools/scripts/commerce-checkout-ledgers-e2e.mjs
 */
import {
	brief,
	enableCapabilities,
	ensureCatalogue,
	ensurePromotion,
	finish,
	ok,
	record,
	sameMoney,
	signIn,
	versionOf
} from './commerce-wiring-harness.mjs';

const RUN = 'commerce checkout ledgers end-to-end run';
const PREFIX = 'E2E-Q7-W1A';

const ORDER_FIELDS =
	'id status cartId itemDiscountTotal discountTotal itemTaxTotal taxTotal shippingTaxTotal grandTotal';

/**
 * Builds and prices a cart over REST: one line, then a discount.
 *
 * @returns {Promise<undefined | {cart: any, version: string | undefined, discounted: boolean}>}
 */
async function pricedCartOverRest(session, catalogue) {
	const { api, owned } = session;
	const created = await api(
		'POST',
		'/api/carts',
		owned({
			channelId: catalogue.channel.id,
			currency: 'USD',
			currencyDecimals: 2,
			email: 'e2e-q7-w1a@example.com'
		})
	);

	record(
		'a cart is opened over REST',
		ok(created) && Boolean(created.json?.id),
		`HTTP ${created.status} ${created.json?.id ?? brief(created)}`
	);

	if (!created.json?.id) return undefined;

	const cartId = created.json.id;
	let version = versionOf(created);

	const line = await api(
		'POST',
		`/api/carts/${cartId}/lines`,
		owned({
			cartId,
			productId: catalogue.product.id,
			variantId: catalogue.variant.id,
			title: 'E2E Q7-W1a unit',
			quantity: 2,
			unitPrice: '20.00',
			originalUnitPrice: '20.00',
			isTaxInclusive: false,
			isDiscountable: true,
			requiresShipping: false
		}),
		version ? { 'If-Match': version } : undefined
	);

	record('a line is added to it', ok(line), `HTTP ${line.status}${ok(line) ? '' : ` ${brief(line)}`}`);

	if (!ok(line)) return undefined;

	version = versionOf(line) ?? version;

	const promotion = await api(
		'POST',
		`/api/carts/${cartId}/promotions`,
		owned({ cartId, code: `${PREFIX}-OFF` }),
		version ? { 'If-Match': version } : undefined
	);

	const discounted = ok(promotion);

	record(
		'the cart is discounted (a refusal fails the run: without a discount the carry-over goes unobserved)',
		discounted,
		`HTTP ${promotion.status}${discounted ? '' : ` ${brief(promotion)}`}`
	);

	version = (discounted ? versionOf(promotion) : undefined) ?? version;

	const cart = (await api('GET', `/api/carts/${cartId}`)).json;

	return { cart, version: versionOf({ json: cart }) ?? version, discounted };
}

/**
 * Asserts that an order carries its cart's money.
 *
 * @param {string} surface Which surface read the order.
 * @param {any} cart The cart as it stood when it was completed.
 * @param {any} order The order as the other surface reads it.
 * @param {boolean} discounted Whether the cart carried a discount.
 */
function assertCarried(surface, cart, order, discounted) {
	record(`${surface}: the order was read back`, Boolean(order?.id), order?.id ? `order ${order.id}` : 'no order');

	if (!order?.id) return;

	if (discounted) {
		record(
			`${surface}: the cart's discount is on the order (was dropped before Q7-W1a)`,
			Number(order.discountTotal) > 0 && sameMoney(order.discountTotal, cart.discountTotal),
			`cart ${cart.discountTotal}, order ${order.discountTotal}`
		);
	}

	record(
		`${surface}: the order's tax is the cart's`,
		sameMoney(order.taxTotal, cart.taxTotal) && sameMoney(order.shippingTaxTotal, cart.shippingTaxTotal),
		`cart ${cart.taxTotal}/${cart.shippingTaxTotal}, order ${order.taxTotal}/${order.shippingTaxTotal}`
	);
	record(
		`${surface}: the order's grand total is the amount the buyer was shown`,
		sameMoney(order.grandTotal, cart.grandTotal),
		`cart ${cart.grandTotal}, order ${order.grandTotal}`
	);
}

async function main() {
	console.log('');
	console.log(RUN);
	console.log('='.repeat(RUN.length));

	const session = await signIn('q7-w1a');

	if (!session) return finish(RUN);

	const { api, gql, key, organizationId } = session;

	await enableCapabilities(api, organizationId, [
		'FEATURE_CART',
		'FEATURE_ORDER',
		'FEATURE_PROMOTION',
		'FEATURE_GRAPHQL'
	]);

	const catalogue = await ensureCatalogue(api, organizationId, PREFIX);
	const promotion = await ensurePromotion(api, organizationId, { code: `${PREFIX}-OFF`, value: '5' });

	if (!catalogue || !promotion) return finish(RUN);

	// --- 1. REST completes, GraphQL reads ------------------------------------------------------------
	const rest = await pricedCartOverRest(session, catalogue);

	if (rest) {
		const completed = await api(
			'POST',
			`/api/carts/${rest.cart.id}/complete`,
			{ idempotencyKey: key('rest-complete') },
			{ 'Idempotency-Key': key('rest-complete'), ...(rest.version ? { 'If-Match': rest.version } : {}) }
		);

		record(
			'the cart is completed over REST',
			ok(completed) && Boolean(completed.json?.orderId),
			`HTTP ${completed.status} ${brief(completed)}`
		);

		if (completed.json?.orderId) {
			const read = await gql(`query ($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, {
				id: completed.json.orderId
			});

			assertCarried('REST → GraphQL', rest.cart, read.json?.data?.order, rest.discounted);
		}
	}

	// --- 2. GraphQL completes, REST reads ------------------------------------------------------------
	const opened = await gql(`mutation ($input: CreateCartInput!) { createCart(input: $input) { id version } }`, {
		input: { channelId: catalogue.channel.id, currency: 'USD', email: 'e2e-q7-w1a-gql@example.com' }
	});
	const gqlCart = opened.json?.data?.createCart;

	record('a cart is opened over GraphQL', Boolean(gqlCart?.id), gqlCart?.id ?? brief(opened));

	if (gqlCart?.id) {
		const added = await gql(`mutation ($input: AddCartLineInput!) { addCartLine(input: $input) { id version } }`, {
			input: {
				cartId: gqlCart.id,
				productId: catalogue.product.id,
				variantId: catalogue.variant.id,
				title: 'E2E Q7-W1a unit (GraphQL)',
				quantity: '3',
				unitPrice: '10.00',
				isDiscountable: true,
				requiresShipping: false,
				version: gqlCart.version
			}
		});
		let version = added.json?.data?.addCartLine?.version;

		record('a line is added over GraphQL', Boolean(added.json?.data?.addCartLine?.id), brief(added));

		const applied = await gql(
			`mutation ($input: ApplyCartPromotionInput!) { applyCartPromotion(input: $input) { id version discountTotal } }`,
			// `amount` is required by the input type and ignored since R3-07: the engine states the discount.
			{ input: { cartId: gqlCart.id, code: `${PREFIX}-OFF`, amount: '0', version } }
		);
		const discounted = Boolean(applied.json?.data?.applyCartPromotion?.id);

		record('the GraphQL cart is discounted (a refusal fails the run, as over REST)', discounted, brief(applied));

		version = applied.json?.data?.applyCartPromotion?.version ?? version;

		const before = (await api('GET', `/api/carts/${gqlCart.id}`)).json;
		const done = await gql(
			`mutation ($input: CompleteCheckoutInput!) { completeCheckout(input: $input) { orderId orderNumber } }`,
			{ input: { cartId: gqlCart.id, version: before?.version ?? version, idempotencyKey: key('gql-complete') } }
		);
		const orderId = done.json?.data?.completeCheckout?.orderId;

		record('the cart is completed over GraphQL', Boolean(orderId), brief(done));

		if (orderId) {
			const read = await api('GET', `/api/orders/${orderId}`);

			assertCarried('GraphQL → REST', before, read.json, discounted);
		}
	}

	finish(RUN);
}

main().catch((error) => {
	record('the run completed without an unexpected error', false, error?.stack ?? String(error));
	finish(RUN);
});
