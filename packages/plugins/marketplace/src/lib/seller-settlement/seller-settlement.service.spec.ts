/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a settlement reader needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**, together with the real money helper its discrepancy is
 * computed through.
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
import { CurrencyCode, SellerSettlementStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SellerSettlement } from './seller-settlement.entity';
import { SellerSettlementService } from './seller-settlement.service';

/**
 * What a provider reported, reconciled against the platform's own ledger (doc 20 §7.3, §7.6, MK-24,
 * MK-25).
 *
 * The single most important property is what the service **refuses** to do, and it is pinned here:
 *
 * - **it never edits a ledger row to make the platform agree with a provider** (MK-24): a difference
 *   is stored as `discrepancyAmount`, requires a note and is reported — the reconciliation is a
 *   report a finance function reads, not a repair;
 * - **the net is derived from the reported figures rather than accepted beside them** (§7.3), so a
 *   row cannot state a net its own gross, commission and fee do not produce;
 * - **recording a difference without a word about it is how a difference becomes permanent** (§7.3),
 *   so a non-zero discrepancy needs a note;
 * - **a closed settlement is final** (MK-25): it accepts no further lines and cannot be disputed;
 * - **the report id is unique per provider**, so a replayed callback cannot create a second
 *   settlement and a retried client cannot move money twice (§7.3).
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SELLER = 'seller-1';
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

		return String(row[field] ?? '') === String(expected);
	});
}

/** One settlement row. */
const settlementRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	providerKey: 'acquirer',
	currency: EUR,
	currencyDecimals: 2,
	grossAmount: '120.000000',
	commissionAmount: '20.000000',
	feeAmount: '2.000000',
	netAmount: '98.000000',
	discrepancyAmount: '0.000000',
	status: SellerSettlementStatus.OPEN,
	periodStart: null,
	periodEnd: null,
	settlementCurrency: null,
	...overrides
});

/** One platform ledger row the reconciliation compares against. */
const transactionRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	currency: EUR,
	currencyDecimals: 2,
	netAmount: '50.000000',
	occurredAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/** Builds the settlement service over in-memory tables. */
function settlementFixture(seed: { settlements?: Row[]; transactions?: Row[] } = {}) {
	let sequence = 0;
	const tables = {
		seller_settlement: [...(seed.settlements ?? [settlementRow('s1')])],
		seller_transaction: [...(seed.transactions ?? [transactionRow('t1'), transactionRow('t2')])]
	};
	const appended: any[] = [];

	const manager: any = { transaction: async (run: (transactional: any) => Promise<any>) => await run(manager) };
	const settlementRepository: any = {
		manager,
		create: (partial: Row) => ({ ...partial }),
		save: async (entityRow: Row) => {
			const index = entityRow.id ? tables.seller_settlement.findIndex((candidate) => candidate.id === entityRow.id) : -1;

			if (index >= 0) {
				tables.seller_settlement[index] = { ...tables.seller_settlement[index], ...entityRow };

				return tables.seller_settlement[index];
			}

			entityRow.id = entityRow.id ?? `generated-${++sequence}`;
			tables.seller_settlement.push(entityRow);

			return entityRow;
		},
		findOne: async ({ where }: any = {}) => tables.seller_settlement.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller_settlement.filter((row) => matches(row, where)),
		findAndCount: async ({ where }: any = {}) => {
			const found = tables.seller_settlement.filter((row) => matches(row, where));

			return [found, found.length];
		}
	};
	const transactionRepository: any = {
		find: async ({ where }: any = {}) => tables.seller_transaction.filter((row) => matches(row, where))
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};

	const service = new SellerSettlementService(settlementRepository, {} as never, transactionRepository, outbox as never);

	return {
		service,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		store: (id: string = 's1') => tables.seller_settlement.find((row) => row.id === id)
	};
}

describe('SellerSettlementService — recording what the provider reported (doc 20 §7.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('stores the provider’s own figures and derives the net from them', async () => {
		// "The net is derived from the reported figures rather than accepted beside them, so the row cannot
		// state a net its own gross, commission and fee do not produce."
		const fixture = settlementFixture({ transactions: [transactionRow('t1', { netAmount: '98.000000' })] });

		const recorded = await fixture.service.record({
			sellerId: SELLER,
			providerKey: 'acquirer',
			currency: EUR,
			currencyDecimals: 2,
			grossAmount: '120.000000',
			commissionAmount: '20.000000',
			feeAmount: '2.000000',
			// A net the reported figures do not produce is ignored rather than stored.
			netAmount: '999.000000'
		} as never);

		expect(recorded).toMatchObject({ netAmount: '98.000000', status: SellerSettlementStatus.OPEN });
		// The provider's figures agree with the platform's own line, so nothing is flagged.
		expect(recorded.discrepancyAmount).toBe('0.000000');
		expect(fixture.events()).toEqual(['seller-settlement.recorded']);
		expect(fixture.appended[0].data).toMatchObject({ providerKey: 'acquirer', netAmount: '98.000000' });
	});

	it('refuses a settlement with no seller, no provider or no currency', async () => {
		const fixture = settlementFixture();

		await expect(fixture.service.record({ providerKey: 'acquirer', currency: EUR } as never)).rejects.toThrow(
			/needs a seller, a provider and a currency/
		);
		await expect(fixture.service.record({ sellerId: SELLER, currency: EUR } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.seller_settlement).toHaveLength(1);
	});

	it('refuses a seller-scoped caller that records a settlement for another seller', async () => {
		// The recorder is a write on a seller's own money, so it takes the scope every other write in this
		// package takes: a provider callback is staff-scoped and unaffected, and a seller-side credential
		// that named another seller is refused by name rather than writing a row against it.
		const fixture = settlementFixture();

		await expect(
			fixture.service.record(
				{ sellerId: 'seller-2', providerKey: 'acquirer', currency: EUR } as never,
				{ sellerId: SELLER, staff: false } as never
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(fixture.tables.seller_settlement).toHaveLength(1);
	});

	it('computes the discrepancy against the platform’s own lines when the provider states none', async () => {
		// The platform's two rows for the seller and currency sum to 100.00; the provider reports 98.00, so
		// the difference is the 2.00 the reconciliation is about.
		const fixture = settlementFixture();

		const recorded = await fixture.service.record({
			sellerId: SELLER,
			providerKey: 'acquirer',
			currency: EUR,
			currencyDecimals: 2,
			grossAmount: '120.000000',
			commissionAmount: '20.000000',
			feeAmount: '2.000000',
			note: 'the provider withheld a rolling reserve'
		} as never);

		expect(recorded.discrepancyAmount).toBe('2.000000');
	});

	it('refuses a settlement with a discrepancy that carries no note', async () => {
		// "Recording a difference without a word about it is how a difference becomes permanent."
		const fixture = settlementFixture();

		await expect(
			fixture.service.record({
				sellerId: SELLER,
				providerKey: 'acquirer',
				currency: EUR,
				currencyDecimals: 2,
				grossAmount: '120.000000',
				commissionAmount: '20.000000',
				feeAmount: '2.000000'
			} as never)
		).rejects.toThrow(/needs a note/);
		expect(fixture.tables.seller_settlement).toHaveLength(1);
	});

	it('accepts a settlement that agrees with the ledger without demanding a note', async () => {
		const fixture = settlementFixture();

		const recorded = await fixture.service.record({
			sellerId: SELLER,
			providerKey: 'acquirer',
			currency: EUR,
			currencyDecimals: 2,
			grossAmount: '120.000000',
			commissionAmount: '18.000000',
			feeAmount: '2.000000'
		} as never);

		expect(recorded.discrepancyAmount).toBe('0.000000');
	});

	it('takes a discrepancy the provider itself reported, note and all', async () => {
		const fixture = settlementFixture({ transactions: [] });

		const recorded = await fixture.service.record({
			sellerId: SELLER,
			providerKey: 'acquirer',
			currency: EUR,
			currencyDecimals: 2,
			grossAmount: '120.000000',
			commissionAmount: '20.000000',
			feeAmount: '2.000000',
			discrepancyAmount: '-1.500000',
			note: 'one line is missing from the report'
		} as never);

		expect(recorded.discrepancyAmount).toBe('-1.500000');
	});
});

describe('SellerSettlementService — reconciling (doc 20 §7.6, MK-24)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('marks a settlement reconciled when the platform’s lines sum to the reported net', async () => {
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { netAmount: '100.000000' })] });

		const outcome = await fixture.service.reconcile('s1', { providerReportId: 'report-1' });

		expect(outcome.settlement).toMatchObject({
			status: SellerSettlementStatus.RECONCILED,
			discrepancyAmount: '0.000000',
			providerReportId: 'report-1',
			reconciledByUserId: 'user-1'
		});
		expect(outcome.settlement.reconciledAt).toBeInstanceOf(Date);
		// The per-line figures are listed individually; nothing is netted away.
		expect(outcome.differences).toEqual([
			{ transactionId: 't1', platformNet: '50.000000' },
			{ transactionId: 't2', platformNet: '50.000000' }
		]);
	});

	it('marks a settlement disputed when the two disagree, and keeps the difference rather than repairing it', async () => {
		const fixture = settlementFixture({
			settlements: [settlementRow('s1', { netAmount: '98.000000' })],
			transactions: [transactionRow('t1', { netAmount: '100.000000' })]
		});

		const outcome = await fixture.service.reconcile('s1', { note: 'the provider withheld a reserve' });

		expect(outcome.settlement).toMatchObject({
			status: SellerSettlementStatus.DISPUTED,
			discrepancyAmount: '2.000000',
			note: 'the provider withheld a reserve'
		});
		// The ledger is untouched: the difference is reported, never written back to the rows.
		expect(fixture.tables.seller_transaction[0].netAmount).toBe('100.000000');
		expect(fixture.appended).toEqual([]);
	});

	it('compares only the lines inside the settlement’s period', async () => {
		const fixture = settlementFixture({
			settlements: [
				settlementRow('s1', {
					netAmount: '50.000000',
					periodStart: new Date('2026-01-01T00:00:00.000Z'),
					periodEnd: new Date('2026-01-31T00:00:00.000Z')
				})
			],
			transactions: [
				transactionRow('in', { netAmount: '50.000000', occurredAt: new Date('2026-01-15T00:00:00.000Z') }),
				transactionRow('out', { netAmount: '999.000000', occurredAt: new Date('2026-02-15T00:00:00.000Z') })
			]
		});

		const outcome = await fixture.service.reconcile('s1');

		expect(outcome.settlement.discrepancyAmount).toBe('0.000000');
		expect(outcome.differences.map((difference) => difference.transactionId)).toEqual(['in']);
	});
});

describe('SellerSettlementService — closing and disputing (MK-25, doc 20 §7.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('closes a settlement and announces the reconciliation it settled at', async () => {
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { discrepancyAmount: '0.000000' })] });

		const closed = await fixture.service.close('s1', 'signed off');

		expect(closed).toMatchObject({ status: SellerSettlementStatus.CLOSED, note: 'signed off' });
		expect(closed.closedAt).toBeInstanceOf(Date);
		expect(fixture.appended[0].data).toMatchObject({ reconciled: true });
	});

	it.each([
		['a column the provider left null', null, true],
		['a negative zero', '-0.000000', true],
		['a zero written at another scale', '0.00', true],
		['a difference of one millionth', '0.000001', false]
	])('reads %s the way the money layer reads it when it announces the close', async (_label, discrepancy, reconciled) => {
		// The announcement used to be decided by `Number(...) === 0` beside a string comparison against one
		// spelling of zero, which is the one monetary decision in this class that left the decimal kernel.
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { discrepancyAmount: discrepancy })] });

		await fixture.service.close('s1');

		expect(fixture.appended[0].data).toMatchObject({ reconciled });
	});

	it('is idempotent when the settlement is already closed', async () => {
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { status: SellerSettlementStatus.CLOSED })] });

		const closed = await fixture.service.close('s1');

		expect(closed.status).toBe(SellerSettlementStatus.CLOSED);
		expect(fixture.appended).toEqual([]);
	});

	it('refuses to dispute a closed settlement, because a closed settlement is final', async () => {
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { status: SellerSettlementStatus.CLOSED })] });

		await expect(fixture.service.dispute('s1', 'the figures are wrong')).rejects.toBeInstanceOf(ConflictException);
		expect(fixture.store()?.status).toBe(SellerSettlementStatus.CLOSED);
	});

	it('requires a reason to dispute, and records it', async () => {
		const fixture = settlementFixture();

		await expect(fixture.service.dispute('s1', '')).rejects.toThrow(/needs a reason/);

		const disputed = await fixture.service.dispute('s1', 'two lines are missing');

		expect(disputed).toMatchObject({ status: SellerSettlementStatus.DISPUTED, note: 'two lines are missing' });
	});

	it('refuses a settlement that does not exist', async () => {
		const fixture = settlementFixture();

		await expect(fixture.service.getSettlement('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.close('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SellerSettlementService — what a scoped caller may read (MK-22)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the seller predicate to a scoped list and refuses another seller', async () => {
		const fixture = settlementFixture({
			settlements: [settlementRow('s1'), settlementRow('s2', { sellerId: 'seller-2' })]
		});

		const page = await fixture.service.listSettlements({}, { sellerId: SELLER, staff: false } as never);

		expect(page.items.map((row) => row.id)).toEqual(['s1']);
		await expect(
			fixture.service.listSettlements({ where: { sellerId: 'seller-2' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('reads one settlement in the caller’s own tenant and refuses another', async () => {
		const fixture = settlementFixture({ settlements: [settlementRow('s1', { organizationId: 'another-org' })] });

		await expect(fixture.service.getSettlement('s1')).rejects.toBeInstanceOf(NotFoundException);
	});
});
