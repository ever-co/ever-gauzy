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

/**
 * The scheduler is doubled at the module boundary, and the double **records what it was applied to**.
 *
 * A scheduled entry is `@ScheduledJob(...)` on a method, and the two facts a suite has to be able to
 * assert about it are exactly those: which method the decorator landed on, and the schedule it was
 * applied with. A no-op double would assert neither — the schedule would be a fact nothing in this
 * repository reads — and loading the real module would pull the platform's queue stack into a suite
 * about one cron entry, so the double keeps a ledger instead and the test reads it back through
 * `jest.requireMock`, which is the one way to reach a factory's own scope from a test body.
 */
jest.mock('@gauzy/scheduler', () => {
	const scheduled: Array<{ key: string; options: Record<string, any> }> = [];
	const decorator = (options: Record<string, any>) => (_target: unknown, key: string, descriptor: unknown) => {
		scheduled.push({ key, options });

		return descriptor;
	};

	return { __scheduled: scheduled, ScheduledJob: decorator };
});

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
		// Added when core grew this export: the double has to carry it, or the code under test calls
		// nothing and the suite fails for a reason that is not its own.
		EventOutboxService: class {},
		// The exact decimal primitives are pulled through the seam rather than restated: the sums this
		// service feeds the state machine are the subject of several cases below, and arithmetic
		// re-implemented here would make them assert the double.
		addDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').addDecimalStrings,
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		subtractDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').subtractDecimalStrings
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
import { CronExpression } from '@nestjs/schedule';
import { FindOperator } from 'typeorm';
import { ORDER_TOTALS_AUDIT_BATCH_SIZE, OrderTotalsService } from './order-totals.service';
import {
	ORDER_TOTALS_RECONCILIATION_SCHEDULE,
	OrderTotalsReconciliationScheduler
} from './order-totals-reconciliation.scheduler';

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
 * Whether a stored value satisfies one criterion of a `where`, operators included.
 *
 * The reconciliation states its window, its keyset and its slices as TypeORM operators
 * (`MoreThanOrEqual`, `MoreThan`, `In`), so a double that compared them as plain values would match
 * nothing — or, worse, everything — and the bounds the cases below assert would be the double's.
 *
 * @param value The column as the row holds it.
 * @param expected The criterion, a value or an operator.
 */
function satisfies(value: any, expected: any): boolean {
	if (expected instanceof FindOperator) {
		const operand: any = expected.value;

		switch (expected.type) {
			case 'in':
				return (operand as unknown[]).some((member) => String(member) === String(value));
			case 'moreThan':
				return value !== undefined && value !== null && value > operand;
			case 'moreThanOrEqual':
				return value !== undefined && value !== null && value >= operand;
			case 'lessThanOrEqual':
				return value !== undefined && value !== null && value <= operand;
			case 'isNull':
				return value === undefined || value === null;
			default:
				throw new Error(`The double does not evaluate the ${expected.type} operator.`);
		}
	}

	return expected === undefined || String(value ?? '') === String(expected);
}

/**
 * Answers a find-options read over in-memory rows: the `where` (an array is its arms, OR-ed), the
 * `order`, the `take` and the `select`.
 *
 * **The projection is the ORM's, because that is where one of the defects lived.** Under MikroORM the
 * `orderId` of a line or a transaction is the relation's id (`relationId: true`), which the kernel maps
 * `persist: false` — and MikroORM drops such a property from a projection, answering the row with the
 * primary key alone; the `order` relation, projected instead, comes back as the id it references. A
 * double that answered `orderId` under both ORMs would let a MikroORM window read that names no order
 * pass here, which is the failure the reconciliation shipped with.
 *
 * @param rows The table.
 * @param options The read.
 * @param orm The ORM whose projection the read answers with.
 */
function query(rows: any[], options: any = {}, orm: 'typeorm' | 'mikro-orm' = 'typeorm'): any[] {
	const arms: any[] = Array.isArray(options.where) ? options.where : [options.where ?? {}];
	let found = rows.filter((row) =>
		arms.some((arm) => Object.entries(arm).every(([column, expected]) => satisfies(row[column], expected)))
	);

	for (const [column, direction] of Object.entries(options.order ?? {}).reverse()) {
		const sign = String(direction).toUpperCase() === 'DESC' ? -1 : 1;

		found = [...found].sort((left, right) =>
			left[column] > right[column] ? sign : left[column] < right[column] ? -sign : 0
		);
	}

	if (options.take) {
		found = found.slice(0, options.take);
	}

	if (!options.select) {
		return found.map((row) => ({ ...row }));
	}

	return found.map((row) => {
		const projected: any = {};

		for (const [column, wanted] of Object.entries(options.select)) {
			if (!wanted || (orm === 'mikro-orm' && column === 'orderId')) {
				continue;
			}

			projected[column] = orm === 'mikro-orm' && column === 'order' ? row.orderId : row[column];
		}

		return projected;
	});
}

/**
 * Builds the totals service over in-memory orders and the four ledgers it reads.
 *
 * Each collaborator implements the calls the service makes on it — `findAll({ where })` for an order's
 * collections, `find(options)` for the reconciliation's window over them, `findByOwner(ownerType,
 * ownerId)` for the core money ledgers, `append` for the summary and `findOne`/`find`/`update` for the
 * order rows.
 *
 * @param order Columns the first order starts with.
 * @param options `orm` is the ORM the reads are answered as; `unitOfWork` is the persistence context
 * the module would inject, left out to construct the service the way a caller outside the module does.
 */
function orderFixture(
	order: Record<string, unknown> = {},
	options: { orm?: 'typeorm' | 'mikro-orm'; unitOfWork?: unknown } = {}
) {
	const orm = options.orm ?? 'typeorm';
	const row: any = {
		id: 'order-1',
		channelId: 'channel-1',
		currency: 'USD',
		currencyDecimals: 2,
		status: OrderStatus.CONFIRMED,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		version: 1,
		// The reconciliation's window query reads the order's own updated time, so the row carries one.
		updatedAt: new Date(),
		...order
	};
	/** Every order of the fixture; the first is the one most cases are about. */
	const orders: any[] = [row];
	const lines: any[] = [];
	const shippingMethods: any[] = [];
	const creditLines: any[] = [];
	const transactions: any[] = [];
	const adjustments: any[] = [];
	const taxLines: any[] = [];
	const summaries: any[] = [];

	const collection = (rows: any[]) => ({
		findAll: async ({ where }: any = {}) => {
			const items = query(rows, { where }, orm);

			return { items, total: items.length };
		},
		// The reconciliation's window over this ledger, a page at a time.
		find: jest.fn(async (read: any = {}) => query(rows, read, orm))
	});
	const ownedLedger = (rows: any[]) => ({
		findByOwner: async (ownerType: string, ownerId: string) =>
			rows.filter((candidate) => candidate.ownerType === ownerType && candidate.ownerId === ownerId)
	});
	/** Every `order.*` row the service appended, in the order it appended them. */
	const events: any[] = [];
	/**
	 * The platform outbox, reduced to the one call this service makes on it.
	 *
	 * The manager it is handed is the order repository's own, which is what the assertions below check:
	 * an event appended through some other connection is an event a crash can separate from the write
	 * it describes, which is the whole reason the outbox is a table rather than a bus.
	 */
	const outbox = {
		append: async (manager: any, input: any) => {
			events.push({ manager, ...input });

			return input;
		}
	};
	const update = async (criteria: any, partial: any) => {
		const expected = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
		const target = orders.find((candidate) =>
			Object.entries(expected).every(
				([field, value]) => value === undefined || String(candidate[field] ?? '') === String(value)
			)
		);

		if (target) {
			Object.assign(target, partial);
		}

		return { affected: target ? 1 : 0 };
	};
	const lineService = collection(lines);
	const transactionService = collection(transactions);
	const typeOrmOrderRepository = {
		// The entity manager the conditional update, the summary row and the event all go through.
		manager: { name: 'order-manager' },
		findOne: async ({ where }: any = {}) => query(orders, { where })[0] ?? null,
		// The window read and the slices the reconciliation performs. A test that drives the sweep can
		// replace this with the rows it wants examined, which is why the fixture hands it back below.
		find: jest.fn(async (read: any = {}) => query(orders, read)),
		update,
		/** Persists a partial update only when the whole write succeeds, the way a transaction would. */
		create: async (partial: any) => {
			Object.assign(row, partial);

			return { ...row };
		}
	};
	// The version-predicated write resolves the order's writer by token, so the fixture offers it the
	// calls the real order service offers the totals service — `find` being the read under MikroORM,
	// where the TypeORM entity for `order` carries its base columns and nothing else.
	const orderWriter = {
		update,
		findOneByIdString: async (id: any) => query(orders, { where: { id } })[0] ?? null,
		find: jest.fn(async (read: any = {}) => query(orders, read))
	};
	const service = new OrderTotalsService(
		typeOrmOrderRepository as never,
		lineService as never,
		collection(shippingMethods) as never,
		collection(creditLines) as never,
		transactionService as never,
		{
			// The summary of a version, recorded with the tenancy it was appended under.
			append: async (entry: any, scope: any = {}) => (summaries.push({ ...entry, ...scope }), entry)
		} as never,
		ownedLedger(adjustments) as never,
		ownedLedger(taxLines) as never,
		outbox as never,
		{ get: () => orderWriter } as never,
		options.unitOfWork as never
	);

	return {
		service,
		order: row,
		orders,
		repository: typeOrmOrderRepository,
		orderWriter,
		lineService,
		transactionService,
		lines,
		shippingMethods,
		creditLines,
		transactions,
		adjustments,
		taxLines,
		summaries,
		events,
		manager: typeOrmOrderRepository.manager
	};
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

	it('appends the move’s event through the same manager as the write, once the write has committed', async () => {
		// The README says observable changes leave through the core `event_outbox`, and nothing was
		// writing one. The append is bound to the write rather than made after it by the caller: it goes
		// through the order repository's own entity manager — the one the conditional update and the
		// summary row were written through — and it carries the version that update produced.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));

		const written = await fixture.service.recompute('order-1', 'PLACED', {
			event: { name: 'order.placed', data: { cartId: 'cart-1' } }
		} as never);

		expect(fixture.events).toHaveLength(1);
		expect(fixture.events[0]).toMatchObject({
			manager: fixture.manager,
			name: 'order.placed',
			aggregateType: 'ORDER',
			aggregateId: 'order-1'
		});
		// A projection, not an entity dump, and it states the version the write landed on so a consumer
		// can tell a replay from a later revision.
		expect(fixture.events[0].data).toMatchObject({
			orderId: 'order-1',
			status: written.status,
			paymentStatus: written.paymentStatus,
			fulfillmentStatus: written.fulfillmentStatus,
			version: written.version,
			cartId: 'cart-1'
		});
	});

	it('appends nothing for a recomputation that announces nothing', async () => {
		// A totals refresh is not a fact another context acts on, so it produces no row. An outbox that
		// carried every write would make `order.*` unsubscribable.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));

		await fixture.service.recompute('order-1', 'PAYMENT_RECONCILED');

		expect(fixture.events).toEqual([]);
	});

	it('announces nothing when the conditional write was refused', async () => {
		// The reason the event is stated *with* the move rather than published after it. A caller that
		// published on its own would have announced a placement the version predicate declined, and a
		// consumer would have acted on an order that never moved.
		const fixture = orderFixture({ version: 7 });

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 100 }));

		await expect(
			fixture.service.recompute('order-1', 'PLACED', {
				expectation: { wildcard: false, versions: [3] },
				event: { name: 'order.placed' }
			} as never)
		).rejects.toBeDefined();

		expect(fixture.events).toEqual([]);
		expect(fixture.order.version).toBe(7);
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

	it('sums the ledger on its digits, so an order captured in full is not reported short', async () => {
		// The counterexample. `0.10 + 0.70` is `0.7999999999999999` in binary floating point, and the
		// state machine — which compares exactly — was being handed that. The fully captured order was
		// stamped `PARTIALLY_CAPTURED`, which is not one of the three statuses a confirmation admits, so
		// the order could then never be confirmed or completed either. The parts still have to sum to
		// the whole: `0.10 + 0.70 = 0.80`, and 0.80 covers a grand total of 0.80.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 0.8 }));
		fixture.transactions.push({ orderId: 'order-1', amount: 0.1, type: OrderTransactionType.CAPTURE });
		fixture.transactions.push({ orderId: 'order-1', amount: 0.7, type: OrderTransactionType.CAPTURE });

		const written = await fixture.service.recompute('order-1', 'PAYMENT_RECONCILED');

		expect(written.paymentStatus).toBe(OrderPaymentStatus.CAPTURED);

		// Control: a genuinely short capture is still short, so the fix is exact arithmetic rather than
		// a licence to call everything captured.
		const short = orderFixture();

		short.lines.push(line('L1', { quantity: 1, unitPrice: 0.8 }));
		short.transactions.push({ orderId: 'order-1', amount: 0.1, type: OrderTransactionType.CAPTURE });
		short.transactions.push({ orderId: 'order-1', amount: 0.6, type: OrderTransactionType.CAPTURE });

		expect((await short.service.recompute('order-1', 'PAYMENT_RECONCILED')).paymentStatus).toBe(
			OrderPaymentStatus.PARTIALLY_CAPTURED
		);
	});

	it('combines the two halves of a capture and of a refund exactly, not with `+`', async () => {
		// `captured` is the sum of the CAPTURE rows plus the sum of the positive MANUAL rows, and
		// `refunded` is three sums added together. Each half can be exact and the addition of the halves
		// still lose the value: `10 + 10.01` is `20.009999999999998`. The parts must sum to the whole
		// here too.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 20.01 }));
		fixture.transactions.push({ orderId: 'order-1', amount: 10, type: OrderTransactionType.CAPTURE });
		fixture.transactions.push({ orderId: 'order-1', amount: 10.01, type: OrderTransactionType.MANUAL });

		expect((await fixture.service.recompute('order-1', 'PAYMENT_RECONCILED')).paymentStatus).toBe(
			OrderPaymentStatus.CAPTURED
		);

		// And the refunded side, whose three sums are added the same way: a refund of the whole capture,
		// paid back in two parts that a double cannot add back to it.
		const refunded = orderFixture();

		refunded.lines.push(line('L1', { quantity: 1, unitPrice: 0.8 }));
		refunded.transactions.push({ orderId: 'order-1', amount: 0.8, type: OrderTransactionType.CAPTURE });
		refunded.transactions.push({ orderId: 'order-1', amount: -0.1, type: OrderTransactionType.REFUND });
		refunded.transactions.push({ orderId: 'order-1', amount: -0.7, type: OrderTransactionType.CHARGEBACK });

		expect((await refunded.service.recompute('order-1', 'PAYMENT_RECONCILED')).paymentStatus).toBe(
			OrderPaymentStatus.REFUNDED
		);
	});

	it('totals the line counters on their digits, so a fully accounted-for order is fulfilled', async () => {
		// `netTarget = ordered − writtenOff − dismissed`, and the derivation tests it for being exactly
		// zero. `0.3 − 0.1 − 0.2` is `-2.7755575615628914e-17` in binary floating point: neither above
		// zero nor equal to it, so the line fell through to `NOT_FULFILLED` and the order was stuck in
		// `CONFIRMED` for ever, because the derivation is deterministic and would decide the same way on
		// every recomputation.
		const fixture = orderFixture();

		fixture.lines.push(
			line('L1', { quantity: 0.3, writtenOffQuantity: 0.1, returnDismissedQuantity: 0.2, requiresShipping: true })
		);

		const written = await fixture.service.recompute('order-1', 'FULFILLMENT_COMMITTED');

		expect(written.fulfillmentStatus).toBe(FulfillmentStatus.FULFILLED);
	});

	it('decides the open-line question on the digits, so a fully accounted line is not still open', async () => {
		// The other half of the same stall. `0.7 + 0.3` is `0.9999999999999999`, which *is* below `1`, so
		// a line that shipped 0.7 and wrote off the remaining 0.3 was reported as still owing units —
		// and `completeIfSettled` would never complete the order it belongs to.
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 10, fulfilledQuantity: 0.7, writtenOffQuantity: 0.3 }));

		expect(await fixture.service.hasOpenShippableLines(fixture.order as never)).toBe(false);

		// Control: a line that genuinely still owes a unit is still open.
		fixture.lines[0].writtenOffQuantity = 0.1;
		expect(await fixture.service.hasOpenShippableLines(fixture.order as never)).toBe(true);
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

/**
 * The compensating measure ADR-26 states beside the obligation.
 *
 * The materialised columns are recomputed by every writer that moves a ledger — an obligation five
 * writers keep and the schema cannot enforce — and this is what turns a writer that missed from a
 * latent defect into a measured one. The suite drives the three answers that matter:
 *
 * - **an order the writer just produced is not written again.** The control that makes the sweep a
 *   reconciliation rather than a nightly rewrite: `recompute` bumps `order.version` and appends a
 *   summary row, so a pass that recomputed every order it read would move the public concurrency
 *   token of every recent order while nothing about any of them had changed;
 * - **an order whose stored status disagrees with its ledgers is reported as drift and repaired**,
 *   with both values in the report, and the repair carries a reason of its own rather than borrowing
 *   the move that should have written it;
 * - **one order the sweep cannot examine does not end the sweep**, because a pass that stopped at the
 *   first bad row would leave every order after it unexamined for as long as that row existed.
 *
 * The expected values are read out of the derivation rather than written into the test: the status a
 * fulfilled line produces is `deriveFulfillmentStatus`'s answer, and a test that hard-coded
 * `FULFILLED` would be asserting this suite's idea of the policy rather than the service's.
 */
describe('OrderTotalsService — the reconciliation (ADR-26)', () => {
	it('finds no drift in an order whose columns the writer just produced, and writes nothing', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99, fulfilledQuantity: 2 }));
		await fixture.service.recompute('order-1', 'PLACED');

		const version = fixture.order.version;
		const summaries = fixture.summaries.length;

		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(1);
		expect(report.drifted).toEqual([]);
		expect(report.repaired).toEqual([]);
		expect(report.failed).toEqual([]);
		// The control: no write, so no version move and no summary row.
		expect(fixture.order.version).toBe(version);
		expect(fixture.summaries).toHaveLength(summaries);
	});

	it('reports the columns that disagree with the ledgers, and repairs them', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99, fulfilledQuantity: 2 }));
		await fixture.service.recompute('order-1', 'PLACED');

		// What the derivation says, read from the service rather than assumed by this suite.
		const expected = String(fixture.order.fulfillmentStatus);
		const wrong =
			expected === FulfillmentStatus.FULFILLED ? FulfillmentStatus.NOT_FULFILLED : FulfillmentStatus.FULFILLED;
		// A writer that moved the ledger and never recomputed: the line is fulfilled and the order
		// still answers with the status it held before.
		fixture.order.fulfillmentStatus = wrong;

		const version = fixture.order.version;
		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(1);
		expect(report.drifted).toHaveLength(1);
		expect(report.drifted[0].orderId).toBe('order-1');
		expect(report.drifted[0].columns).toEqual(['fulfillmentStatus']);
		// Both sides of the disagreement, which is what makes the report actionable.
		expect(report.drifted[0].stored).toEqual({ fulfillmentStatus: wrong });
		expect(report.drifted[0].derived).toEqual({ fulfillmentStatus: expected });
		expect(report.repaired).toEqual(['order-1']);

		// The repair is a real write: the column now holds what the ledgers derive, the version moved,
		// and the summary row says a repair wrote it rather than the move that should have.
		expect(fixture.order.fulfillmentStatus).toBe(expected);
		expect(fixture.order.version).toBe(version + 1);
		expect(fixture.summaries.map((summary) => summary.reason)).toContain('DRIFT_REPAIRED');
	});

	it('reports a sum that disagrees, so the money columns are checked and not only the statuses', async () => {
		const fixture = orderFixture();

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99 }));
		await fixture.service.recompute('order-1', 'PLACED');

		// A stored total that is a cent away: the comparison has to be exact, and a sweep that compared
		// numbers rather than decimal strings would report `10.000000` against `10` as drift.
		fixture.order.grandTotal = '0.01';

		const report = await fixture.service.auditRecent();
		const drift = report.drifted[0];

		expect(drift.columns).toEqual(['grandTotal']);
		expect(drift.stored).toEqual({ grandTotal: '0.01' });
		expect(drift.derived.grandTotal).toBe('39.98');
		expect(report.repaired).toEqual(['order-1']);
	});

	it('examines an order whose ledger moved even though its own row did not', async () => {
		const fixture = orderFixture();

		// The order row was last written a month ago, so a window over `order.updatedAt` does not select
		// it — and the case ADR-26 exists to catch is exactly this one: a line moved today, the
		// re-derivation did not happen, and the only row the move did not write is the order's.
		fixture.order.updatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 10, updatedAt: new Date() }));

		// The window read answers nothing, so the ledger is the only thing that can put this order in
		// front of the sweep. Without it the report below would be `examined: 0`.
		fixture.repository.find.mockImplementation(async ({ where }: any = {}) =>
			where?.updatedAt ? [] : [{ ...fixture.order }]
		);

		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(1);
		expect(report.drifted.map((drift) => drift.orderId)).toEqual(['order-1']);
		// A line of ten that no stored total accounts for, which is the disagreement it was selected for.
		expect(report.drifted[0].columns).toContain('grandTotal');
		expect(report.repaired).toEqual(['order-1']);
	});

	it('records an order it cannot examine and sweeps the rest', async () => {
		const fixture = orderFixture();
		const second = { ...fixture.order, id: 'order-2' };

		// The second order's stored grand total disagrees with the nothing its ledgers hold, so the
		// sweep has something to report about it — which is how this case shows the pass continued past
		// the first order's failure rather than stopping at it. A corrupted status would not do: an
		// order with no lines derives a status, and the test cannot know which one without asking the
		// service, so the money column is the one that cannot coincide.
		second.grandTotal = '0.01';

		fixture.repository.find.mockImplementation(async () => [fixture.order, second]);

		const compute = jest.spyOn(fixture.service, 'computeTotals');

		compute.mockRejectedValueOnce(new Error('the ledger could not be read'));

		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(2);
		expect(report.failed.find((failure) => failure.orderId === 'order-1')?.message).toBe(
			'the ledger could not be read'
		);
		// The sweep went on: the second order was examined and its disagreement reported.
		expect(report.drifted.map((drift) => drift.orderId)).toContain('order-2');
	});
});

/**
 * What the reconciliation may cost, whose rows it writes, and what it can see under each ORM.
 *
 * The pass runs in `apps/worker`, fired by the scheduler with no request behind it, over every tenant's
 * orders. Three things follow, and each was a defect before these cases existed:
 *
 * - **no statement grows with the week**: the window is read a page of ids at a time and the orders it
 *   names are read in slices, because an `IN (...)` naming every touched order is one bound parameter
 *   per order, and Postgres refuses a statement past 65,535 of them — at which point not one order was
 *   examined, every night;
 * - **a repair is written in the order's tenant**: the tenant-aware create takes the tenant from the
 *   request, and with no request it wrote the summary of a repair with no tenant at all;
 * - **under MikroORM the pass sees what a ledger moved, and runs at all**: the order reference of a line
 *   is projected as the relation there, since the `orderId` column is dropped from a MikroORM projection;
 *   and every unit of the pass runs inside a persistence context of its own, since MikroORM refuses
 *   context-specific work on its global entity manager outside a request.
 */
describe('OrderTotalsService — the reconciliation’s bounds, tenancy and persistence context', () => {
	/**
	 * A persistence context that records each unit it was handed, and whether a unit is running.
	 *
	 * @param usesMikroOrm Which ORM the context answers for.
	 */
	const unitOfWorkDouble = (usesMikroOrm: boolean) => {
		const state = { units: 0, active: 0 };

		return {
			state,
			usesMikroOrm,
			run: jest.fn(async (work: () => Promise<unknown>) => {
				state.units++;
				state.active++;

				try {
					return await work();
				} finally {
					state.active--;
				}
			})
		};
	};

	it('reads the window a page at a time and the orders it names in slices, so no statement grows with the week', async () => {
		const fixture = orderFixture();

		for (const id of ['order-2', 'order-3', 'order-4', 'order-5']) {
			fixture.orders.push({ ...fixture.order, id });
		}

		// A line moved on one of them, so the ledger window is read in pages as well as the order window.
		fixture.lines.push(line('L1', { orderId: 'order-3', quantity: 1, unitPrice: 10, updatedAt: new Date() }));
		fixture.lines.push(line('L2', { orderId: 'order-4', quantity: 1, unitPrice: 10, updatedAt: new Date() }));
		fixture.lines.push(line('L3', { orderId: 'order-5', quantity: 1, unitPrice: 10, updatedAt: new Date() }));

		const report = await fixture.service.auditRecent(7, 2);

		expect(report.examined).toBe(5);
		expect(report.failed).toEqual([]);

		const reads = fixture.repository.find.mock.calls.map(([read]: any[]) => read);
		const slices = reads.filter(
			(read: any) => read.where?.id instanceof FindOperator && read.where.id.type === 'in'
		);
		const windowPages = reads.filter((read: any) => read.where?.updatedAt);

		// Every order was read, and no `IN (...)` named more of them than one slice holds. The control is
		// the arithmetic: the five ids read as one list would be a statement of five parameters here, and
		// of every touched order in production.
		expect(slices.map((read: any) => read.where.id.value.length)).toEqual([2, 2, 1]);
		expect(slices.flatMap((read: any) => read.where.id.value)).toEqual([
			'order-1',
			'order-2',
			'order-3',
			'order-4',
			'order-5'
		]);

		// The window itself is keyset-paged on the id: each page after the first starts past the last id
		// the previous page answered, and none is larger than the batch.
		expect(windowPages.map((read: any) => read.take)).toEqual([2, 2, 2]);
		expect(windowPages.map((read: any) => read.order)).toEqual([{ id: 'ASC' }, { id: 'ASC' }, { id: 'ASC' }]);
		expect(windowPages.map((read: any) => read.where.id?.value)).toEqual([undefined, 'order-2', 'order-4']);
		// Only the id is read from the window: the orders are read whole once, in their slices.
		expect(
			windowPages.every((read: any) => read.select?.id === true && Object.keys(read.select).length === 1)
		).toBe(true);

		const linePages = fixture.lineService.find.mock.calls.map(([read]: any[]) => read);

		expect(linePages.map((read: any) => read.take)).toEqual([2, 2]);
		expect(linePages[1].where.id.value).toBe('L2');
	});

	it('pages with the batch the package states when the caller states none', async () => {
		const fixture = orderFixture();

		await fixture.service.auditRecent();

		expect(fixture.repository.find.mock.calls[0][0].take).toBe(ORDER_TOTALS_AUDIT_BATCH_SIZE);
		// The bound is well inside the 65,535 bind parameters Postgres allows one statement.
		expect(ORDER_TOTALS_AUDIT_BATCH_SIZE).toBeLessThan(65_535);
	});

	it('writes the summary of a repair in the order’s own tenant and organization, with no request behind it', async () => {
		const fixture = orderFixture({ tenantId: 'tenant-1', organizationId: 'org-1' });

		fixture.lines.push(line('L1', { quantity: 2, unitPrice: 19.99 }));
		await fixture.service.recompute('order-1', 'PLACED');
		fixture.order.grandTotal = '0.01';

		const report = await fixture.service.auditRecent();

		expect(report.repaired).toEqual(['order-1']);

		const repair = fixture.summaries.find((summary) => summary.reason === 'DRIFT_REPAIRED');

		// The request context of this suite has no user, exactly as the worker's scheduler has none — so
		// the tenant on the row can only have come from the order row itself.
		expect(repair).toMatchObject({ orderId: 'order-1', tenantId: 'tenant-1', organizationId: 'org-1' });
	});

	it('names the orders a ledger moved under MikroORM too, where the order reference is the relation', async () => {
		const unitOfWork = unitOfWorkDouble(true);
		const fixture = orderFixture({}, { orm: 'mikro-orm', unitOfWork });

		// The order row was last written a month ago; a line moved today. Only the line can put this order
		// in front of the sweep.
		fixture.order.updatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 10, updatedAt: new Date() }));

		// The control: the projection the pass used to ask for answers no order on this ORM — MikroORM
		// drops the relation-id column from the statement and returns the primary key alone.
		expect(await fixture.lineService.find({ where: {}, select: { id: true, orderId: true } } as never)).toEqual([
			{ id: 'L1' }
		]);

		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(1);
		expect(report.drifted.map((drift) => drift.orderId)).toEqual(['order-1']);
		expect(report.repaired).toEqual(['order-1']);
		expect(fixture.lineService.find).toHaveBeenLastCalledWith(
			expect.objectContaining({ select: { id: true, order: true } })
		);
		expect(fixture.transactionService.find).toHaveBeenCalledWith(
			expect.objectContaining({ select: { id: true, order: true } })
		);
		// Under MikroORM the order rows are read through the order's own service, never through the
		// TypeORM repository, whose entity has no status, no currency and no tenant on that ORM.
		expect(fixture.orderWriter.find).toHaveBeenCalled();
		expect(fixture.repository.find).not.toHaveBeenCalled();
	});

	it('projects the order-id column under TypeORM, where it is a mapped column', async () => {
		const fixture = orderFixture();

		fixture.order.updatedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		fixture.lines.push(line('L1', { quantity: 1, unitPrice: 10, updatedAt: new Date() }));

		const report = await fixture.service.auditRecent();

		expect(report.examined).toBe(1);
		expect(fixture.lineService.find).toHaveBeenLastCalledWith(
			expect.objectContaining({ select: { id: true, orderId: true } })
		);
		expect(fixture.orderWriter.find).not.toHaveBeenCalled();
	});

	it('runs each order in a persistence context of its own, so one that fails stays that order’s', async () => {
		const unitOfWork = unitOfWorkDouble(true);
		const fixture = orderFixture({}, { orm: 'mikro-orm', unitOfWork });
		const second = { ...fixture.order, id: 'order-2', grandTotal: '0.01' };

		fixture.orders.push(second);

		const writesOutsideAUnit: string[] = [];
		const update = fixture.orderWriter.update;

		fixture.orderWriter.update = async (criteria: any, partial: any) => {
			if (unitOfWork.state.active === 0) {
				writesOutsideAUnit.push(String(criteria?.id ?? criteria));
			}

			return update(criteria, partial);
		};

		const compute = jest.spyOn(fixture.service, 'computeTotals');

		compute.mockRejectedValueOnce(new Error('the ledger could not be read'));

		const report = await fixture.service.auditRecent();

		expect(report.failed.map((failure) => failure.orderId)).toEqual(['order-1']);
		expect(report.repaired).toEqual(['order-2']);
		// One unit for the window, one for the slice of orders, and one per order — the failing order's
		// unit ended with its failure, and the next order was examined and repaired in a unit of its own.
		expect(unitOfWork.run).toHaveBeenCalledTimes(4);
		expect(writesOutsideAUnit).toEqual([]);
	});
});

/**
 * The entry that runs the reconciliation, and the schedule it runs on.
 *
 * The schedule is asserted as the decorator was applied with it rather than as a configuration file
 * says, because that is where the fact lives: a job is a decorated method, and a file that stated a
 * cron nothing applied would be a comment. The run itself is asserted for the two answers it has —
 * the report, and the caught failure — since what it hands back is what a test and the log both read.
 */
describe('OrderTotalsReconciliationScheduler — the schedule and the run', () => {
	it('is scheduled nightly, on the method that runs the pass, with overlap prevented', () => {
		const { __scheduled } = jest.requireMock('@gauzy/scheduler') as {
			__scheduled: Array<{ key: string; options: Record<string, any> }>;
		};
		const entry = __scheduled.find((job) => job.options.name === ORDER_TOTALS_RECONCILIATION_SCHEDULE);

		expect(entry?.key).toBe('reconcileOrderTotals');
		expect(entry?.options.cron).toBe(CronExpression.EVERY_DAY_AT_3AM);
		expect(entry?.options.preventOverlap).toBe(true);
	});

	it('answers what the pass examined, found and repaired', async () => {
		const report = {
			windowDays: 7,
			since: '2026-01-01T00:00:00.000Z',
			examined: 0,
			drifted: [],
			repaired: [],
			failed: []
		};
		const totals = { auditRecent: jest.fn().mockResolvedValue(report) };
		const scheduler = new OrderTotalsReconciliationScheduler(totals as never);

		// The same object, not a copy: the run answers the audit's own report, so a test asserts what
		// the sweep produced rather than what the job restated.
		await expect(scheduler.reconcileOrderTotals()).resolves.toBe(report);
		expect(totals.auditRecent).toHaveBeenCalledWith();
	});

	it('answers nothing rather than throwing when the pass cannot run', async () => {
		const totals = { auditRecent: jest.fn().mockRejectedValue(new Error('the database is unreachable')) };
		const scheduler = new OrderTotalsReconciliationScheduler(totals as never);

		await expect(scheduler.reconcileOrderTotals()).resolves.toBeUndefined();
	});
});
