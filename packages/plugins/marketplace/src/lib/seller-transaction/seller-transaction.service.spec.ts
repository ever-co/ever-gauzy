/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a ledger reader needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * service under test is the real one**, together with the real money helper its reconciliation is
 * summed through.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		TenantAwareCrudService,
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CurrencyCode, SellerHoldReason, SellerTransactionKind, SellerTransactionStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { SellerTransaction } from './seller-transaction.entity';
import { SellerTransactionService } from './seller-transaction.service';

/**
 * Reading and advancing the seller ledger (doc 20 §5.6, §7.6, MK-13, MK-15).
 *
 * The specification fixes the ledger's two shapes — append only, and reconciled by report rather than
 * by repair — and this suite pins them:
 *
 * - **the monetary columns are append only** (MK-15, §5.6): the only fields the service will move on
 *   an existing row are its status and its hold reason, and a correction is a reversal row;
 * - **a row already inside a payout is not pulled back into another one** (§7.5, MK-12);
 * - **the split reconciliation is the report the invariants exist for** (§7.6): per order, the
 *   captured amount, the sums of the sellers' nets, commissions and platform-funded discounts, and
 *   the **split delta** that must be zero — a non-zero delta is a severity-1 defect, and the report
 *   repairs nothing;
 * - **a hold writes no event, and that is deliberate**: the event catalogue names a sale being
 *   recorded, a row becoming settleable and a row being reversed, and it does not name a hold.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SELLER = 'seller-1';
const ORDER = 'order-1';
const EUR = 'EUR' as CurrencyCode;

type Row = Record<string, any>;

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Row, where: any = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		if (expected && typeof expected === 'object' && '_type' in (expected as Row)) {
			const operator = expected as Row;

			switch (operator._type) {
				case 'not':
					return !matches(row, { [field]: operator._value });
				case 'isNull':
					return row[field] === null || row[field] === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${operator._type}" operator`);
			}
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** One ledger row. */
const row = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	orderId: ORDER,
	orderLineId: `line-${id}`,
	tenantId: TENANT,
	organizationId: ORG,
	currency: EUR,
	currencyDecimals: 2,
	kind: SellerTransactionKind.SALE,
	status: SellerTransactionStatus.SETTLEABLE,
	grossAmount: '100.000000',
	taxAmount: '18.050000',
	sellerDiscountAmount: '-5.000000',
	platformDiscountAmount: '0.000000',
	commissionAmount: '14.250000',
	netAmount: '98.800000',
	reversesTransactionId: null,
	occurredAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/** Builds the ledger service over in-memory tables. */
function transactionFixture(seed: { transactions?: Row[]; sellers?: Row[] } = {}) {
	const tables = {
		seller_transaction: [...(seed.transactions ?? [row('t1')])],
		seller: [...(seed.sellers ?? [{ id: SELLER, tenantId: TENANT, organizationId: ORG }])]
	};
	const appended: any[] = [];

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager),
		save: async () => undefined
	};

	const transactionRepository: any = {
		manager,
		save: async (entityRow: Row) => {
			const index = tables.seller_transaction.findIndex((candidate) => candidate.id === entityRow.id);

			if (index >= 0) {
				tables.seller_transaction[index] = { ...tables.seller_transaction[index], ...entityRow };
			}

			return entityRow;
		},
		findOne: async ({ where }: any = {}) => tables.seller_transaction.find((candidate) => matches(candidate, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller_transaction.filter((candidate) => matches(candidate, where)),
		findAndCount: async ({ where }: any = {}) => {
			const found = tables.seller_transaction.filter((candidate) => matches(candidate, where));

			return [found, found.length];
		}
	};
	const sellerRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller.find((candidate) => matches(candidate, where)) ?? null
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};

	const service = new SellerTransactionService(transactionRepository, {} as never, sellerRepository, outbox as never);

	return {
		service,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		store: (id: string) => tables.seller_transaction.find((candidate) => candidate.id === id)
	};
}

describe('SellerTransactionService — advancing a row (doc 20 §5.1, §7.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('forces a row to settleable without touching a single amount', async () => {
		// "The state is advanced, never the amount" (§7.6): a staff caller can say a row is eligible for a
		// payout and cannot say how much it is worth.
		const fixture = transactionFixture({
			transactions: [row('t1', { status: SellerTransactionStatus.PENDING, holdReason: SellerHoldReason.DISPUTE })]
		});

		const settled = await fixture.service.settle('t1', 'the dispute was resolved');

		expect(settled).toMatchObject({
			status: SellerTransactionStatus.SETTLEABLE,
			holdReason: null,
			grossAmount: '100.000000',
			commissionAmount: '14.250000',
			netAmount: '98.800000'
		});
		expect(settled.settleableAt).toBeInstanceOf(Date);
		expect(fixture.events()).toEqual(['seller.transaction.settleable']);
	});

	it('keeps the instant a row first became settleable rather than moving it', async () => {
		const first = new Date('2026-01-20T00:00:00.000Z');
		const fixture = transactionFixture({ transactions: [row('t1', { status: SellerTransactionStatus.HELD, settleableAt: first })] });

		const settled = await fixture.service.settle('t1');

		expect(settled.settleableAt).toEqual(first);
	});

	it('refuses to pull a row out of a payout it is already covered by', async () => {
		const settled = transactionFixture({ transactions: [row('t1', { status: SellerTransactionStatus.SETTLED })] });
		const paid = transactionFixture({ transactions: [row('t1', { status: SellerTransactionStatus.PAID })] });

		await expect(settled.service.settle('t1')).rejects.toBeInstanceOf(ConflictException);
		await expect(paid.service.settle('t1')).rejects.toThrow(/already covered by a payout/);
	});

	it('holds a row out of payouts with a reason a seller can read, and writes no event', async () => {
		// "No outbox row is written, and that is deliberate rather than an omission: the event catalogue
		// ... does not name a hold."
		const fixture = transactionFixture();

		const held = await fixture.service.hold('t1', SellerHoldReason.CHARGEBACK, 'disputed by the buyer');

		expect(held).toMatchObject({
			status: SellerTransactionStatus.HELD,
			holdReason: SellerHoldReason.CHARGEBACK,
			description: 'disputed by the buyer'
		});
		expect(fixture.appended).toEqual([]);
	});

	it('refuses a hold with no reason', async () => {
		const fixture = transactionFixture();

		await expect(fixture.service.hold('t1', undefined as never)).rejects.toThrow(/needs a reason/);
		expect(fixture.store('t1')?.status).toBe(SellerTransactionStatus.SETTLEABLE);
	});

	it('refuses a row that is not the caller’s, and one that does not exist', async () => {
		const fixture = transactionFixture({ transactions: [row('t1', { organizationId: 'another-org' })] });

		await expect(fixture.service.getTransaction('t1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.settle('nope')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('names the kinds that reverse an earlier row', () => {
		expect(SellerTransactionService.reversalKinds()).toEqual([
			SellerTransactionKind.REFUND,
			SellerTransactionKind.CHARGEBACK
		]);
	});

	it('reads a seller of the caller’s own organization and refuses one that is not', async () => {
		const fixture = transactionFixture();

		expect((await fixture.service.requireSeller(SELLER)).id).toBe(SELLER);
		await expect(fixture.service.requireSeller('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SellerTransactionService — the split reconciliation (doc 20 §7.6, MK-9)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports a balanced order with a zero split delta and the platform’s retained share', async () => {
		// The S7 rows: the sellers' nets plus the platform's commission are exactly what the order
		// captured, so the delta the report is about is zero.
		const fixture = transactionFixture({
			transactions: [
				row('sale-1', { orderLineId: 'l1', netAmount: '98.800000', commissionAmount: '14.250000', grossAmount: '100.000000', taxAmount: '18.050000', sellerDiscountAmount: '-5.000000' }),
				row('sale-2', { orderLineId: 'l2', netAmount: '41.600000', commissionAmount: '6.000000', grossAmount: '40.000000', taxAmount: '7.600000', sellerDiscountAmount: '0.000000' })
			]
		});

		const report = await fixture.service.reconcile({});

		expect(report.total).toBe(1);
		expect(report.items[0]).toMatchObject({
			orderId: ORDER,
			currency: EUR,
			sumNet: '140.400000',
			sumCommission: '20.250000',
			splitDelta: '0.000000',
			platformRetained: '20.250000'
		});
		expect(report.items[0].capturedAmount).toBe('160.650000');
		// The platform-owned part of an order is not written to this ledger at all: it has no seller, so
		// the report states it as zero and lets the order-level report account for it.
		expect(report.items[0].platformOwnCaptured).toBe('0.000000');
	});

	it('reports the delta of an order the ledger does not balance, and repairs nothing', async () => {
		// "A non-zero delta is a severity-1 defect rather than a rounding curiosity, and the report never
		// repairs anything — a ledger is not a cache, so there is nothing safe to recompute."
		const fixture = transactionFixture({
			transactions: [
				row('sale-1', { netAmount: '98.800000', commissionAmount: '14.250000', grossAmount: '100.000000', taxAmount: '18.050000', sellerDiscountAmount: '-5.000000' }),
				row('sale-2', { netAmount: '41.590000', commissionAmount: '6.000000', grossAmount: '40.000000', taxAmount: '7.600000', sellerDiscountAmount: '0.000000' })
			]
		});

		const report = await fixture.service.reconcile({});

		expect(report.items[0].splitDelta).toBe('-0.010000');
		// Nothing was written: the report is a report.
		expect(fixture.store('sale-2')?.netAmount).toBe('41.590000');
	});

	it('states a reversal as the negative of what it reverses, so a full reversal returns the order to zero', async () => {
		const fixture = transactionFixture({
			transactions: [
				row('sale-1'),
				row('refund-1', {
					kind: SellerTransactionKind.REFUND,
					reversesTransactionId: 'sale-1',
					grossAmount: '-100.000000',
					taxAmount: '-18.050000',
					sellerDiscountAmount: '5.000000',
					commissionAmount: '-14.250000',
					netAmount: '-98.800000'
				})
			]
		});

		const report = await fixture.service.reconcile({});

		expect(report.items[0]).toMatchObject({ sumNet: '0.000000', sumCommission: '0.000000', splitDelta: '0.000000' });
		// The platform-funded discount is reported as a positive figure, because it is money the platform
		// contributed rather than money it took.
		expect(report.items[0].platformDiscount).toBe('0.000000');
	});

	it('reports a platform-funded discount as the platform’s own contribution', async () => {
		const fixture = transactionFixture({
			transactions: [
				row('sale-1', {
					netAmount: '97.740000',
					commissionAmount: '14.250000',
					platformDiscountAmount: '-5.590000',
					grossAmount: '100.000000',
					taxAmount: '16.990000',
					sellerDiscountAmount: '-5.000000'
				})
			]
		});

		const report = await fixture.service.reconcile({});

		expect(report.items[0].platformDiscount).toBe('5.590000');
		expect(report.items[0].capturedAmount).toBe('106.400000');
		// The platform's contribution is money it funded, so it is not part of what the seller's line
		// captured and it must not move the delta.
		expect(report.items[0].platformOwnCaptured).toBe('0.000000');
	});

	// The defect: `splitDelta` is computed as `net + commission + platformDiscount − gross − tax −
	// sellerDiscount`, and the row identity MK-7 makes `net + commission = gross + tax + sellerDiscount`,
	// so the delta collapses to `Σ platformDiscountAmount` — the platform's *own* contribution. Every
	// order the platform funded a promotion on is therefore reported with a non-zero delta, and §7.6
	// states that "any non-zero `splitDelta` is a severity-1 defect" — so the reconciliation report the
	// invariant exists for flags every correctly-balanced platform-funded order, and the real defects are
	// buried among them. Doc 20 §4.4 S10 is the worked case: the same row balances once `F`, the
	// platform's own contribution, is accounted for as the report already does elsewhere.
	// (`seller-transaction.service.ts`, the `splitDelta` subtraction chain in `reconcile`.)
	it('[DEFECT] reports a balanced platform-funded order with a zero split delta', async () => {
		const fixture = transactionFixture({
			transactions: [
				row('sale-1', {
					netAmount: '97.740000',
					commissionAmount: '14.250000',
					platformDiscountAmount: '-5.590000',
					grossAmount: '100.000000',
					taxAmount: '16.990000',
					sellerDiscountAmount: '-5.000000'
				})
			]
		});

		const report = await fixture.service.reconcile({});

		expect(report.items[0].splitDelta).toBe('0.000000');
	});

	it('narrows to one order or one seller when the caller names them, and reports only mismatched rows on request', async () => {
		const fixture = transactionFixture({
			transactions: [
				row('a1', { orderId: 'order-a', orderLineId: 'a1' }),
				row('b1', { orderId: 'order-b', orderLineId: 'b1', netAmount: '1.000000' }),
				row('b2', { orderId: 'order-b', orderLineId: 'b2', sellerId: 'seller-2' })
			]
		});

		expect((await fixture.service.reconcile({ orderId: 'order-a' })).items.map((item) => item.orderId)).toEqual(['order-a']);
		expect((await fixture.service.reconcile({ sellerId: 'seller-2' })).items.map((item) => item.orderId)).toEqual(['order-b']);
		// `onlyMismatched` drops the orders whose delta is zero, which is what makes the report readable on
		// a ledger of a million rows.
		const mismatched = await fixture.service.reconcile({ onlyMismatched: true });

		expect(mismatched.items.every((item) => item.splitDelta !== '0.000000')).toBe(true);
	});
});

describe('SellerTransactionService — what a scoped caller may read (MK-22)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the seller predicate whether or not the caller named a seller', async () => {
		const fixture = transactionFixture({
			transactions: [row('t1'), row('t2', { sellerId: 'seller-2' })]
		});

		const page = await fixture.service.listTransactions({}, { sellerId: SELLER, staff: false } as never);

		expect(page.items.map((entry) => entry.id)).toEqual(['t1']);
	});

	it('refuses a scoped caller that names another seller rather than narrowing silently', async () => {
		const fixture = transactionFixture();

		await expect(
			fixture.service.listTransactions({ where: { sellerId: 'seller-2' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			fixture.service.getTransaction('t1', { sellerId: 'seller-2', staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('does not narrow a staff caller', async () => {
		const fixture = transactionFixture({
			transactions: [row('t1'), row('t2', { sellerId: 'seller-2' })]
		});

		const page = await fixture.service.listTransactions({}, { sellerId: SELLER, staff: true } as never);

		expect(page.items).toHaveLength(2);
	});

	it('refuses a row with no identifier at all', async () => {
		const fixture = transactionFixture();

		await expect(fixture.service.getTransaction('')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.hold('t1', '' as never)).rejects.toBeInstanceOf(BadRequestException);
	});
});
