/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a join reader needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * service under test is the real one**.
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

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { SellerPayoutLineService } from './seller-payout-line.service';

/**
 * Reading the join between a payout and the ledger rows it pays (doc 20 §9.2, MK-22).
 *
 * The specification fixes two properties, and this suite pins both:
 *
 * - **lines are created and released by the payout service, never authored through the API** — a line
 *   is the evidence that a transaction was paid by a particular payout, so a caller that could write
 *   one could assert a payment that never happened;
 * - **a seller-scoped caller reads the lines of its own payouts** (§9.2), and the check resolves the
 *   payout and compares its seller rather than trusting the `sellerPayoutId` a caller supplied — a
 *   route that filtered only by that parameter would let one seller read another's payments by
 *   guessing one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SELLER = 'seller-1';

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

		if (Array.isArray(expected)) {
			return expected.some((value) => String(row[field] ?? '') === String(value));
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** One payout line. */
const lineRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerPayoutId: 'payout-1',
	sellerTransactionId: `transaction-${id}`,
	amount: '50.000000',
	currency: 'EUR',
	tenantId: TENANT,
	organizationId: ORG,
	...overrides
});

/** One payout. */
const payoutRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	...overrides
});

/** Builds the payout-line service over in-memory tables. */
function lineFixture(seed: { lines?: Row[]; payouts?: Row[] } = {}) {
	const tables = {
		seller_payout_line: [...(seed.lines ?? [lineRow('l1'), lineRow('l2')])],
		seller_payout: [...(seed.payouts ?? [payoutRow('payout-1'), payoutRow('payout-2', { sellerId: 'seller-2' })])]
	};

	const lineRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller_payout_line.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller_payout_line.filter((row) => matches(row, where)),
		findAndCount: async ({ where }: any = {}) => {
			const found = tables.seller_payout_line.filter((row) => matches(row, where));

			return [found, found.length];
		}
	};
	const payoutRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller_payout.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller_payout.filter((row) => matches(row, where))
	};

	const service = new SellerPayoutLineService(lineRepository, {} as never, payoutRepository);

	return { service, tables, store: (id: string) => tables.seller_payout_line.find((row) => row.id === id) };
}

describe('SellerPayoutLineService — reading lines in a seller’s scope (doc 20 §9.2, MK-22)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('narrows an unnamed scoped list to the caller’s own payouts rather than filtering a page afterwards', async () => {
		// "Without a payout to narrow by, the caller's own payouts are what it may read: listing every line
		// and filtering afterwards would hand the caller rows it may not see."
		const fixture = lineFixture({
			lines: [lineRow('l1'), lineRow('l2', { sellerPayoutId: 'payout-2' })]
		});

		const page = await fixture.service.listLines({}, { sellerId: SELLER, staff: false } as never);

		expect(page.items.map((row) => row.id)).toEqual(['l1']);
	});

	it('refuses a scoped caller that names another seller’s payout', async () => {
		// The guard resolves the payout and compares its seller, so guessing an identifier teaches the
		// caller that it guessed rather than returning an empty page.
		const fixture = lineFixture();

		await expect(
			fixture.service.listLines({ where: { sellerPayoutId: 'payout-2' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			fixture.service.getLine('l1', { sellerId: 'seller-2', staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('answers a named payout that does not exist with a not-found rather than an empty page', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.listLines({ where: { sellerPayoutId: 'nope' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('does not narrow a staff caller, whose tenant and organization predicates still apply', async () => {
		const fixture = lineFixture();

		const page = await fixture.service.listLines({}, { sellerId: SELLER, staff: true } as never);

		expect(page.items).toHaveLength(2);
	});

	it('reads one line and refuses one that is not the caller’s', async () => {
		const fixture = lineFixture({ lines: [lineRow('l1', { organizationId: 'another-org' })] });

		await expect(fixture.service.getLine('l1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.getLine('nope')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('exposes no writer: a line is written by the payout service and never authored through the API', async () => {
		const fixture = lineFixture();

		expect((fixture.service as unknown as Row).create).toBeUndefined();
		expect((fixture.service as unknown as Row).update).toBeUndefined();
	});
});
