/**
 * Every marketplace fact the GraphQL streams follow is appended in the transaction of the write it describes.
 *
 * `sellerChanged`, `sellerOfferingChanged`, `sellerPayoutChanged`, `sellerSettlementChanged` and
 * `sellerTransactionChanged` deliver what the outbox consumer publishes, so a fact appended after its write committed
 * — in a transaction of its own — is a fact a crash or a failed append loses while the write stands, and a fact
 * appended before a write that then fails announces a move that never happened. The seller lifecycle, an offering's
 * listing and withdrawal, a payout's failure, a settlement's recording and closing and a ledger row made settleable
 * all used to append in a second transaction after their save; `updateSeller`, `submit` and `startOffboarding`
 * appended nothing at all.
 *
 * The services are the real ones, over an in-memory store with **real transaction semantics**: a write made inside
 * `manager.transaction(work)` is staged on the transaction's own copy of the tables and committed only when `work`
 * returns, and the outbox double appends onto the copy of the manager it is handed. So each case asserts, against
 * the committed store, that the write and its fact commit together; that a fact that cannot be appended takes the
 * write back with it; and that an append made outside a transaction is caught.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites give.
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
	}

	return {
		AbstractValidationPipe: class AbstractValidationPipe {
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
		SequenceService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		operationOf: jest.requireActual('@gauzy/core/src/lib/api/bulk').operationOf,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
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
	DatabaseTypeEnum: { sqlite: 'sqlite', betterSqlite3: 'better-sqlite3', postgres: 'postgres', mysql: 'mysql' }
}));

import {
	OfferingStatus,
	SellerPayoutStatus,
	SellerSettlementStatus,
	SellerStatus,
	SellerTransactionStatus,
	SellerVerificationStatus
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SellerService } from './seller/seller.service';
import { SellerOfferingService } from './seller-offering/seller-offering.service';
import { SellerPayoutService } from './seller-payout/seller-payout.service';
import { SellerSettlementService } from './seller-settlement/seller-settlement.service';
import { SellerTransactionService } from './seller-transaction/seller-transaction.service';

const TENANT = '00000000-0000-4000-8000-0000000000aa';
const ORG = '00000000-0000-4000-8000-0000000000ab';
const SELLER = 'seller-1';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

const clone = (tables: Tables): Tables =>
	Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));

/** Plain equality, TypeORM's `In` operator, and an array of alternatives — the criteria these services state. */
function matches(row: Row, where: any = {}): boolean {
	if (Array.isArray(where)) return where.some((alternative) => matches(row, alternative));

	return Object.entries(where ?? {}).every(([field, expected]: [string, any]) => {
		if (expected === undefined) return true;
		if (expected && typeof expected === 'object' && expected._type === 'in') {
			return (expected._value as unknown[]).some((value) => String(row[field] ?? '') === String(value));
		}
		return String(row[field] ?? '') === String(expected ?? '');
	});
}

/**
 * A store with real transaction semantics.
 *
 * `manager.transaction(work)` hands `work` a manager over a copy of the committed tables and of the committed outbox,
 * and swaps the copies in only when `work` returns: a throw anywhere in it — the save, the append — leaves the
 * committed store exactly as it was. An append handed the root manager (not a transaction's) is recorded as such.
 */
function store(seed: Tables) {
	const db = { tables: clone(seed), outbox: [] as Row[] };
	let sequence = 0;
	let failOn: string | null = null;

	const tableOf = (entity: any): string => entity?.name ?? String(entity);

	const managerOver = (state: { tables: Tables; outbox: Row[] }, transactional: boolean): any => {
		const rows = (entity: any) => (state.tables[tableOf(entity)] ??= []);
		const save = async (entity: any, value: Row | Row[]) => {
			const one = (row: Row) => {
				const table = rows(entity);
				const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;
				if (index >= 0) {
					table[index] = { ...table[index], ...row };
					return { ...table[index] };
				}
				const created = { ...row, id: row.id ?? `${tableOf(entity)}-${++sequence}` };
				table.push(created);
				return { ...created };
			};
			return Array.isArray(value) ? value.map(one) : one(value);
		};
		const repositoryOf = (entity: any): any => ({
			manager: managerOver(state, transactional),
			create: (partial: Row) => ({ ...partial }),
			save: async (value: Row | Row[]) => await save(entity, value),
			findOne: async (options: any = {}) => {
				const found = rows(entity).find((row) => matches(row, options.where));
				return found ? { ...found } : null;
			},
			find: async (options: any = {}) => rows(entity).filter((row) => matches(row, options.where)).map((row) => ({ ...row }))
		});
		return {
			transactional,
			state,
			save,
			getRepository: repositoryOf,
			transaction: async (work: (manager: any) => Promise<unknown>) => {
				if (transactional) return await work(managerOver(state, true));
				const staged = { tables: clone(db.tables), outbox: [...db.outbox] };
				const result = await work(managerOver(staged, true));
				db.tables = staged.tables;
				db.outbox = staged.outbox;
				return result;
			}
		};
	};

	const root = () => managerOver(db, false);
	const outbox = {
		append: async (manager: any, event: Row) => {
			if (event.name === failOn) throw new Error('the outbox is unavailable');
			manager.state.outbox.push({ ...event, inTransaction: manager.transactional });
			return event;
		}
	};
	/** A repository over the committed store whose `manager` opens transactions on it, as TypeORM's does. */
	const repository = (entity: string) => {
		const view = () => root().getRepository({ name: entity });
		return {
			get manager() {
				return root();
			},
			create: (partial: Row) => ({ ...partial }),
			save: async (value: Row | Row[]) => await view().save(value),
			findOne: async (options: any = {}) => await view().findOne(options),
			find: async (options: any = {}) => await view().find(options)
		};
	};

	return {
		outbox,
		repository,
		failAppendOf: (name: string | null) => (failOn = name),
		row: (table: string, id: string) => db.tables[table]?.find((row) => row.id === id),
		events: () => db.outbox,
		facts: () => db.outbox.map((event) => [event.name, event.aggregateId, event.inTransaction])
	};
}

const scoped = { tenantId: TENANT, organizationId: ORG };

function fixture() {
	const db = store({
		Seller: [
			{ id: SELLER, code: 'S-1', status: SellerStatus.DRAFT, payoutAccountStatus: SellerVerificationStatus.VERIFIED, ...scoped },
			{ id: 'seller-active', code: 'S-2', status: SellerStatus.ACTIVE, ...scoped }
		],
		SellerOffering: [
			{ id: 'offering-1', sellerId: 'seller-active', variantId: 'variant-1', status: OfferingStatus.ACTIVE, ...scoped }
		],
		SellerTransaction: [
			{ id: 'transaction-1', sellerId: SELLER, status: SellerTransactionStatus.PENDING, currency: 'EUR', netAmount: '10.000000', ...scoped },
			{ id: 'transaction-2', sellerId: SELLER, status: SellerTransactionStatus.SETTLED, currency: 'EUR', netAmount: '5.000000', ...scoped }
		],
		SellerPayout: [
			{ id: 'payout-1', number: 'PO-1', sellerId: SELLER, status: SellerPayoutStatus.APPROVED, currency: 'EUR', ...scoped }
		],
		SellerPayoutLine: [{ id: 'line-1', sellerPayoutId: 'payout-1', sellerTransactionId: 'transaction-2', ...scoped }],
		SellerSettlement: [
			{ id: 'settlement-1', sellerId: SELLER, status: SellerSettlementStatus.OPEN, currency: 'EUR', discrepancyAmount: '0', ...scoped }
		]
	});
	const outbox = db.outbox as never;
	const sellers = db.repository('Seller') as never;
	const transactions = db.repository('SellerTransaction') as never;

	return {
		db,
		sellers: new SellerService(sellers, {} as never, outbox, transactions, db.repository('SellerPayout') as never, db.repository('SellerSettlement') as never),
		offerings: new SellerOfferingService(db.repository('SellerOffering') as never, {} as never, sellers, outbox),
		payouts: new SellerPayoutService(
			db.repository('SellerPayout') as never,
			{} as never,
			sellers,
			transactions,
			db.repository('SellerPayoutLine') as never,
			{} as never,
			outbox
		),
		settlements: new SellerSettlementService(db.repository('SellerSettlement') as never, {} as never, transactions, outbox),
		ledger: new SellerTransactionService(transactions, {} as never, sellers, outbox)
	};
}

/** Each write a stream follows, the row it moves, and the status the committed store holds after it. */
const WRITES: Array<{
	fact: string;
	table: string;
	id: string;
	before: string;
	after: string;
	run: (f: ReturnType<typeof fixture>) => Promise<unknown>;
}> = [
	{
		fact: 'seller.submitted',
		table: 'Seller',
		id: SELLER,
		before: SellerStatus.DRAFT,
		after: SellerStatus.SUBMITTED,
		run: (f) => f.sellers.submit(SELLER)
	},
	{
		fact: 'seller.suspended',
		table: 'Seller',
		id: 'seller-active',
		before: SellerStatus.ACTIVE,
		after: SellerStatus.SUSPENDED,
		run: (f) => f.sellers.suspend('seller-active', 'listing defect')
	},
	{
		fact: 'seller.offboarding-started',
		table: 'Seller',
		id: 'seller-active',
		before: SellerStatus.ACTIVE,
		after: SellerStatus.OFFBOARDING,
		run: (f) => f.sellers.startOffboarding('seller-active')
	},
	{
		fact: 'seller_offering.withdrawn',
		table: 'SellerOffering',
		id: 'offering-1',
		before: OfferingStatus.ACTIVE,
		after: OfferingStatus.WITHDRAWN,
		run: (f) => f.offerings.withdraw('offering-1')
	},
	{
		fact: 'seller.transaction.settleable',
		table: 'SellerTransaction',
		id: 'transaction-1',
		before: SellerTransactionStatus.PENDING,
		after: SellerTransactionStatus.SETTLEABLE,
		run: (f) => f.ledger.settle('transaction-1', 'released by hand')
	},
	{
		fact: 'seller_payout.failed',
		table: 'SellerPayout',
		id: 'payout-1',
		before: SellerPayoutStatus.APPROVED,
		after: SellerPayoutStatus.FAILED,
		run: (f) => f.payouts.recordExecution('payout-1', { paid: false, failureCode: 'account_closed' })
	},
	{
		fact: 'seller_settlement.closed',
		table: 'SellerSettlement',
		id: 'settlement-1',
		before: SellerSettlementStatus.OPEN,
		after: SellerSettlementStatus.CLOSED,
		run: (f) => f.settlements.close('settlement-1', 'reconciled')
	}
];

describe('the marketplace facts the streams follow are appended in the transaction of their write', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(WRITES)('$fact', ({ fact, table, id, before, after, run }) => {
		it('commits the write and its fact together, the fact appended inside the write’s transaction', async () => {
			const f = fixture();

			await run(f);

			expect(f.db.row(table, id)?.status).toBe(after);
			expect(f.db.facts()).toEqual([[fact, id, true]]);
		});

		it('takes the write back when its fact cannot be appended, so neither commits', async () => {
			const f = fixture();
			f.db.failAppendOf(fact);

			await expect(run(f)).rejects.toThrow(/outbox is unavailable/);

			expect(f.db.row(table, id)?.status).toBe(before);
			expect(f.db.facts()).toEqual([]);
		});
	});

	it('a failed payout releases its rows in the same transaction as the failure and its fact', async () => {
		const failed = fixture();
		await failed.payouts.recordExecution('payout-1', { paid: false, failureCode: 'account_closed' });
		expect(failed.db.row('SellerTransaction', 'transaction-2')?.status).toBe(SellerTransactionStatus.SETTLEABLE);

		const refused = fixture();
		refused.db.failAppendOf('seller_payout.failed');
		await expect(refused.payouts.recordExecution('payout-1', { paid: false })).rejects.toThrow(/outbox is unavailable/);
		expect(refused.db.row('SellerTransaction', 'transaction-2')?.status).toBe(SellerTransactionStatus.SETTLED);
	});

	it('an edit of a seller is announced with the members it wrote and never their values', async () => {
		const f = fixture();

		await f.sellers.updateSeller(SELLER, { name: 'Seller One Ltd', email: 'owner@example.com' } as never);

		expect(f.db.row('Seller', SELLER)).toMatchObject({ name: 'Seller One Ltd', email: 'owner@example.com' });
		expect(f.db.facts()).toEqual([['seller.updated', SELLER, true]]);
		expect(f.db.events()[0].data).toMatchObject({ changed: ['name', 'email'] });
		expect(JSON.stringify(f.db.events())).not.toContain('owner@example.com');
	});

	it('a listed offering and a recorded settlement commit with their facts, and neither commits without it', async () => {
		const listed = fixture();
		const offering = await listed.offerings.createOffering({ sellerId: 'seller-active', variantId: 'variant-2' } as never);
		expect(listed.db.row('SellerOffering', offering.id)).toBeDefined();
		expect(listed.db.facts()).toEqual([['seller_offering.created', offering.id, true]]);

		const notListed = fixture();
		notListed.db.failAppendOf('seller_offering.created');
		await expect(
			notListed.offerings.createOffering({ sellerId: 'seller-active', variantId: 'variant-3' } as never)
		).rejects.toThrow(/outbox is unavailable/);
		expect(notListed.db.facts()).toEqual([]);

		const recorded = fixture();
		const report = {
			sellerId: SELLER,
			currency: 'EUR',
			grossAmount: '5.000000',
			commissionAmount: '0.000000',
			feeAmount: '0.000000',
			discrepancyAmount: '0.000000'
		};
		const settlement = await recorded.settlements.record({ ...report, providerKey: 'stripe' } as never);
		expect(recorded.db.row('SellerSettlement', settlement.id)).toBeDefined();
		expect(recorded.db.facts()).toEqual([['seller_settlement.recorded', settlement.id, true]]);

		const notRecorded = fixture();
		notRecorded.db.failAppendOf('seller_settlement.recorded');
		await expect(
			notRecorded.settlements.record({ ...report, providerKey: 'stripe-2' } as never)
		).rejects.toThrow(/outbox is unavailable/);
		expect(notRecorded.db.facts()).toEqual([]);
	});

	it('a write the state machine refuses appends nothing', async () => {
		const f = fixture();

		await expect(f.sellers.startOffboarding(SELLER)).rejects.toThrow(/cannot become OFFBOARDING/);

		expect(f.db.row('Seller', SELLER)?.status).toBe(SellerStatus.DRAFT);
		expect(f.db.facts()).toEqual([]);
	});
});
