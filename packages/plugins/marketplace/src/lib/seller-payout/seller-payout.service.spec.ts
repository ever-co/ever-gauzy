/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a payout run needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * service under test is the real one**, together with the real money helper its reserve and its paid
 * amount are computed through: every assertion below is about an amount.
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
		// `@UsePipes(new AbstractValidationPipe(…))` runs when the controller class is defined, and Nest
		// refuses a pipe without `transform`; the double carries both so the suite can load.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
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
		// The decimal comparison the commission bands and the settlement's discrepancy are decided by is
		// the kernel's own, so the double hands over the real one: a comparison doubled here would agree
		// with the service about arithmetic the platform never performs.
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
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
import {
	CurrencyCode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerStatus,
	SellerTransactionStatus,
	SellerVerificationStatus
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerPayout } from './seller-payout.entity';
import { SellerPayoutService } from './seller-payout.service';

/**
 * Building, approving and executing payouts (doc 20 §7, MK-11, MK-12, MK-20, MK-21).
 *
 * The specification fixes the payout model as arithmetic and as policy, and each is pinned here:
 *
 * - **a payout is built from the ledger and is never independent of it** (§7.4): its amount is the
 *   sum of its lines, its reserve is computed at each run rather than stored, and
 *   `paidAmount = netAmount − feeAmount − reserveAmount` (MK-11);
 * - **the threshold's edges are minor units** (§7.5, MK-21): a balance below it carries forward, and
 *   exactly three things create a payout below it — the final offboarding payout, an operator's
 *   payout with a note, and a negative balance, which is never a payout at all;
 * - **the reserve is a policy applied at run time** (§7.5): `round(balance × reservePercent)`,
 *   computed at each run, so lowering the percentage releases it with nothing to reconcile, and a
 *   final payout applies none at all;
 * - **a transaction sits in at most one live payout line** (§7.5, MK-12), which is what makes a
 *   scheduler that fires twice pay nobody twice;
 * - **a paid payout is a fact** (§7.4, MK-13): it is never edited and never canceled, and the honest
 *   representation of a mistake is a compensating entry;
 * - **money that did not move must be payable again** (§7.4): a failed payout returns its rows to
 *   settleable.
 *
 * The service is constructed directly over an in-memory datastore; the doubles state the `where` the
 * service states, because a double that answered every row regardless would make the currency and
 * status cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const SELLER = 'seller-1';
const EUR = 'EUR' as CurrencyCode;
const DAY = 24 * 60 * 60 * 1000;
/** A window a pass may be asked to cover, stated once so the seeded payout and the run agree on it. */
const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-02-01T00:00:00.000Z');

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
				case 'in':
					return (operator._value as unknown[]).some((value) => String(row[field] ?? '') === String(value));
				case 'isNull':
					return row[field] === null || row[field] === undefined;
				case 'not':
					return !matches(row, { [field]: operator._value });
				default:
					throw new Error(`the in-memory double does not implement the "${operator._type}" operator`);
			}
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** A seller row. */
const sellerRow = (overrides: Row = {}) => ({
	id: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'SELLER-1',
	status: SellerStatus.ACTIVE,
	payoutAccountStatus: SellerVerificationStatus.VERIFIED,
	payoutCurrency: EUR,
	payoutSchedule: SellerPayoutSchedule.MONTHLY,
	payoutThreshold: '0.00',
	reservePercent: null,
	payoutHoldDays: null,
	payoutMode: 'PROVIDER_TRANSFER',
	payoutAccountReference: 'acct-1',
	metadata: null,
	...overrides
});

/** One settleable ledger row. */
const transactionRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	currency: EUR,
	currencyDecimals: 2,
	status: SellerTransactionStatus.SETTLEABLE,
	netAmount: '100.000000',
	occurredAt: new Date('2026-01-15T00:00:00.000Z'),
	settleableAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/** One payout row. */
const payoutRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	number: `PAY-${id}`,
	status: SellerPayoutStatus.PENDING,
	payoutMode: 'PROVIDER_TRANSFER',
	currency: EUR,
	currencyDecimals: 2,
	netAmount: '100.000000',
	feeAmount: '0.000000',
	reserveAmount: '0.000000',
	paidAmount: '100.000000',
	...overrides
});

/**
 * Builds the payout service over in-memory tables.
 *
 * @param seed What the fixture holds.
 */
function payoutFixture(seed: { sellers?: Row[]; transactions?: Row[]; payouts?: Row[]; lines?: Row[] } = {}) {
	let sequence = 0;
	const tables = {
		seller: [...(seed.sellers ?? [sellerRow()])],
		seller_transaction: [...(seed.transactions ?? [])],
		seller_payout: [...(seed.payouts ?? [])],
		seller_payout_line: [...(seed.lines ?? [])]
	};
	const appended: any[] = [];

	const tableOf = (entity: unknown): Row[] => {
		if (entity === Seller) {
			return tables.seller;
		}
		if (entity === SellerTransaction) {
			return tables.seller_transaction;
		}
		if (entity === SellerPayout) {
			return tables.seller_payout;
		}
		if (entity === SellerPayoutLine) {
			return tables.seller_payout_line;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	const manager: any = {
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const table = tableOf(entity);

			for (const row of list) {
				const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;

				if (index >= 0) {
					table[index] = { ...table[index], ...row };
					continue;
				}

				if (!row.id) {
					row.id = `generated-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		softRemove: async (entity: unknown, rows: Row[]) => {
			for (const row of rows ?? []) {
				row.deletedAt = new Date();
			}

			return rows;
		},
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager)
	};

	const payoutRepository: any = {
		manager,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => await manager.save(SellerPayout, row),
		findOne: async ({ where, order }: any = {}) => {
			const found = tables.seller_payout.filter((row) => matches(row, where));

			// The schedule predicate asks for the *latest* payout, so the double has to order the way the
			// service asked rather than answer whichever row it stored first: a double that ignored the
			// order would make every assertion about a seller's period vacuous.
			if (order?.scheduledAt === 'DESC') {
				found.sort((left, right) => new Date(right.scheduledAt ?? 0).getTime() - new Date(left.scheduledAt ?? 0).getTime());
			}

			return found[0] ?? null;
		},
		find: async ({ where }: any = {}) => tables.seller_payout.filter((row) => matches(row, where)),
		findAndCount: async ({ where }: any = {}) => {
			const found = tables.seller_payout.filter((row) => matches(row, where));

			return [found, found.length];
		}
	};
	const sellerRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller.filter((row) => matches(row, where))
	};
	const transactionRepository: any = {
		save: async (rows: any) => await manager.save(SellerTransaction, rows),
		find: async ({ where, order }: any = {}) => {
			const found = tables.seller_transaction.filter((row) => matches(row, where));

			if (order?.occurredAt === 'ASC') {
				return [...found].sort(
					(left, right) => new Date(left.occurredAt ?? 0).getTime() - new Date(right.occurredAt ?? 0).getTime()
				);
			}

			return found;
		}
	};
	const lineWhere: Row[] = [];
	const lineRepository: any = {
		find: async ({ where }: any = {}) => {
			lineWhere.push(where ?? {});

			return tables.seller_payout_line.filter((row) => matches(row, where));
		}
	};
	const sequenceService = {
		allocate: async (key: string) => ({ key, formatted: 'PAY-0001', number: 'PAY-0001', value: 1 })
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};

	const service = new SellerPayoutService(
		payoutRepository,
		{} as never,
		sellerRepository,
		transactionRepository,
		lineRepository,
		sequenceService as never,
		outbox as never
	);

	return {
		service,
		manager,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		store: (id: string) => tables.seller_payout.find((row) => row.id === id),
		rows: () => tables.seller_transaction,
		/** Every `where` the payout-line table was read with, which is what the exclusion is computed from. */
		lineReads: () => lineWhere
	};
}

describe('SellerPayoutService — building a payout (doc 20 §7.4, §7.5, MK-11)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('sums the settleable rows, writes one line each and marks them settled', async () => {
		const fixture = payoutFixture({
			transactions: [
				transactionRow('t1', { netAmount: '60.000000' }),
				transactionRow('t2', { netAmount: '40.500000' })
			]
		});

		const payout = await fixture.service.createPayout({ sellerId: SELLER, currency: EUR });

		expect(payout).toMatchObject({
			number: 'PAY-0001',
			status: SellerPayoutStatus.PENDING,
			currency: EUR,
			netAmount: '100.500000',
			feeAmount: '0.000000',
			reserveAmount: '0.000000',
			paidAmount: '100.500000'
		});
		// MK-11: the lines sum to the payout's net, and the paid amount is derived from the net.
		const lines = fixture.tables.seller_payout_line;

		expect(lines).toHaveLength(2);
		expect(lines.map((line) => line.amount)).toEqual(['60.000000', '40.500000']);
		expect(lines.map((line) => line.sellerTransactionId).sort()).toEqual(['t1', 't2']);
		expect(fixture.rows().map((row) => row.status)).toEqual([
			SellerTransactionStatus.SETTLED,
			SellerTransactionStatus.SETTLED
		]);
		expect(fixture.events()).toEqual(['seller-payout.created']);
		expect(fixture.appended[0].data).toMatchObject({ transactionCount: 2, netAmount: '100.500000' });
	});

	it('withholds the reserve as a policy applied at this run and pays the rest', async () => {
		// "`round(balance × reservePercent)` computed at each run, so lowering the percentage releases the
		// reserve on the next run automatically" (§7.5).
		const fixture = payoutFixture({
			sellers: [sellerRow({ reservePercent: '0.10' })],
			transactions: [transactionRow('t1', { netAmount: '99.990000' })]
		});

		const payout = await fixture.service.createPayout({ sellerId: SELLER, currency: EUR });

		// 99.99 × 0.10 = 9.999 → 10.00, one rounding at the currency's precision.
		expect(payout).toMatchObject({ reserveAmount: '10.000000', netAmount: '99.990000' });
		expect(payout.paidAmount).toBe('89.990000');
		expect(
			Number(payout.paidAmount) + Number(payout.reserveAmount) + Number(payout.feeAmount)
		).toBeCloseTo(Number(payout.netAmount), 6);
	});

	it('applies no reserve at all on a final offboarding payout, and pays below the threshold', async () => {
		// "a final offboarding payout applies no reserve at all because no future run will release one",
		// and the final payout is one of the three things that may sit below the threshold (§7.5).
		const fixture = payoutFixture({
			sellers: [sellerRow({ status: SellerStatus.OFFBOARDING, reservePercent: '0.50', payoutThreshold: '1000.00' })],
			transactions: [transactionRow('t1', { netAmount: '12.000000' })]
		});

		const payout = await fixture.service.createPayout({ sellerId: SELLER, currency: EUR, isFinal: true });

		expect(payout).toMatchObject({ reserveAmount: '0.000000', paidAmount: '12.000000', isFinal: true });
	});

	it('refuses a payout below the seller’s threshold that nothing exempts', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutThreshold: '100.00' })],
			transactions: [transactionRow('t1', { netAmount: '99.99' })]
		});

		await expect(fixture.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toThrow(
			/needs a note/
		);
		expect(fixture.tables.seller_payout).toEqual([]);
		expect(fixture.rows()[0].status).toBe(SellerTransactionStatus.SETTLEABLE);
	});

	it('accepts a below-threshold payout an operator signed for with a note', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutThreshold: '100.00' })],
			transactions: [transactionRow('t1', { netAmount: '99.99' })]
		});

		const payout = await fixture.service.createPayout({ sellerId: SELLER, currency: EUR, note: 'goodwill' });

		expect(payout.paidAmount).toBe('99.990000');
		expect(payout.note).toBe('goodwill');
	});

	it('accepts a payout exactly at the threshold and refuses one a minor unit below it', async () => {
		// The boundary itself: the threshold is inclusive, so an exactly-equal balance is payable.
		const atThreshold = payoutFixture({
			sellers: [sellerRow({ payoutThreshold: '100.00' })],
			transactions: [transactionRow('t1', { netAmount: '100.000000' })]
		});
		const below = payoutFixture({
			sellers: [sellerRow({ payoutThreshold: '100.00' })],
			transactions: [transactionRow('t1', { netAmount: '99.990000' })]
		});

		expect((await atThreshold.service.createPayout({ sellerId: SELLER, currency: EUR })).paidAmount).toBe('100.000000');
		await expect(below.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('refuses a payout for a seller that is suspended, or whose payout account is not verified', async () => {
		// MK-20 and MK-3: a suspended seller's balance is held rather than forfeited, and money is never
		// sent to an account the platform has not verified.
		const suspended = payoutFixture({ sellers: [sellerRow({ status: SellerStatus.SUSPENDED })], transactions: [transactionRow('t1')] });
		const unverified = payoutFixture({
			sellers: [sellerRow({ payoutAccountStatus: SellerVerificationStatus.PENDING })],
			transactions: [transactionRow('t1')]
		});

		await expect(suspended.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(unverified.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toThrow(
			/requires payout account verification/
		);
	});

	it('refuses a payout with nothing settleable, and one with no seller or currency', async () => {
		const fixture = payoutFixture({ transactions: [] });

		await expect(fixture.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toThrow(
			/nothing settleable/
		);
		await expect(fixture.service.createPayout({ sellerId: SELLER, currency: '' as never })).rejects.toThrow(
			/needs a seller and a currency/
		);
	});

	it('refuses a payout for a seller that does not exist', async () => {
		const fixture = payoutFixture({ sellers: [] });

		await expect(fixture.service.createPayout({ sellerId: SELLER, currency: EUR })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('settles only the rows a caller named and the currency it stated', async () => {
		const fixture = payoutFixture({
			transactions: [
				transactionRow('t1', { netAmount: '10.000000' }),
				transactionRow('t2', { netAmount: '20.000000' }),
				transactionRow('t3', { netAmount: '30.000000', currency: 'USD' }),
				transactionRow('t4', { netAmount: '40.000000', status: SellerTransactionStatus.PENDING })
			]
		});

		const payout = await fixture.service.createPayout({ sellerId: SELLER, currency: EUR, transactionIds: ['t1'] });

		expect(payout.netAmount).toBe('10.000000');
		expect(fixture.rows().find((row) => row.id === 't2')?.status).toBe(SellerTransactionStatus.SETTLEABLE);
		expect(fixture.rows().find((row) => row.id === 't3')?.status).toBe(SellerTransactionStatus.SETTLEABLE);
		expect(fixture.rows().find((row) => row.id === 't4')?.status).toBe(SellerTransactionStatus.PENDING);
	});
});

describe('SellerPayoutService — the run (doc 20 §7.5, MK-12, MK-21)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('pays a due seller and reports what it decided', async () => {
		const fixture = payoutFixture({ transactions: [transactionRow('t1', { netAmount: '80.000000' })] });

		const results = await fixture.service.run();

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ sellerId: SELLER, currency: EUR, balance: '80.000000', payable: '80.000000' });
		expect(results[0].payoutId).toBeDefined();
		expect(fixture.tables.seller_payout).toHaveLength(1);
	});

	it('never pays a manual seller by a pass, because an operator asks for those', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.MANUAL })],
			transactions: [transactionRow('t1')]
		});

		expect(await fixture.service.run()).toEqual([]);
		expect(fixture.tables.seller_payout).toEqual([]);
	});

	it('records why a seller was not paid rather than paying it anyway', async () => {
		// "a seller that is not paid is entitled to know which rule held it back" (§7.5).
		const nothing = payoutFixture({ transactions: [] });
		const below = payoutFixture({
			sellers: [sellerRow({ payoutThreshold: '500.00' })],
			transactions: [transactionRow('t1', { netAmount: '10.000000' })]
		});
		// A balance of exactly nothing is the one case that is neither below the threshold nor a payment:
		// there is simply nothing payable. A *negative* balance is below every threshold, which is the
		// reason the run names that rule instead.
		const zero = payoutFixture({ transactions: [transactionRow('t1', { netAmount: '0.000000' })] });
		const negative = payoutFixture({ transactions: [transactionRow('t1', { netAmount: '-30.000000' })] });

		expect((await nothing.service.run())[0]).toMatchObject({ skippedReason: 'NOTHING_SETTLEABLE' });
		expect((await below.service.run())[0]).toMatchObject({ skippedReason: 'BELOW_THRESHOLD', payable: '10.000000' });
		expect((await zero.service.run())[0]).toMatchObject({ skippedReason: 'NOTHING_PAYABLE', payable: '0.000000' });
		expect((await negative.service.run())[0]).toMatchObject({ skippedReason: 'BELOW_THRESHOLD', payable: '-30.000000' });
		expect(below.tables.seller_payout).toEqual([]);
		expect(negative.tables.seller_payout).toEqual([]);
	});

	it('records a seller it cannot resolve a currency for rather than guessing one', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutCurrency: null })],
			transactions: [transactionRow('t1')]
		});

		expect((await fixture.service.run())[0]).toMatchObject({ skippedReason: 'NO_PAYOUT_CURRENCY', currency: '' });
		expect(fixture.tables.seller_payout).toEqual([]);
	});

	it('creates nothing on a dry run and reports what it would have paid', async () => {
		const fixture = payoutFixture({ transactions: [transactionRow('t1', { netAmount: '80.000000' })] });

		const results = await fixture.service.run({ dryRun: true });

		expect(results[0]).toMatchObject({ payable: '80.000000' });
		expect(results[0].payoutId).toBeUndefined();
		expect(fixture.tables.seller_payout).toEqual([]);
		expect(fixture.rows()[0].status).toBe(SellerTransactionStatus.SETTLEABLE);
	});

	it('is idempotent: a second pass neither reconsiders a seller before its period nor re-pays a settled row', async () => {
		// "a transaction can sit in at most one live payout line, and one period cannot produce two payouts
		// for the same seller and currency, so a scheduler that fires twice pays nobody twice" (§7.5).
		//
		// Both halves are asserted, because only the second one used to hold. The seeded seller is monthly,
		// so the pass that runs the next minute is not that seller's moment at all — it used to be, and a
		// monthly seller on a daily pass therefore received about thirty payouts a month, each a separate
		// provider transfer with its own fee.
		const fixture = payoutFixture({ transactions: [transactionRow('t1', { netAmount: '80.000000' })] });

		const first = await fixture.service.run();

		expect(first[0].payoutId).toBeDefined();
		expect(await fixture.service.run()).toEqual([]);

		// And once the period has elapsed the seller is considered again — and the row already covered by a
		// live payout line is still not paid a second time, which is what this test was written for.
		fixture.tables.seller_payout[0].scheduledAt = new Date(Date.now() - 70 * DAY);

		const third = await fixture.service.run();

		expect(third[0]).toMatchObject({ skippedReason: 'NOTHING_SETTLEABLE', payable: '0.000000' });
		expect(fixture.tables.seller_payout).toHaveLength(1);
		expect(fixture.tables.seller_payout_line).toHaveLength(1);
	});

	it('excludes a row that is still inside the seller’s payout hold window', async () => {
		// "`seller.payoutHoldDays` delays inclusion of a transaction in any payout for that many days after
		// its `settleableAt`" (§7.5) — a hold that exists so a tenant can hold funds through the provider's
		// own chargeback window without touching its commission policy.
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutHoldDays: 30 })],
			transactions: [
				transactionRow('recent', { netAmount: '10.000000', settleableAt: new Date(Date.now() - 1000) }),
				transactionRow('old', { netAmount: '20.000000', settleableAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) })
			]
		});

		const results = await fixture.service.run();

		expect(results[0].balance).toBe('20.000000');
		expect(fixture.rows().find((row) => row.id === 'recent')?.status).toBe(SellerTransactionStatus.SETTLEABLE);
	});

	it('releases nothing on a reserve-heavy run below the threshold, and carries it forward', async () => {
		// A reserve that takes the payable amount under the threshold is exactly the case the threshold
		// exists for: the money stays on the ledger and the next run offers it again.
		const fixture = payoutFixture({
			sellers: [sellerRow({ reservePercent: '0.90', payoutThreshold: '50.00' })],
			transactions: [transactionRow('t1', { netAmount: '100.000000' })]
		});

		const results = await fixture.service.run();

		expect(results[0]).toMatchObject({ balance: '100.000000', reserveAmount: '90.000000', payable: '10.000000' });
		expect(results[0].skippedReason).toBe('BELOW_THRESHOLD');
		expect(fixture.tables.seller_payout).toEqual([]);
	});
});

describe('SellerPayoutService — whose moment this pass is (doc 20 §7.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('pays a seller that has never been paid, whatever its period', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY })],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		expect((await fixture.service.run())[0].payoutId).toBeDefined();
	});

	it('holds a weekly seller back until a week has passed since its last payout', async () => {
		const early = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY })],
			payouts: [payoutRow('p1', { scheduledAt: new Date(Date.now() - 2 * DAY) })],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});
		const due = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY })],
			payouts: [payoutRow('p1', { scheduledAt: new Date(Date.now() - 8 * DAY) })],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		// Not its moment: the seller is not considered at all, so the pass reports nothing about it.
		expect(await early.service.run()).toEqual([]);
		expect(early.tables.seller_payout).toHaveLength(1);

		expect((await due.service.run())[0].payoutId).toBeDefined();
		expect(due.tables.seller_payout).toHaveLength(2);
	});

	it('reads the latest payout rather than whichever one it finds first', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY })],
			payouts: [
				payoutRow('old', { scheduledAt: new Date(Date.now() - 400 * DAY) }),
				payoutRow('recent', { scheduledAt: new Date(Date.now() - 1 * DAY) })
			],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		expect(await fixture.service.run()).toEqual([]);
	});

	it('ignores a canceled payout, because the money it covered was released rather than paid', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY })],
			payouts: [
				payoutRow('canceled', { status: SellerPayoutStatus.CANCELED, scheduledAt: new Date(Date.now() - 1 * DAY) })
			],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		expect((await fixture.service.run())[0].payoutId).toBeDefined();
	});

	it('considers a threshold seller at every pass and lets the threshold be what holds it back', async () => {
		// A threshold schedule has no period: it is paid when its balance crosses the threshold, which is
		// the one rule that decides for it.
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.THRESHOLD, payoutThreshold: '500.00' })],
			payouts: [payoutRow('p1', { scheduledAt: new Date(Date.now() - 1000) })],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		expect((await fixture.service.run())[0]).toMatchObject({ skippedReason: 'BELOW_THRESHOLD' });
	});

	it('still never pays a manual seller, whatever its history', async () => {
		const fixture = payoutFixture({
			sellers: [sellerRow({ payoutSchedule: SellerPayoutSchedule.MANUAL })],
			transactions: [transactionRow('t1')]
		});

		expect(await fixture.service.run()).toEqual([]);
	});

	it('refuses to open a second payout over a period this seller and currency already have one for', async () => {
		// `run()`'s own docstring claims "one period cannot produce two payouts for the same seller and
		// currency" and nothing enforced it: the per-transaction constraint stops the same rows being paid
		// twice, and a scheduler that double-fired between two settlements still opened a second window.
		const fixture = payoutFixture({
			payouts: [
				payoutRow('p1', {
					scheduledAt: new Date(Date.now() - 400 * DAY),
					periodStart: PERIOD_START,
					periodEnd: PERIOD_END
				})
			],
			transactions: [transactionRow('t1', { netAmount: '80.000000' })]
		});

		const results = await fixture.service.run({ periodStart: PERIOD_START, periodEnd: PERIOD_END });

		expect(results[0]).toMatchObject({ skippedReason: 'PERIOD_ALREADY_PAID', balance: '80.000000' });
		expect(fixture.tables.seller_payout).toHaveLength(1);
		expect(fixture.rows()[0].status).toBe(SellerTransactionStatus.SETTLEABLE);
	});
});

describe('SellerPayoutService — what the settleable read costs and what it may see', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not let another organization’s payout line exclude this organization’s ledger row', async () => {
		// The exclusion used to be computed from `find({ deletedAt: IsNull() })` — every payout line in the
		// database, with no tenant, no organization, no seller and no restriction to the rows under
		// consideration. A foreign line that happened to name the same transaction id therefore held this
		// organization's row out of every payout, silently and for ever.
		const fixture = payoutFixture({
			transactions: [transactionRow('t1', { netAmount: '80.000000' })],
			lines: [{ id: 'foreign', sellerPayoutId: 'foreign-payout', sellerTransactionId: 't1', tenantId: TENANT, organizationId: OTHER_ORG }]
		});

		const results = await fixture.service.run();

		expect(results[0].payoutId).toBeDefined();
		expect(results[0].balance).toBe('80.000000');
	});

	it('asks the payout-line table only about the rows it is testing, in this seller’s own scope', async () => {
		const fixture = payoutFixture({
			transactions: [transactionRow('t1', { netAmount: '80.000000' }), transactionRow('t2', { netAmount: '20.000000' })]
		});

		await fixture.service.run();

		const read = fixture.lineReads()[0];

		expect(read).toMatchObject({ tenantId: TENANT, organizationId: ORG });
		expect((read.sellerTransactionId as any)?._value?.sort?.() ?? []).toEqual(['t1', 't2']);
	});

	it('does not read the payout-line table at all when the seller has nothing settleable', async () => {
		const fixture = payoutFixture({ transactions: [] });

		await fixture.service.run();

		expect(fixture.lineReads()).toEqual([]);
	});
});

describe('SellerPayoutService — approving and executing (doc 20 §7.4, MK-13)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('approves a pending payout and is idempotent when it is already approved', async () => {
		const fixture = payoutFixture({ payouts: [payoutRow('p1')] });

		const approved = await fixture.service.approve('p1');

		expect(approved).toMatchObject({ status: SellerPayoutStatus.APPROVED, approvedByUserId: 'user-1' });
		expect(approved.approvedAt).toBeInstanceOf(Date);

		const again = await fixture.service.approve('p1');

		expect(again.approvedAt).toEqual(approved.approvedAt);
	});

	it('refuses to approve a payout that is already paid or canceled', async () => {
		const paid = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.PAID })] });
		const canceled = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.CANCELED })] });

		await expect(paid.service.approve('p1')).rejects.toBeInstanceOf(ConflictException);
		await expect(canceled.service.approve('p1')).rejects.toThrow(/cannot be approved/);
	});

	it('records a provider’s execution: the payout and its rows move together', async () => {
		const fixture = payoutFixture({
			payouts: [payoutRow('p1', { status: SellerPayoutStatus.APPROVED, reserveAmount: '10.000000' })],
			lines: [{ id: 'l1', sellerPayoutId: 'p1', sellerTransactionId: 't1', amount: '100.000000' }],
			transactions: [transactionRow('t1', { status: SellerTransactionStatus.SETTLED })]
		});

		const paid = await fixture.service.recordExecution('p1', {
			paid: true,
			providerKey: 'acquirer',
			providerTransferId: 'tr_1',
			feeAmount: '2.50'
		});

		expect(paid).toMatchObject({
			status: SellerPayoutStatus.PAID,
			providerKey: 'acquirer',
			providerTransferId: 'tr_1',
			feeAmount: '2.500000'
		});
		// MK-11: paid = net − fee − reserve, exactly.
		expect(paid.paidAmount).toBe('87.500000');
		expect(fixture.rows()[0]).toMatchObject({ status: SellerTransactionStatus.PAID });
		expect(fixture.rows()[0].paidAt).toBeInstanceOf(Date);
		expect(fixture.events()).toEqual(['seller-payout.paid']);
	});

	it('returns the rows to settleable when the provider refused the transfer', async () => {
		// "money that did not move must be payable again" (§7.4).
		const fixture = payoutFixture({
			payouts: [payoutRow('p1', { status: SellerPayoutStatus.APPROVED })],
			lines: [{ id: 'l1', sellerPayoutId: 'p1', sellerTransactionId: 't1', amount: '100.000000' }],
			transactions: [transactionRow('t1', { status: SellerTransactionStatus.SETTLED, settledAt: new Date() })]
		});

		const failed = await fixture.service.recordExecution('p1', {
			paid: false,
			failureCode: 'insufficient_funds',
			failureReason: 'the provider refused'
		});

		expect(failed).toMatchObject({
			status: SellerPayoutStatus.FAILED,
			failureCode: 'insufficient_funds',
			failureReason: 'the provider refused'
		});
		expect(fixture.rows()[0]).toMatchObject({ status: SellerTransactionStatus.SETTLEABLE, settledAt: null });
		expect(fixture.events()).toEqual(['seller-payout.failed']);
		expect(fixture.appended[0].data).toMatchObject({ retryable: true });
	});

	it('never edits a payout that has been paid or canceled', async () => {
		const paid = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.PAID })] });
		const canceled = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.CANCELED })] });

		await expect(paid.service.recordExecution('p1', { paid: true })).rejects.toThrow(/never edited/);
		await expect(canceled.service.recordExecution('p1', { paid: true })).rejects.toBeInstanceOf(ConflictException);
	});

	it('re-drives a failed payout and refuses to re-drive anything else', async () => {
		const failed = payoutFixture({
			payouts: [payoutRow('p1', { status: SellerPayoutStatus.FAILED, failureCode: 'x', failureReason: 'y' })]
		});
		const pending = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.PENDING })] });

		const retried = await failed.service.retry('p1');

		expect(retried).toMatchObject({ status: SellerPayoutStatus.APPROVED, failureCode: null, failureReason: null });
		await expect(pending.service.retry('p1')).rejects.toThrow(/not retryable/);
	});
});

describe('SellerPayoutService — canceling a payout (doc 20 §7.4, MK-12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('releases its rows and removes its lines, which is what frees them for the next run', async () => {
		const fixture = payoutFixture({
			payouts: [payoutRow('p1', { status: SellerPayoutStatus.APPROVED, netAmount: '100.000000' })],
			lines: [
				{ id: 'l1', sellerPayoutId: 'p1', sellerTransactionId: 't1', amount: '60.000000' },
				{ id: 'l2', sellerPayoutId: 'p1', sellerTransactionId: 't2', amount: '40.000000' }
			],
			transactions: [
				transactionRow('t1', { status: SellerTransactionStatus.SETTLED, settledAt: new Date() }),
				transactionRow('t2', { status: SellerTransactionStatus.SETTLED, settledAt: new Date() })
			]
		});

		const canceled = await fixture.service.cancel('p1', 'the seller asked us to wait');

		expect(canceled.releasedTransactionCount).toBe(2);
		expect(canceled.payout).toMatchObject({ status: SellerPayoutStatus.CANCELED, note: 'the seller asked us to wait' });
		expect(fixture.rows().map((row) => row.status)).toEqual([
			SellerTransactionStatus.SETTLEABLE,
			SellerTransactionStatus.SETTLEABLE
		]);
		expect(fixture.tables.seller_payout_line.every((line) => line.deletedAt)).toBe(true);
		expect(fixture.events()).toEqual(['seller-payout.canceled']);
	});

	it('allows the canceled rows to be paid by a later run', async () => {
		const fixture = payoutFixture({
			payouts: [payoutRow('p1', { status: SellerPayoutStatus.APPROVED })],
			lines: [{ id: 'l1', sellerPayoutId: 'p1', sellerTransactionId: 't1', amount: '80.000000' }],
			transactions: [transactionRow('t1', { status: SellerTransactionStatus.SETTLED, netAmount: '80.000000' })]
		});

		await fixture.service.cancel('p1', 'retry later');

		const results = await fixture.service.run();

		expect(results[0].payable).toBe('80.000000');
		expect(results[0].payoutId).toBeDefined();
		expect(fixture.tables.seller_payout).toHaveLength(2);
	});

	it('refuses to cancel a paid payout and is idempotent on one already canceled', async () => {
		// "A paid payout is not canceled; a refund is written as a reversal row instead" (§7.4).
		const paid = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.PAID })] });
		const canceled = payoutFixture({ payouts: [payoutRow('p1', { status: SellerPayoutStatus.CANCELED })] });

		await expect(paid.service.cancel('p1', 'why')).rejects.toThrow(/not canceled/);
		expect((await canceled.service.cancel('p1', 'why')).releasedTransactionCount).toBe(0);
		expect(canceled.appended).toEqual([]);
	});
});

describe('SellerPayoutService — reading payouts in a seller’s scope (MK-22)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a scoped caller that names another seller', async () => {
		const fixture = payoutFixture({ payouts: [payoutRow('p1')] });

		await expect(
			fixture.service.getPayout('p1', { sellerId: 'another-seller', staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			fixture.service.listPayouts({ where: { sellerId: 'another-seller' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('narrows an unnamed scoped list to the caller’s own payouts', async () => {
		const fixture = payoutFixture({
			payouts: [payoutRow('p1'), payoutRow('p2', { sellerId: 'seller-2' })]
		});

		const page = await fixture.service.listPayouts({}, { sellerId: SELLER, staff: false } as never);

		expect(page.items.map((row) => row.id)).toEqual(['p1']);
	});

	it('reads one payout and refuses one that is not the caller’s', async () => {
		const fixture = payoutFixture({ payouts: [payoutRow('p1', { organizationId: 'another-org' })] });

		await expect(fixture.service.getPayout('p1')).rejects.toBeInstanceOf(NotFoundException);
	});
});
