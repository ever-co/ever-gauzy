/**
 * Two module boundaries are doubled here, for the same reason and in the same way.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a totals writer needs and none of which is available
 * outside a running application. `@gauzy/plugin-cart`'s barrel is worse: it re-exports the cart
 * plugin class, which imports the catalogue plugin, which imports the rest of the marketplace, so
 * reading one totals function would load every package on the platform.
 *
 * Both seams are therefore doubled at the module boundary, exactly as the docs package's service
 * specs do, and the *things under test are the real ones*: the order totals service, and the
 * `TotalsCalculator` it delegates the chain to.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Idempotent: decorator,
		Versioned: decorator,
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		CrudService: class {
			constructor(protected readonly typeOrmRepository: any) {}

			async update(id: any, partial: any): Promise<any> {
				return this.typeOrmRepository.update(id, partial);
			}
		},
		TenantAwareCrudService: class {
			constructor(
				protected readonly typeOrmRepository: any,
				protected readonly mikroOrmRepository?: any
			) {}
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {},
	// Added when core grew this export: the double has to carry it, or the code under
	// test calls nothing and the suite fails for a reason that is not its own.
	};
});

import {
	AdjustmentOwnerType,
	FulfillmentStatus,
	OrderPaymentStatus,
	OrderStatus,
	OrderTransactionType,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { OrderTotalsService } from './order-totals.service';

/**
 * The only writer of an order's total columns.
 *
 * The chain itself belongs to `TotalsCalculator`, which has its own suite; what this service adds is
 * everything an order has and a cart does not — the credit lines, the money ledger, the two
 * materialised statuses, the version bump and the summary row that makes each version's totals
 * answerable afterwards. That is what this suite tests:
 *
 * - the totals it writes are the ones the documented chain produces, in the documented order, and
 *   the summary row for the committed version equals the denormalised columns exactly (doc 07 §6.3,
 *   §6.4 — `I1`…`I9`);
 * - the optimistic-concurrency guard refuses a stale write **and writes nothing**;
 * - every committed version has exactly one summary row, with the reason it was recomputed for;
 * - `paymentStatus` and `fulfillmentStatus` are derived from the order's own rows and materialised in
 *   the same write as the totals, so a reader never sees a status that disagrees with the ledger;
 * - a ledger row that has not crossed its own rounding boundary stops the write rather than being
 *   rounded into a total that would then disagree with the lines it came from.
 *
 * Two cases are **controls**: they assert the naive answer as well as the required one, so the suite
 * cannot pass by asserting whatever the implementation happens to do.
 */

/** One line of an order, as the totals chain reads it. */
const line = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	orderId: 'order-1',
	title: `Line ${id}`,
	quantity: 1,
	unitPrice: 0,
	isTaxInclusive: false,
	requiresShipping: true,
	fulfilledQuantity: 0,
	shippedQuantity: 0,
	deliveredQuantity: 0,
	returnRequestedQuantity: 0,
	returnReceivedQuantity: 0,
	returnDismissedQuantity: 0,
	writtenOffQuantity: 0,
	...overrides
});

/**
 * Builds the totals service over one in-memory order and the four ledgers it reads.
 *
 * Each collaborator implements the single call the service makes on it — `findAll({ where })` for the
 * collections, `findByOwner(ownerType, ownerId)` for the core money ledgers, `create` for the summary
 * and `findOne`/`update` for the order row.
 */
function orderFixture(order: Record<string, unknown> = {}) {
	const row: any = {
		id: 'order-1',
		channelId: 'channel-1',
		currency: 'USD',
		currencyDecimals: 2,
		status: OrderStatus.CONFIRMED,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		version: 1,
		...order
	};
	const lines: any[] = [];
	const shippingMethods: any[] = [];
	const creditLines: any[] = [];
	const transactions: any[] = [];
	const adjustments: any[] = [];
	const taxLines: any[] = [];
	const summaries: any[] = [];

	const collection = (rows: any[]) => ({
		findAll: async ({ where }: any = {}) => ({
			items: rows.filter((candidate) => String(candidate.orderId) === String(where?.orderId)),
			total: rows.length
		})
	});
	const ownedLedger = (rows: any[]) => ({
		findByOwner: async (ownerType: string, ownerId: string) =>
			rows.filter((candidate) => candidate.ownerType === ownerType && candidate.ownerId === ownerId)
	});
	const typeOrmOrderRepository = {
		findOne: async ({ where }: any = {}) => (String(where?.id) === String(row.id) ? { ...row } : null),
		update: async (criteria: any, partial: any) => {
			const expected = typeof criteria === 'string' ? { id: criteria } : criteria ?? {};
			const matches = Object.entries(expected).every(
				([field, value]) => value === undefined || String(row[field] ?? '') === String(value)
			);

			if (matches) {
				Object.assign(row, partial);
			}

			return { affected: matches ? 1 : 0 };
		},
		/** Persists a partial update only when the whole write succeeds, the way a transaction would. */
		create: async (partial: any) => {
			Object.assign(row, partial);

			return { ...row };
		}
	};
	// The version-predicated write resolves the order's writer by token, so the fixture offers it the
	// same two calls the real order service offers the totals service.
	const orderWriter = {
		update: async (criteria: any, partial: any) => typeOrmOrderRepository.update(criteria, partial),
		findOneByIdString: async (id: any) => (String(id) === String(row.id) ? { ...row } : null)
	};
	const service = new OrderTotalsService(
		typeOrmOrderRepository as never,
		collection(lines) as never,
		collection(shippingMethods) as never,
		collection(creditLines) as never,
		collection(transactions) as never,
		{ create: async (summary: any) => (summaries.push(summary), summary) } as never,
		ownedLedger(adjustments) as never,
		ownedLedger(taxLines) as never,
		{ get: () => orderWriter } as never
	);

	return { service, order: row, lines, shippingMethods, creditLines, transactions, adjustments, taxLines, summaries };
}

/** `order_summary.totals` fields that are also denormalised columns on `order`. */
const TOTAL_COLUMNS = [
	'itemSubtotal',
	'itemDiscountTotal',
	'itemTaxTotal',
	'shippingSubtotal',
	'shippingDiscountTotal',
	'shippingTaxTotal',
	'discountTotal',
	'taxTotal',
	'grandTotal',
	'creditTotal',
	'paidTotal',
	'refundedTotal',
	'outstandingTotal'
];

describe('OrderTotalsService — the totals chain (doc 07 §6.1, §6.2)', () => {
	it('writes every total column of a document with lines, adjustments, tax and shipping', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99 }));
		fixture.lines.push(line('L2', { quantity: 1, unitPrice: 5 }));
		fixture.shippingMethods.push({ id: 'S1', orderId: 'order-1', amount: 5, isTaxInclusive: false });
		fixture.adjustments.push({ ownerType: AdjustmentOwnerType.ORDER_LINE, ownerId: 'L1', amount: -4 });
		fixture.adjustments.push({ ownerType: AdjustmentOwnerType.ORDER_SHIPPING, ownerId: 'S1', amount: -1 });
		fixture.taxLines.push({ ownerType: TaxLineOwnerType.ORDER_LINE, ownerId: 'L1', amount: 2.9 });
		fixture.taxLines.push({ ownerType: TaxLineOwnerType.ORDER_LINE, ownerId: 'L2', amount: 0.36 });
		fixture.taxLines.push({ ownerType: TaxLineOwnerType.ORDER_SHIPPING, ownerId: 'S1', amount: 0.36 });

		const written = await fixture.service.recompute('order-1', 'PLACED');

		expect(written).toMatchObject({
			itemSubtotal: 44.98,
			itemDiscountTotal: 4,
			itemTaxTotal: 3.26,
			shippingSubtotal: 5,
			shippingDiscountTotal: 1,
			shippingTaxTotal: 0.36,
			discountTotal: 5,
			taxTotal: 3.26,
			grandTotal: 48.6
		});
		// `I1`: the grand total is the exact sum of its components, and it is not a second rounding of
		// them. Control: the same sum performed on the same stored values in binary floating point does
		// not even reproduce the stored total — `48.599999999999994` against `48.6` — which is why the
		// columns are summed as exact decimals and never as `number`s.
		expect(written.grandTotal).toBe(48.6);

		const naiveChain =
			written.itemSubtotal -
			written.discountTotal +
			written.taxTotal +
			written.shippingSubtotal +
			written.shippingTaxTotal;

		expect(naiveChain).not.toBe(48.6);
		// `I2` and `I3`.
		expect(written.discountTotal).toBe(written.itemDiscountTotal + written.shippingDiscountTotal);
		expect(written.taxTotal).toBe(written.itemTaxTotal);
	});

	it('derives the order-only tail from the credit lines and the money ledger', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		fixture.creditLines.push({ orderId: 'order-1', amount: 5 });
		fixture.transactions.push({ orderId: 'order-1', amount: 100, type: OrderTransactionType.AUTHORIZATION });
		fixture.transactions.push({ orderId: 'order-1', amount: 40, type: OrderTransactionType.CAPTURE });
		fixture.transactions.push({ orderId: 'order-1', amount: -10, type: OrderTransactionType.REFUND });

		const written = await fixture.service.recompute('order-1', 'PAYMENT_RECONCILED');

		// An authorisation is not money received, so it never reaches `paidTotal`.
		expect(written.paidTotal).toBe(40);
		expect(written.creditTotal).toBe(5);
		expect(written.refundedTotal).toBe(10);
		expect(written.outstandingTotal).toBe(100 - 5 - 40 + 10);
	});

	it('normalises a tax-inclusive line by subtracting its tax, not by dividing by the rate', async () => {
		// Doc 07 §3.4 E2: a gross of `0.15` inclusive of 20 % has a net of `0.13` and a tax of `0.02`
		// under the mandated residual method; re-deriving the tax from the rate gives `0.03` and a net
		// of `0.12`. Both preserve the gross, and they disagree on the split — so the split is what has
		// to be asserted.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 0.15, isTaxInclusive: true }));
		fixture.taxLines.push({ ownerType: TaxLineOwnerType.ORDER_LINE, ownerId: 'L1', amount: 0.02 });

		const written = await fixture.service.recompute('order-1', 'PLACED');

		expect(written.itemSubtotal).toBe(0.13);
		expect(written.taxTotal).toBe(0.02);
		expect(written.grandTotal).toBe(0.15);

		// Controls: the gross taken as the net, and the rate-applied split.
		expect(written.itemSubtotal).not.toBe(0.15);
		expect(written.itemSubtotal).not.toBe(0.12);
	});

	it('writes a total that a binary floating point accumulation could not produce', async () => {
		// Control: `0.1 + 0.2` is `0.30000000000000004` as doubles. A total accumulated in floating
		// point is a wrong minor unit the moment it is rounded, taxed or split.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 0.1 }));
		fixture.lines.push(line('L2', { quantity: 1, unitPrice: 0.2 }));

		const written = await fixture.service.recompute('order-1', 'PLACED');

		expect(written.itemSubtotal).toBe(0.3);
		expect(written.grandTotal).toBe(0.3);
		expect(0.1 + 0.2).not.toBe(0.3);

		// And ten lines of `0.07`, which is where a float accumulation drifts by a whole minor unit.
		const many = orderFixture();

		for (let index = 0; index < 10; index++) {
			many.lines.push(line(`L${index}`, { quantity: 1, unitPrice: 0.07 }));
		}

		const summed = await many.service.recompute('order-1', 'PLACED');

		expect(summed.itemSubtotal).toBe(0.7);
		expect(Array.from({ length: 10 }).reduce<number>((total) => total + 0.07, 0)).not.toBe(0.7);
	});
});

describe('OrderTotalsService — version, summary rows and concurrency (doc 07 §6.3, doc 10 §4.4)', () => {
	it('commits one version and one summary row per recompute, the row matching the columns', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99 }));

		await fixture.service.recompute('order-1', 'PLACED');
		await fixture.service.recompute('order-1', 'CHANGE_CONFIRMED');
		const written = await fixture.service.recompute('order-1', 'FULFILLMENT_COMMITTED');

		expect(written.version).toBe(4);
		expect(fixture.summaries.map((summary) => summary.version)).toEqual([2, 3, 4]);
		expect(fixture.summaries.map((summary) => summary.reason)).toEqual([
			'PLACED',
			'CHANGE_CONFIRMED',
			'FULFILLMENT_COMMITTED'
		]);

		// `checkout.order-summary-version-matches-order-columns`: the newest summary row describes
		// exactly what the denormalised columns say, so "what did this total at version 3, and why?"
		// is answerable from the row rather than by replaying the chain.
		const newest = fixture.summaries[fixture.summaries.length - 1];

		expect(newest.orderId).toBe('order-1');
		expect(newest.currency).toBe('USD');
		expect(newest.version).toBe(written.version);

		for (const column of TOTAL_COLUMNS) {
			expect({ column, value: newest.totals[column] }).toEqual({ column, value: written[column] });
		}
	});

	it('refuses a write against a stale version and leaves the order untouched', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		const before = await fixture.service.recompute('order-1', 'PLACED');

		// Another writer committed version 2 while this caller still held version 1. The refusal is the
		// kernel's — the conditional update matched no row — so the caller is told the version moved on
		// rather than that the order is missing. The code travels on the exception; the HTTP envelope
		// the filter renders is the kernel's own.
		await expect(
			fixture.service.recompute('order-1', 'MANUAL', { expectation: { wildcard: false, versions: [1] } })
		).rejects.toMatchObject({ code: 'ENTITY_VERSION_CONFLICT', status: 409 });

		// Nothing moved: no version, no summary row, no column. A refused write that had already
		// bumped something would be worse than an accepted one.
		expect(fixture.order.version).toBe(before.version);
		expect(fixture.summaries).toHaveLength(1);
		expect(fixture.order.grandTotal).toBe(before.grandTotal);

		// The version the caller actually holds is accepted.
		const written = await fixture.service.recompute('order-1', 'MANUAL', {
			expectation: { wildcard: false, versions: [before.version] }
		});
		expect(written.version).toBe(before.version + 1);
	});

	it('refuses to recompute an order that does not exist', async () => {
		const fixture = orderFixture();

		await expect(fixture.service.recompute('order-absent', 'MANUAL')).rejects.toThrow(/ORDER_NOT_FOUND/);
	});

	it('stops the write when a ledger row has not crossed its own rounding boundary', async () => {
		// The chain refuses a component it cannot settle rather than rounding it, because rounding it
		// here would produce a stored total that disagrees with the rows it was computed from — and
		// the nightly audit would have to find it.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 20 }));
		fixture.adjustments.push({ ownerType: AdjustmentOwnerType.ORDER_LINE, ownerId: 'L1', amount: -0.005 });

		await expect(fixture.service.recompute('order-1', 'PLACED')).rejects.toThrow(/TOTALS_NOT_SETTLED/);
		expect(fixture.summaries).toHaveLength(0);
		expect(fixture.order.version).toBe(1);
		expect(fixture.order.grandTotal).toBeUndefined();
	});
});

describe('OrderTotalsService — the materialised statuses (doc 10 §5.4, §5.5, §5.6)', () => {
	it('materialises the money state from the ledger, in the documented order', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		fixture.transactions.push({ orderId: 'order-1', amount: 60, type: OrderTransactionType.CAPTURE });
		fixture.transactions.push({ orderId: 'order-1', amount: -10, type: OrderTransactionType.REFUND });

		const written = await fixture.service.recompute('order-1', 'PAYMENT_RECONCILED');

		// `PARTIALLY_REFUNDED` rather than `PARTIALLY_CAPTURED`: the refund rule precedes the capture
		// rule, and a deriver that tested the capture first would hide the refund from the order list.
		expect(written.paymentStatus).toBe(OrderPaymentStatus.PARTIALLY_REFUNDED);
		expect(written.outstandingTotal).toBe(50);

		const settled = await fixture.service.derivePaymentStatus(fixture.order as never, {
			...written,
			grandTotal: written.grandTotal
		} as never);

		expect(settled).toBe(written.paymentStatus);
	});

	it('reports a cancelled order that was never captured as cancelled', async () => {
		const fixture = orderFixture({ status: OrderStatus.CANCELED });

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		fixture.transactions.push({ orderId: 'order-1', amount: 100, type: OrderTransactionType.AUTHORIZATION });

		const written = await fixture.service.recompute('order-1', 'CANCEL');

		expect(written.paymentStatus).toBe(OrderPaymentStatus.CANCELED);
	});

	it('materialises the fulfilment state from every line counter', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 5, fulfilledQuantity: 5 }));
		fixture.lines.push(line('L2', { quantity: 5, fulfilledQuantity: 3, writtenOffQuantity: 2 }));

		const fulfilled = await fixture.service.recompute('order-1', 'FULFILLMENT_COMMITTED');

		// `netTarget = 10 - 2 = 8` and `fulfilled = 8`.
		expect(fulfilled.fulfillmentStatus).toBe(FulfillmentStatus.FULFILLED);

		// The same order with the unshipped unit returned instead of written off.
		fixture.lines[1].returnReceivedQuantity = 8;
		const returned = await fixture.service.recompute('order-1', 'FULFILLMENT_COMMITTED');

		expect(returned.fulfillmentStatus).toBe(FulfillmentStatus.RETURNED);
	});

	it('reports a cancelled order as cancelled however far it had got', async () => {
		const fixture = orderFixture({ status: OrderStatus.CANCELED });

		fixture.lines.push(line('L1', { quantity: 5, fulfilledQuantity: 3 }));

		const written = await fixture.service.recompute('order-1', 'CANCEL');

		expect(written.fulfillmentStatus).toBe(FulfillmentStatus.CANCELED);
	});

	it('counts the distinct sellers among the lines, and never the blanks', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 1, sellerId: 'seller-1' }));
		fixture.lines.push(line('L2', { quantity: 1, unitPrice: 1, sellerId: 'seller-1' }));
		fixture.lines.push(line('L3', { quantity: 1, unitPrice: 1, sellerId: 'seller-2' }));
		fixture.lines.push(line('L4', { quantity: 1, unitPrice: 1 }));

		const written = await fixture.service.recompute('order-1', 'PLACED');

		expect(written.sellerCount).toBe(2);
	});
});

describe('OrderTotalsService — the conditions the lifecycle asks it for', () => {
	it('reports whether a shippable line still has to go out', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 5, fulfilledQuantity: 3 }));
		fixture.lines.push(line('L2', { quantity: 2, fulfilledQuantity: 2, requiresShipping: false }));

		expect(await fixture.service.hasOpenShippableLines(fixture.order as never)).toBe(true);

		// A line whose remainder was written off is no longer owed.
		fixture.lines[0].writtenOffQuantity = 2;
		expect(await fixture.service.hasOpenShippableLines(fixture.order as never)).toBe(false);
	});

	it('reports the money side as settled only when nothing is outstanding', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		expect(await fixture.service.isPaymentSettled(fixture.order as never)).toBe(false);

		fixture.transactions.push({ orderId: 'order-1', amount: 100, type: OrderTransactionType.CAPTURE });
		expect(await fixture.service.isPaymentSettled(fixture.order as never)).toBe(true);

		// An authorisation alone settles nothing: it is not money received.
		const authorised = orderFixture();

		authorised.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));
		authorised.transactions.push({ orderId: 'order-1', amount: 100, type: OrderTransactionType.AUTHORIZATION });
		expect(await authorised.service.isPaymentSettled(authorised.order as never)).toBe(false);
	});

	it('allows completion only from the two statuses the specification names', () => {
		const fixture = orderFixture();
		const completable = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
		const notCompletable = [
			OrderStatus.DRAFT,
			OrderStatus.PENDING,
			OrderStatus.REQUIRES_ACTION,
			OrderStatus.COMPLETED,
			OrderStatus.CANCELED,
			OrderStatus.ARCHIVED
		];

		for (const status of completable) {
			expect({ status, canComplete: fixture.service.canComplete({ status } as never) }).toEqual({
				status,
				canComplete: true
			});
		}

		for (const status of notCompletable) {
			expect({ status, canComplete: fixture.service.canComplete({ status } as never) }).toEqual({
				status,
				canComplete: false
			});
		}
	});
});
