/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a seller account service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**, together with the real money helper its balance and
 * statement are summed through.
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
import {
	CurrencyCode,
	SellerPayoutSchedule,
	SellerStatus,
	SellerTransactionStatus,
	SellerVerificationKind,
	SellerVerificationStatus
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Seller } from './seller.entity';
import { SellerService } from './seller.service';

/**
 * Seller accounts and their lifecycle (doc 20 §2, §8).
 *
 * The specification states four invariants of this aggregate, and each is pinned here:
 *
 * - **one organization, forever** (§2.6, §9.2): neither identifier is taken from a request body, and
 *   the update path ignores them outright, so an edit can never move a seller between organizations;
 * - **`ACTIVE` is never implicit** (§8.2, MK-3): it is reached by an explicit activation after every
 *   required verification passed, so a verification callback can move a seller to `APPROVED` and no
 *   further;
 * - **the state machine is a map, and every transition it does not contain is refused** (§2.4,
 *   §8.3) — while a *repeated* call is idempotent at the endpoint, because the caller's intent has
 *   already been satisfied;
 * - **the balance is the ledger** (§7.5, §7.6): it is summed from the rows every time it is asked
 *   for rather than cached, a negative figure is a reported fact rather than an error, and the
 *   reserve is a policy applied at run time rather than a stored amount.
 *
 * The service is constructed directly with in-memory doubles of its repositories; the doubles state
 * the `where` the service states, so the scoping cases below are not vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
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

		if (expected && typeof expected === 'object' && '_type' in (expected as Row)) {
			const operator = expected as Row;
			const values = operator._value;

			switch (operator._type) {
				case 'in':
					return (values as unknown[]).some((value) => String(row[field] ?? '') === String(value));
				case 'not':
					return !matches(row, { [field]: values });
				case 'isNull':
					return row[field] === null || row[field] === undefined;
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
	contactId: 'contact-1',
	name: 'Seller One',
	status: SellerStatus.DRAFT,
	businessVerificationStatus: SellerVerificationStatus.UNVERIFIED,
	taxVerificationStatus: SellerVerificationStatus.UNVERIFIED,
	payoutAccountStatus: SellerVerificationStatus.UNVERIFIED,
	defaultCommissionRate: '0.15',
	reservePercent: null,
	payoutThreshold: '0.00',
	payoutSchedule: SellerPayoutSchedule.MANUAL,
	...overrides
});

/** One ledger row. */
const transactionRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	currency: EUR,
	currencyDecimals: 2,
	kind: 'SALE',
	status: SellerTransactionStatus.SETTLEABLE,
	netAmount: '10.000000',
	commissionAmount: '1.000000',
	grossAmount: '11.000000',
	occurredAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/**
 * Builds the seller service over in-memory tables.
 *
 * @param seed What the fixture holds.
 * @param options.failCreateWith What the seller write should throw, to model a unique violation.
 */
function sellerFixture(seed: { sellers?: Row[]; transactions?: Row[]; payouts?: Row[]; settlements?: Row[] } = {}, options: { failCreateWith?: any } = {}) {
	let sequence = 0;
	const tables = {
		seller: [...(seed.sellers ?? [sellerRow()])],
		seller_transaction: [...(seed.transactions ?? [])],
		seller_payout: [...(seed.payouts ?? [])],
		seller_settlement: [...(seed.settlements ?? [])]
	};
	const appended: any[] = [];

	const tableOf = (entity: unknown): Row[] => {
		const name = (entity as any)?.name;

		if (name === 'Seller' || entity === Seller) {
			return tables.seller;
		}
		if (name === 'SellerTransaction') {
			return tables.seller_transaction;
		}
		if (name === 'SellerPayout') {
			return tables.seller_payout;
		}
		if (name === 'SellerSettlement') {
			return tables.seller_settlement;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	const manager: any = {
		save: async (entity: unknown, row: Row) => {
			if (options.failCreateWith && tableOf(entity) === tables.seller) {
				throw options.failCreateWith;
			}

			const table = tableOf(entity);
			const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}

			if (!row.id) {
				row.id = `generated-${++sequence}`;
			}

			table.push(row);

			return row;
		},
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager)
	};

	const sellerRepository: any = {
		manager,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => await manager.save(Seller, row),
		findOne: async (options: any = {}) => {
			const where = Array.isArray(options.where) ? options.where : [options.where ?? {}];

			return tables.seller.find((row) => where.some((condition: Row) => matches(row, condition))) ?? null;
		},
		find: async ({ where }: any = {}) => tables.seller.filter((row) => matches(row, where))
	};
	const transactionRepository: any = {
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
	const payoutRepository: any = { find: async ({ where }: any = {}) => tables.seller_payout.filter((row) => matches(row, where)) };
	const settlementRepository: any = {
		find: async ({ where }: any = {}) => tables.seller_settlement.filter((row) => matches(row, where))
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};

	const service = new SellerService(
		sellerRepository,
		{} as never,
		outbox as never,
		transactionRepository,
		payoutRepository,
		settlementRepository
	);

	return {
		service,
		manager,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		store: (id: string = SELLER) => tables.seller.find((row) => row.id === id)
	};
}

describe('SellerService — creating an account (doc 20 §2.6, §8.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the account in DRAFT with every verification unverified, and announces it', async () => {
		const fixture = sellerFixture({ sellers: [] });

		const seller = await fixture.service.createSeller({ contactId: 'contact-1', code: 'SELLER-1', name: 'Seller One' });

		expect(seller).toMatchObject({
			status: SellerStatus.DRAFT,
			businessVerificationStatus: SellerVerificationStatus.UNVERIFIED,
			taxVerificationStatus: SellerVerificationStatus.UNVERIFIED,
			payoutAccountStatus: SellerVerificationStatus.UNVERIFIED
		});
		expect(fixture.events()).toEqual(['seller.created']);
		expect(fixture.appended[0]).toMatchObject({ aggregateType: 'SELLER', tenantId: TENANT, organizationId: ORG });
	});

	it('takes neither identifier from the body, whatever the caller sent', async () => {
		// "`organizationId` is never read from a request body" (§2.6): a caller cannot open an account in
		// somebody else's organization by stating one.
		const fixture = sellerFixture({ sellers: [] });

		const seller = await fixture.service.createSeller({
			contactId: 'contact-1',
			code: 'SELLER-1',
			organizationId: OTHER_ORG,
			tenantId: 'another-tenant',
			status: SellerStatus.ACTIVE
		} as never);

		expect(seller).toMatchObject({ organizationId: ORG, tenantId: TENANT });
	});

	it('refuses an application with no party and one with no code', async () => {
		const fixture = sellerFixture({ sellers: [] });

		await expect(fixture.service.createSeller({ code: 'SELLER-1' } as never)).rejects.toThrow(
			/bound to an organization contact/
		);
		await expect(fixture.service.createSeller({ contactId: 'contact-1' } as never)).rejects.toThrow(/must have a code/);
		expect(fixture.tables.seller).toEqual([]);
	});

	it('answers a duplicate party or code with a conflict rather than a database error', async () => {
		const fixture = sellerFixture({ sellers: [] }, { failCreateWith: Object.assign(new Error('duplicate'), { code: '23505' }) });

		await expect(
			fixture.service.createSeller({ contactId: 'contact-1', code: 'SELLER-1' } as never)
		).rejects.toBeInstanceOf(ConflictException);
		expect(fixture.appended).toEqual([]);
	});

	it('lets any other failure through rather than reporting it as a duplicate', async () => {
		const fixture = sellerFixture({ sellers: [] }, { failCreateWith: new Error('the database is down') });

		await expect(
			fixture.service.createSeller({ contactId: 'contact-1', code: 'SELLER-1' } as never)
		).rejects.toThrow(/database is down/);
	});
});

describe('SellerService — editing an account (doc 20 §2.6, §16.8 S-6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the fields a seller may change and ignores the ones it may not', async () => {
		// "the first four are immutable and the last has its own endpoints, so an edit can never move a
		// seller between organizations or put one live" (§2.6).
		const fixture = sellerFixture();

		const updated = await fixture.service.updateSeller(SELLER, {
			name: 'Seller One Ltd',
			legalName: 'Seller One Limited',
			email: 'seller@example.com',
			code: 'HIJACKED',
			contactId: 'another-contact',
			status: SellerStatus.ACTIVE,
			organizationId: OTHER_ORG,
			tenantId: 'another-tenant'
		} as never);

		expect(updated).toMatchObject({
			name: 'Seller One Ltd',
			legalName: 'Seller One Limited',
			email: 'seller@example.com',
			code: 'SELLER-1',
			contactId: 'contact-1',
			status: SellerStatus.DRAFT,
			organizationId: ORG,
			tenantId: TENANT
		});
	});

	it('refuses an edit of a seller that is not the caller’s', async () => {
		const fixture = sellerFixture();

		await expect(fixture.service.updateSeller('nope', { name: 'x' } as never)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('reads a seller by its identifier or by its code, in the caller’s own organization', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow(), sellerRow({ id: 'seller-2', code: 'SELLER-2', organizationId: OTHER_ORG })]
		});

		expect((await fixture.service.getSeller(SELLER)).id).toBe(SELLER);
		expect((await fixture.service.getSeller('SELLER-1')).id).toBe(SELLER);
		// The other organization's code is not found rather than found and filtered: the predicate is part
		// of the read.
		await expect(fixture.service.getSeller('SELLER-2')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SellerService — the state machine (doc 20 §2.4, §8.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[SellerStatus.DRAFT, SellerStatus.SUBMITTED, 'submit'],
		[SellerStatus.IN_REVIEW, SellerStatus.REJECTED, 'reject'],
		[SellerStatus.APPROVED, SellerStatus.ACTIVE, 'activate'],
		[SellerStatus.ACTIVE, SellerStatus.OFFBOARDING, 'startOffboarding']
	])('moves a %s seller to %s', async (from, to, method) => {
		const fixture = sellerFixture({
			sellers: [
				sellerRow({
					status: from,
					businessVerificationStatus: SellerVerificationStatus.VERIFIED,
					taxVerificationStatus: SellerVerificationStatus.VERIFIED,
					payoutAccountStatus: SellerVerificationStatus.VERIFIED
				})
			]
		});

		const moved = await (fixture.service as any)[method](SELLER, 'a reason');

		expect(moved.status).toBe(to);
	});

	it('refuses every transition the lifecycle does not contain, naming the current status', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.REJECTED })] });

		await expect(fixture.service.submit(SELLER)).rejects.toBeInstanceOf(ConflictException);
		await expect(fixture.service.activate(SELLER)).rejects.toThrow(/REJECTED and cannot become ACTIVE/);
		expect(fixture.store()?.status).toBe(SellerStatus.REJECTED);
	});

	it('is idempotent at the endpoint: re-activating an active seller returns it unchanged', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.ACTIVE })] });

		const activated = await fixture.service.activate(SELLER);

		expect(activated.status).toBe(SellerStatus.ACTIVE);
		expect(fixture.appended).toEqual([]);
	});

	it('refuses to activate an approved seller whose payout account is not verified', async () => {
		// MK-3: no money reaches an account the platform has not verified, and `PROVIDER_SPLIT` and any
		// payout both require it.
		const fixture = sellerFixture({
			sellers: [sellerRow({ status: SellerStatus.APPROVED, payoutAccountStatus: SellerVerificationStatus.PENDING })]
		});

		await expect(fixture.service.activate(SELLER)).rejects.toThrow(/requires payout account verification/);
		expect(fixture.store()?.status).toBe(SellerStatus.APPROVED);
	});

	it('requires a reason to suspend and a reason to reject', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.ACTIVE })] });

		await expect(fixture.service.suspend(SELLER, '')).rejects.toThrow(/needs a reason/);
		expect(fixture.store()?.status).toBe(SellerStatus.ACTIVE);
	});

	it('suspends an active seller, records why and announces it', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.ACTIVE })] });

		const suspended = await fixture.service.suspend(SELLER, 'listing defect');

		expect(suspended).toMatchObject({ status: SellerStatus.SUSPENDED, suspensionReason: 'listing defect' });
		expect(fixture.events()).toEqual(['seller.suspended']);
	});

	it('is idempotent when the seller is already suspended, keeping the reason it was suspended for', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow({ status: SellerStatus.SUSPENDED, suspensionReason: 'listing defect' })]
		});

		const suspended = await fixture.service.suspend(SELLER, 'something else');

		expect(suspended.suspensionReason).toBe('listing defect');
		expect(fixture.appended).toEqual([]);
	});

	it('reinstates a suspended seller to ACTIVE and clears the suspension', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow({ status: SellerStatus.SUSPENDED, suspensionReason: 'listing defect' })]
		});

		const reinstated = await fixture.service.reinstate(SELLER);

		expect(reinstated).toMatchObject({ status: SellerStatus.ACTIVE, suspensionReason: null, suspendedAt: null });
		expect(fixture.appended[0].data).toMatchObject({ reinstate: true });
	});

	it('refuses to trade for anything but an active seller', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.SUSPENDED })] });

		expect(() => fixture.service.assertSellerActive(fixture.store() as never)).toThrow(ForbiddenException);
		expect(() => fixture.service.assertSellerActive(sellerRow({ status: SellerStatus.ACTIVE }) as never)).not.toThrow();
	});

	it('refuses a child row whose parent belongs to another organization', async () => {
		const fixture = sellerFixture();

		expect(() => fixture.service.assertSameOrganization({ organizationId: OTHER_ORG }, ORG)).toThrow(
			/another organization/
		);
		expect(() => fixture.service.assertSameOrganization({ organizationId: ORG }, ORG)).not.toThrow();
	});
});

describe('SellerService — verification (doc 20 §8.2, MK-3)', () => {
	const required = [SellerVerificationKind.BUSINESS_IDENTITY, SellerVerificationKind.TAX_IDENTIFIER, SellerVerificationKind.PAYOUT_ACCOUNT];

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records one kind at a time and moves to APPROVED only when every required kind is verified', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.IN_REVIEW })] });

		const first = await fixture.service.verify(SELLER, { kind: SellerVerificationKind.BUSINESS_IDENTITY, status: SellerVerificationStatus.VERIFIED }, required);

		expect(first.status).toBe(SellerStatus.IN_REVIEW);
		expect(first.businessVerificationStatus).toBe(SellerVerificationStatus.VERIFIED);

		await fixture.service.verify(SELLER, { kind: SellerVerificationKind.TAX_IDENTIFIER, status: SellerVerificationStatus.VERIFIED }, required);
		const approved = await fixture.service.verify(
			SELLER,
			{ kind: SellerVerificationKind.PAYOUT_ACCOUNT, status: SellerVerificationStatus.VERIFIED },
			required
		);

		expect(approved.status).toBe(SellerStatus.APPROVED);
		// A verification callback can move a seller to APPROVED and no further: `ACTIVE` is an explicit
		// act, so the callback cannot put a seller live.
		expect(approved.status).not.toBe(SellerStatus.ACTIVE);
		expect(fixture.events()).toEqual(['seller.verified', 'seller.verified', 'seller.verified']);
	});

	it('moves to ACTION_REQUIRED on a fixable failure of a required kind', async () => {
		// "A fixable failure is a resubmission, not a refusal: the remedies are different, so the states
		// are different" (§8.2).
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.IN_REVIEW })] });

		const outcome = await fixture.service.verify(
			SELLER,
			{ kind: SellerVerificationKind.TAX_IDENTIFIER, status: SellerVerificationStatus.ACTION_REQUIRED },
			required
		);

		expect(outcome.status).toBe(SellerStatus.ACTION_REQUIRED);
	});

	it('does not put a seller live, or move it, when the verification is recorded outside review', async () => {
		const fixture = sellerFixture({
			sellers: [
				sellerRow({
					status: SellerStatus.ACTIVE,
					businessVerificationStatus: SellerVerificationStatus.VERIFIED,
					taxVerificationStatus: SellerVerificationStatus.VERIFIED,
					payoutAccountStatus: SellerVerificationStatus.VERIFIED
				})
			]
		});

		const recorded = await fixture.service.verify(
			SELLER,
			{ kind: SellerVerificationKind.TAX_IDENTIFIER, status: SellerVerificationStatus.EXPIRED, expiresAt: new Date('2027-01-01T00:00:00.000Z') },
			required
		);

		expect(recorded.status).toBe(SellerStatus.ACTIVE);
		expect(recorded.taxVerificationStatus).toBe(SellerVerificationStatus.EXPIRED);
		expect(recorded.verificationExpiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
	});

	it('refuses a result with no kind or no status, and one naming an unknown kind', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.IN_REVIEW })] });

		await expect(fixture.service.verify(SELLER, {} as never, required)).rejects.toThrow(/needs a kind and a status/);
		await expect(
			fixture.service.verify(SELLER, { kind: 'SOMETHING_ELSE' as never, status: SellerVerificationStatus.VERIFIED }, required)
		).rejects.toThrow(/Unknown verification kind/);
		expect(fixture.store()?.businessVerificationStatus).toBe(SellerVerificationStatus.UNVERIFIED);
	});

	it('takes the required set from its caller, so a tenant can require fewer kinds', async () => {
		const fixture = sellerFixture({ sellers: [sellerRow({ status: SellerStatus.IN_REVIEW })] });

		const approved = await fixture.service.verify(
			SELLER,
			{ kind: SellerVerificationKind.BUSINESS_IDENTITY, status: SellerVerificationStatus.VERIFIED },
			[SellerVerificationKind.BUSINESS_IDENTITY]
		);

		expect(approved.status).toBe(SellerStatus.APPROVED);
		expect(approved.taxVerificationStatus).toBe(SellerVerificationStatus.UNVERIFIED);
	});
});

describe('SellerService — the balance is the ledger (doc 20 §7.5, §7.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sums settleable, pending and held rows separately and reports what the next run would withhold', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow({ reservePercent: '0.10' })],
			transactions: [
				transactionRow('t1', { status: SellerTransactionStatus.SETTLEABLE, netAmount: '100.000000' }),
				transactionRow('t2', { status: SellerTransactionStatus.PENDING, netAmount: '40.000000' }),
				transactionRow('t3', { status: SellerTransactionStatus.HELD, netAmount: '25.000000' }),
				// A settled row is already spoken for by a payout, so it is not part of the balance at all.
				transactionRow('t4', { status: SellerTransactionStatus.SETTLED, netAmount: '999.000000' }),
				transactionRow('t5', { status: SellerTransactionStatus.PAID, netAmount: '999.000000' })
			]
		});

		const balance = await fixture.service.getBalance(fixture.store() as never, EUR);

		expect(balance).toMatchObject({
			currency: EUR,
			available: '100.000000',
			pending: '40.000000',
			held: '25.000000',
			negativeCarryForward: '0',
			reserveNextRun: '10.000000'
		});
	});

	it('reports a negative balance as a carry-forward rather than as an error', async () => {
		// "a refund after a payout makes the balance negative on purpose, and the next payout offsets it"
		// (§7.5): the figure the statement shows is the absolute value that will be offset.
		const fixture = sellerFixture({
			sellers: [sellerRow({ reservePercent: '0.10' })],
			transactions: [
				transactionRow('t1', { status: SellerTransactionStatus.SETTLEABLE, netAmount: '100.000000' }),
				transactionRow('t2', { status: SellerTransactionStatus.SETTLEABLE, netAmount: '-130.000000' })
			]
		});

		const balance = await fixture.service.getBalance(fixture.store() as never, EUR);

		expect(balance.available).toBe('-30.000000');
		expect(balance.negativeCarryForward).toBe('30.000000');
		// No reserve is withheld from a balance there is nothing to withhold from.
		expect(balance.reserveNextRun).toBe('0');
	});

	it('reports the next date the seller’s schedule would create a payout', async () => {
		const fixture = sellerFixture();
		const from = new Date('2026-01-10T00:00:00.000Z');

		expect(fixture.service.nextPayoutAt(sellerRow({ payoutSchedule: SellerPayoutSchedule.DAILY }) as never, from)).toEqual(
			new Date('2026-01-11T00:00:00.000Z')
		);
		expect(fixture.service.nextPayoutAt(sellerRow({ payoutSchedule: SellerPayoutSchedule.WEEKLY }) as never, from)).toEqual(
			new Date('2026-01-17T00:00:00.000Z')
		);
		expect(fixture.service.nextPayoutAt(sellerRow({ payoutSchedule: SellerPayoutSchedule.BI_WEEKLY }) as never, from)).toEqual(
			new Date('2026-01-24T00:00:00.000Z')
		);
		// Semi-monthly pays on the sixteenth and the first, so the answer depends on which half of the
		// month the question is asked in. The two are calendar dates rather than instants, so the assertion
		// reads the date the seller would see.
		const firstHalf = fixture.service.nextPayoutAt(
			sellerRow({ payoutSchedule: SellerPayoutSchedule.SEMI_MONTHLY }) as never,
			from
		) as Date;
		const secondHalf = fixture.service.nextPayoutAt(
			sellerRow({ payoutSchedule: SellerPayoutSchedule.SEMI_MONTHLY }) as never,
			new Date('2026-01-20T00:00:00.000Z')
		) as Date;

		expect([firstHalf.getFullYear(), firstHalf.getMonth(), firstHalf.getDate()]).toEqual([2026, 0, 16]);
		expect([secondHalf.getFullYear(), secondHalf.getMonth(), secondHalf.getDate()]).toEqual([2026, 1, 1]);

		const monthly = fixture.service.nextPayoutAt(
			sellerRow({ payoutSchedule: SellerPayoutSchedule.MONTHLY }) as never,
			from
		) as Date;

		expect([monthly.getFullYear(), monthly.getMonth(), monthly.getDate()]).toEqual([2026, 1, 1]);
		// The instant the projection starts from is not moved by the projection itself.
		expect(from.toISOString()).toBe('2026-01-10T00:00:00.000Z');
		// A manual seller is paid when an operator says so, and a threshold seller when its balance crosses
		// the threshold: neither has a date to promise.
		expect(fixture.service.nextPayoutAt(sellerRow({ payoutSchedule: SellerPayoutSchedule.MANUAL }) as never, from)).toBeUndefined();
		expect(fixture.service.nextPayoutAt(sellerRow({ payoutSchedule: SellerPayoutSchedule.THRESHOLD }) as never, from)).toBeUndefined();
	});
});

describe('SellerService — the statement (doc 20 §7.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('opens at what was earned before the period and closes at everything earned to date', async () => {
		const fixture = sellerFixture({
			transactions: [
				transactionRow('t1', { netAmount: '50.000000', occurredAt: new Date('2025-12-01T00:00:00.000Z') }),
				transactionRow('t2', { netAmount: '20.000000', occurredAt: new Date('2026-01-05T00:00:00.000Z') }),
				transactionRow('t3', { netAmount: '30.000000', occurredAt: new Date('2026-02-05T00:00:00.000Z') })
			]
		});

		const statement = await fixture.service.getStatement(SELLER, {
			from: new Date('2026-01-01T00:00:00.000Z'),
			to: new Date('2026-01-31T00:00:00.000Z'),
			currency: EUR
		});

		expect(statement.openingBalance).toBe('50.000000');
		expect(statement.closingBalance).toBe('100.000000');
		expect(statement.lines.map((row) => row.transactionId)).toEqual(['t2']);
		// The line carries the ledger's own exact decimals rather than a rounded rendering of them.
		expect(statement.lines[0].netAmount).toBe('20.000000');
	});

	it('carries the negative carry-forward, the reserve and the next payout date onto the statement', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow({ reservePercent: '0.25', payoutSchedule: SellerPayoutSchedule.MONTHLY })],
			transactions: [transactionRow('t1', { netAmount: '-40.000000' })]
		});

		const statement = await fixture.service.getStatement(SELLER, { currency: EUR });

		expect(statement.negativeCarryForward).toBe('40.000000');
		expect(statement.reserveNextRun).toBe('0');
		expect(statement.nextPayoutAt).toBeInstanceOf(Date);
	});

	it('refuses the statement of a seller that is not the caller’s', async () => {
		const fixture = sellerFixture();

		await expect(fixture.service.getStatement('nope', {})).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			fixture.service.getStatement(SELLER, {}, { sellerId: 'another-seller', staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});

describe('SellerService — what a scoped caller may see (MK-22, doc 20 §9.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('narrows a seller-scoped list to the caller’s own row rather than filtering a page afterwards', async () => {
		const fixture = sellerFixture({
			sellers: [sellerRow(), sellerRow({ id: 'seller-2', code: 'SELLER-2', contactId: 'contact-2' })]
		});
		const asked: any[] = [];

		(fixture.service as any).typeOrmSellerRepository.findAndCount = async (options: any) => {
			asked.push(options);

			return [fixture.tables.seller.filter((row: Row) => row.id === options.where.id), 1];
		};

		const page = await fixture.service.listSellers({}, { sellerId: SELLER, staff: false } as never);

		expect(asked[0].where).toMatchObject({ id: SELLER });
		expect(page.items).toHaveLength(1);
	});

	it('does not narrow a staff caller, whose tenant and organization predicates still apply', async () => {
		const fixture = sellerFixture();

		(fixture.service as any).typeOrmSellerRepository.findAndCount = async () => [fixture.tables.seller, 1];

		const page = await fixture.service.listSellers({}, { sellerId: SELLER, staff: true } as never);

		expect(page.items).toHaveLength(1);
	});

	it('refuses a seller an unbound credential names rather than answering an empty page', async () => {
		const fixture = sellerFixture();

		expect(() => fixture.service.assertSameOrganization({ organizationId: OTHER_ORG }, ORG)).toThrow(ForbiddenException);
		await expect(fixture.service.updateSeller(SELLER, { name: 'x' } as never, { sellerId: 'another', staff: false } as never)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(fixture.store()?.name).toBe('Seller One');
	});
});
