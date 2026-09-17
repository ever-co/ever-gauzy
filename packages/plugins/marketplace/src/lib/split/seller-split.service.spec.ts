/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a split ledger needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * service under test is the real one**, together with the real commission calculator and the real
 * money helper: every assertion below is about an amount, never about which method ran.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		TenantAwareCrudService: class {},
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

import { BadRequestException } from '@nestjs/common';
import { CommissionBasis, CommissionSource, CurrencyCode, SellerTransactionKind, SellerTransactionStatus } from '@gauzy/contracts';
import { Money, RequestContext } from '@gauzy/core';
import { SellerCommissionService } from '../commission/seller-commission.service';
import { Seller } from '../seller/seller.entity';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerSplitService } from './seller-split.service';

/**
 * The per-seller split of an order — the ledger the whole marketplace is reconciled against
 * (doc 20 §5).
 *
 * The specification states the split as invariants and as worked scenarios, and the invariants are
 * what this suite pins:
 *
 * - **MK-7**, per row: `netAmount = grossAmount + taxAmount + sellerDiscountAmount − commissionAmount`
 *   exactly, at the currency's precision (§5.2);
 * - **MK-8**, per row: the row's buyer-captured share is the seller's entitlement plus the platform's
 *   commission plus the platform's own discount contribution — no amount is created or destroyed
 *   inside a row (§5.2);
 * - **MK-9**, per order: `Σ (net + commission + platformDiscount) + P = C`, and in the common case
 *   with neither a platform-funded discount nor platform-owned content, `Σ net + Σ commission = C`
 *   (§5.2, §4.4 S7);
 * - **MK-10**: every division of a whole into parts goes through the one allocation algorithm, and any
 *   residue that survives lands on the platform rather than on a seller's net (§5.4, §5.5);
 * - **MK-16**: one `SALE` row per seller-owned line; a reversal is a new row, never an edit (§5.6);
 * - **MK-23**: a sale never leaves a seller with a negative net unless the seller or the offering
 *   allows it (§11.4);
 * - a split that does not balance is **refused** rather than written and reported later (§5.1, §16).
 *
 * The fixture runs the real commission calculator over in-memory repositories, so the amounts it
 * asserts are the ones a deployment produces rather than ones a double was told to produce.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const NORD = 'seller-nord';
const SUD = 'seller-sud';
const ORDER = 'order-1';
const EUR = 'EUR' as CurrencyCode;
const DECIMALS = 2;

type Row = Record<string, any>;

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
			return String(row[field] ?? '') !== String((expected as Row).value ?? '');
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** A seller row. */
const sellerRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id.toUpperCase(),
	name: `Seller ${id}`,
	status: 'ACTIVE',
	defaultCommissionRate: '0.15',
	commissionBasis: CommissionBasis.DISCOUNTED_SUBTOTAL,
	allowNegativeNet: false,
	...overrides
});

/** One order line, as the order package hands it to the split. */
const line = (overrides: Row = {}) => ({
	orderLineId: 'line-1',
	sellerId: NORD,
	quantity: '1',
	grossAmount: '100.00',
	taxAmount: '18.05',
	sellerDiscountAmount: '0.00',
	platformDiscountAmount: '0.00',
	...overrides
});

/**
 * Builds the split service over in-memory tables.
 *
 * @param seed What the fixture holds.
 * @param options.hideSeller Whether the seller lookup should answer a row the request did not scope to,
 * which is the shape a leaked cross-organization reference takes.
 */
function splitFixture(seed: { sellers?: Row[]; offerings?: Row[]; transactions?: Row[] } = {}, options: { hideSeller?: boolean } = {}) {
	let sequence = 0;
	const tables = {
		seller: [
			...(seed.sellers ?? [
				sellerRow(NORD),
				// The second seller trades on a different agreement, which is what makes the per-line
				// resolution visible in the rows rather than only in the code.
				sellerRow(SUD, { defaultCommissionRate: '0.10', commissionBasis: CommissionBasis.ITEM_SUBTOTAL })
			])
		],
		seller_offering: [...(seed.offerings ?? [])],
		seller_transaction: [...(seed.transactions ?? [])]
	};
	const appended: any[] = [];

	const tableOf = (entity: unknown): Row[] => {
		if (entity === Seller) {
			return tables.seller;
		}

		if (entity === SellerOffering) {
			return tables.seller_offering;
		}

		if (entity === SellerTransaction) {
			return tables.seller_transaction;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	const manager: any = {
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
					row.id = `transaction-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager),
		softRemove: async () => undefined
	};

	const sellerRepository: any = {
		findOne: async ({ where }: any = {}) =>
			tables.seller.find((row) => (options.hideSeller ? row.id === where.id : matches(row, where))) ?? null
	};
	const offeringRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller_offering.find((row) => matches(row, where)) ?? undefined
	};
	const transactionRepository: any = {
		manager,
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => await manager.save(SellerTransaction, rowOrRows),
		findOne: async ({ where }: any = {}) => tables.seller_transaction.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: any = {}) => tables.seller_transaction.filter((row) => matches(row, where))
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};

	const service = new SellerSplitService(
		new SellerCommissionService(),
		sellerRepository,
		offeringRepository,
		transactionRepository,
		outbox as never
	);

	return {
		service,
		manager,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		ledger: () => tables.seller_transaction,
		rowFor: (orderLineId: string) => tables.seller_transaction.find((row) => row.orderLineId === orderLineId)
	};
}

/** One order, as the split receives it. */
const order = (overrides: Row = {}) => ({
	orderId: ORDER,
	orderNumber: 'SO-0001',
	currency: EUR,
	currencyDecimals: DECIMALS,
	lines: [line()],
	...overrides
});

/** The exact sum of one monetary column, as the ledger holds it. */
const sumOf = (rows: Row[], column: string) =>
	Money.sum(
		rows.map((row) => Money.fromStorage(row[column], EUR, DECIMALS)),
		EUR,
		DECIMALS
	).toStorageString();

describe('SellerSplitService — the rows one order writes (doc 20 §4.4 S7, MK-7, MK-8, MK-16)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes the documented rows for the two-seller order, and the identity holds per row and per order', async () => {
		// §4.4 S7 without its promotion: L1 and L2 belong to NORD on a 15 % discounted-subtotal agreement,
		// L3 to SUD on 10 % of its list amount, and the commission is snapshotted onto each row so a
		// statement is reproducible from its own columns.
		const fixture = splitFixture();
		const input = order({
			lines: [
				line({ orderLineId: 'l1', sellerId: NORD, quantity: '4', grossAmount: '100.00', taxAmount: '18.05' }),
				line({ orderLineId: 'l2', sellerId: NORD, grossAmount: '40.00', taxAmount: '7.60' }),
				line({ orderLineId: 'l3', sellerId: SUD, quantity: '2', grossAmount: '120.00', taxAmount: '8.40' })
			]
		});

		const rows = await fixture.service.split(input as never);

		expect(rows).toHaveLength(3);
		expect(fixture.rowFor('l1')).toMatchObject({
			sellerId: NORD,
			kind: SellerTransactionKind.SALE,
			status: SellerTransactionStatus.PENDING,
			commissionBasis: CommissionBasis.DISCOUNTED_SUBTOTAL,
			commissionBasisAmount: '100.000000',
			commissionRate: '0.150000',
			commissionAmount: '15.000000',
			netAmount: '103.050000'
		});
		expect(fixture.rowFor('l2')).toMatchObject({ commissionBasisAmount: '40.000000', commissionAmount: '6.000000', netAmount: '41.600000' });
		expect(fixture.rowFor('l3')).toMatchObject({
			commissionBasis: CommissionBasis.ITEM_SUBTOTAL,
			commissionBasisAmount: '120.000000',
			commissionRate: '0.100000',
			commissionAmount: '12.000000',
			netAmount: '116.400000'
		});

		// MK-7 per row, and MK-8: the row's captured share is the seller's entitlement plus the platform's
		// commission, with nothing created or destroyed inside it.
		for (const row of rows) {
			const net = Money.fromStorage(row.netAmount, EUR, DECIMALS);
			const expected = Money.fromStorage(row.grossAmount, EUR, DECIMALS)
				.add(Money.fromStorage(row.taxAmount, EUR, DECIMALS))
				.add(Money.fromStorage(row.sellerDiscountAmount, EUR, DECIMALS))
				.subtract(Money.fromStorage(row.commissionAmount, EUR, DECIMALS));

			expect(net.equals(expected)).toBe(true);
			expect(
				net.add(Money.fromStorage(row.commissionAmount, EUR, DECIMALS)).add(Money.fromStorage(row.platformDiscountAmount, EUR, DECIMALS)).toStorageString()
			).toBe(
				Money.fromStorage(row.grossAmount, EUR, DECIMALS)
					.add(Money.fromStorage(row.taxAmount, EUR, DECIMALS))
					.add(Money.fromStorage(row.sellerDiscountAmount, EUR, DECIMALS))
					.add(Money.fromStorage(row.platformDiscountAmount, EUR, DECIMALS))
					.toStorageString()
			);
		}

		// MK-9 in its common form: the sellers' nets plus the platform's commission are the captured money.
		const captured = Money.sum(
			input.lines.map((row: Row) => Money.of(row.grossAmount, EUR, DECIMALS).add(Money.of(row.taxAmount, EUR, DECIMALS))),
			EUR,
			DECIMALS
		);

		expect(
			Money.fromStorage(sumOf(rows, 'netAmount'), EUR, DECIMALS)
				.add(Money.fromStorage(sumOf(rows, 'commissionAmount'), EUR, DECIMALS))
				.equals(captured)
		).toBe(true);
		expect(sumOf(rows, 'netAmount')).toBe('261.050000');
		expect(sumOf(rows, 'commissionAmount')).toBe('33.000000');
		expect(fixture.events()).toEqual(['seller.transaction.recorded']);
		expect(fixture.appended[0].data).toMatchObject({
			orderId: ORDER,
			orderNumber: 'SO-0001',
			kind: SellerTransactionKind.SALE,
			currency: EUR,
			netAmount: '261.050000',
			commissionAmount: '33.000000'
		});
		expect(fixture.appended[0].data.sellerIds.sort()).toEqual([NORD, SUD]);
	});

	it('writes no row for a platform-owned line but still accounts for the money it captured', async () => {
		// §4.6: platform-attributed shipping is platform-owned — it writes no `seller_transaction` row at
		// all and enters the identity as part of `P`.
		const fixture = splitFixture();

		const rows = await fixture.service.split(
			order({
				lines: [line({ orderLineId: 'l3', sellerId: SUD, grossAmount: '120.00', taxAmount: '8.40' }), line({ orderLineId: 's1', sellerId: undefined, grossAmount: '12.90', taxAmount: '2.45' })],
				platformOwnCaptured: '15.35'
			}) as never
		);

		expect(rows).toHaveLength(1);
		expect(fixture.rowFor('s1')).toBeUndefined();
		expect(fixture.ledger()).toHaveLength(1);
	});

	it('writes nothing at all for a test order, because a test sale is not a liability', async () => {
		const fixture = splitFixture();

		expect(await fixture.service.split(order({ isTest: true }) as never)).toEqual([]);
		expect(fixture.ledger()).toEqual([]);
		expect(fixture.appended).toEqual([]);
	});

	it('writes nothing for an order with no lines', async () => {
		const fixture = splitFixture();

		expect(await fixture.service.split(order({ lines: [] }) as never)).toEqual([]);
		expect(fixture.ledger()).toEqual([]);
	});

	it('refuses a split that does not balance rather than writing it and reporting it later', async () => {
		// §5.1 and §16: a non-zero delta is a severity-1 defect, so the order is refused instead of placed
		// with a broken ledger.
		const fixture = splitFixture();

		await expect(fixture.service.split(order({ platformOwnCaptured: '0.01' }) as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(fixture.service.split(order({ platformOwnCaptured: '0.01' }) as never)).rejects.toThrow(
			/does not balance/
		);
		expect(fixture.ledger()).toEqual([]);
	});

	// The defect: `assertSplitIdentity` builds the money the sellers' lines captured from
	// `grossAmount + taxAmount` alone, so any discount on a seller-owned line makes the identity fail by
	// exactly the discount and the whole split is refused. Doc 20 §5.2 states the identity against `C`,
	// the *captured* amount, which is what the buyer actually paid — S7's own numbers carry a `−5.00`
	// seller-funded discount (grand total 304.40) and S10 an order-level platform-funded one — and §4.5
	// is explicit that a discount lowers what the buyer pays. The consequence is that no order with a
	// promotion can be placed at all. (`seller-split.service.ts`, the `linesCaptured` sum inside
	// `assertSplitIdentity`.)
	it('[DEFECT] balances a split for an order that carries a seller-funded discount', async () => {
		const fixture = splitFixture();

		const rows = await fixture.service.split(
			order({
				lines: [line({ orderLineId: 'l1', quantity: '4', grossAmount: '100.00', taxAmount: '18.05', sellerDiscountAmount: '-5.00' })]
			}) as never
		);

		expect(rows).toHaveLength(1);
		expect(fixture.rowFor('l1')).toMatchObject({ commissionAmount: '14.250000', netAmount: '98.800000' });
	});

	it('[DEFECT] balances a split for an order that carries a platform-funded discount', async () => {
		const fixture = splitFixture();

		// §4.4 S10's line L1 in full — `gross 100.00, tax 16.99, sellerDisc −5.00, platformDisc −5.59`,
		// the tax being the one recomputed on the reduced net base — because the amounts asserted below
		// are that row's: `net 97.74` and `commission 14.25` are one subtraction
		// (`100.00 + 16.99 − 5.00 − 14.25`, MK-7), and the platform's own 5.59 is what makes the buyer's
		// captured share `106.40` rather than the `113.05` the seller-funded case captures.
		const rows = await fixture.service.split(
			order({
				lines: [
					line({
						orderLineId: 'l1',
						quantity: '4',
						grossAmount: '100.00',
						taxAmount: '16.99',
						sellerDiscountAmount: '-5.00',
						platformDiscountAmount: '-5.59'
					})
				],
				platformOwnCaptured: '-5.59'
			}) as never
		);

		expect(rows).toHaveLength(1);
		expect(fixture.rowFor('l1')).toMatchObject({ netAmount: '97.740000', commissionAmount: '14.250000' });
	});
});

describe('SellerSplitService — the seller a row is written for (MK-1, doc 20 §9.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a line that names a seller this organization does not have', async () => {
		const fixture = splitFixture();

		await expect(fixture.service.split(order({ lines: [line({ sellerId: 'no-such-seller' })] }) as never)).rejects.toThrow(
			/does not have/
		);
		expect(fixture.ledger()).toEqual([]);
	});

	it('refuses a leaked seller of another organization rather than trusting the foreign key alone', async () => {
		// "A leaked cross-organization seller would leak a balance, so the write path refuses it rather
		// than trusting the foreign key alone."
		const fixture = splitFixture({ sellers: [sellerRow(NORD, { organizationId: OTHER_ORG })] }, { hideSeller: true });

		await expect(fixture.service.split(order() as never)).rejects.toThrow(/belongs to another organization/);
		expect(fixture.ledger()).toEqual([]);
	});

	it('copies the seller’s own organization and tenant onto the row', async () => {
		const fixture = splitFixture();

		const rows = await fixture.service.split(order() as never);

		expect(rows[0]).toMatchObject({ organizationId: ORG, tenantId: TENANT, sellerId: NORD });
	});
});

describe('SellerSplitService — resolving and snapshotting the commission (doc 20 §4.2 property 2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('takes the offering’s override over the seller’s default and stores which it used', async () => {
		// "It is resolved once per line at placement. Re-resolution never happens for an existing
		// transaction" (§4.2 property 3): the resolved rate, basis and basis amount are on the row.
		const fixture = splitFixture({
			offerings: [
				{
					id: 'offering-1',
					sellerId: NORD,
					tenantId: TENANT,
					organizationId: ORG,
					commissionRate: '0.05',
					commissionBasis: CommissionBasis.ITEM_SUBTOTAL
				}
			]
		});

		const rows = await fixture.service.split(order({ lines: [line({ offeringId: 'offering-1' })] }) as never);

		expect(rows[0]).toMatchObject({
			commissionBasis: CommissionBasis.ITEM_SUBTOTAL,
			commissionBasisAmount: '100.000000',
			commissionRate: '0.050000',
			commissionAmount: '5.000000',
			netAmount: '113.050000'
		});
		// The source is recorded on the outcome so a statement can explain itself; the ledger row keeps
		// the resolved figures, which is what makes it reproducible.
		expect(rows[0].commissionOn).toBe('LINE');
	});

	it('refuses a seller-owned line whose commission cannot be resolved, because there is no implicit zero', async () => {
		const fixture = splitFixture({
			sellers: [sellerRow(NORD, { defaultCommissionRate: null, commissionBasis: null })]
		});

		await expect(fixture.service.split(order() as never)).rejects.toThrow(/No commission rate could be resolved/);
		expect(fixture.ledger()).toEqual([]);
	});
});

describe('SellerSplitService — the negative-net rule (MK-23, doc 20 §11.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a sale that would leave the seller with a negative net and writes nothing', async () => {
		const fixture = splitFixture({
			sellers: [
				sellerRow(NORD, {
					defaultCommissionRate: '0',
					commissionBasis: CommissionBasis.FIXED_PER_ITEM,
					fixedFeePerItem: '25.00'
				})
			]
		});

		await expect(
			fixture.service.split(
				order({ lines: [line({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00' })] }) as never
			)
		).rejects.toThrow(/does not allow a negative net/);
		expect(fixture.ledger()).toEqual([]);
	});

	it('writes the row when the seller has opted into a negative net', async () => {
		const fixture = splitFixture({
			sellers: [
				sellerRow(NORD, {
					defaultCommissionRate: '0',
					commissionBasis: CommissionBasis.FIXED_PER_ITEM,
					fixedFeePerItem: '25.00',
					allowNegativeNet: true
				})
			]
		});

		const rows = await fixture.service.split(
			order({ lines: [line({ grossAmount: '10.00', taxAmount: '0.00', sellerDiscountAmount: '0.00' })] }) as never
		);

		expect(rows[0]).toMatchObject({ commissionAmount: '25.000000', netAmount: '-15.000000' });
	});

	it('writes the row when the offering has opted into a negative net for this listing', async () => {
		const fixture = splitFixture({
			sellers: [
				sellerRow(NORD, {
					defaultCommissionRate: '0',
					commissionBasis: CommissionBasis.FIXED_PER_ITEM,
					fixedFeePerItem: '15.00'
				})
			],
			offerings: [{ id: 'offering-1', sellerId: NORD, tenantId: TENANT, organizationId: ORG, allowNegativeNet: true }]
		});

		const rows = await fixture.service.split(
			order({ lines: [line({ offeringId: 'offering-1', grossAmount: '10.00', taxAmount: '0.00' })] }) as never
		);

		expect(rows[0]).toMatchObject({ netAmount: '-5.000000' });
	});
});

describe('SellerSplitService — dividing a whole into parts (MK-10, doc 20 §5.4, §5.5)', () => {
	const amount = (value: string) => Money.of(value, EUR, DECIMALS);
	const fixture = () => splitFixture();

	it('distributes 17.00 over 33.33 / 16.67 / 49.99 by largest remainder, exactly', () => {
		// §5.4's own worked example, with the remainder ranking recorded: L3 (9149) then L1 (6666) take the
		// two spare minor units, so the parts sum to the whole and no cent appears or disappears.
		const parts = fixture().service.allocate(amount('17.00'), [amount('33.33'), amount('16.67'), amount('49.99')]);

		expect(parts.map((part) => part.toStorageString())).toEqual(['5.670000', '2.830000', '8.500000']);
		expect(Money.sum(parts, EUR, DECIMALS).toStorageString()).toBe('17.000000');
	});

	it('sums to the whole for an amount that does not divide evenly, whatever the weights', () => {
		// A hundredth of a cent cannot be allocated, so the algorithm has to choose a side for it: the
		// parts still sum to the whole, which is the property MK-10 exists for.
		const parts = fixture().service.allocate(amount('0.10'), [amount('1.00'), amount('1.00'), amount('1.00')]);

		expect(parts.map((part) => part.toStorageString())).toEqual(['0.040000', '0.030000', '0.030000']);
		expect(Money.sum(parts, EUR, DECIMALS).toStorageString()).toBe('0.100000');
	});

	it('is order-independent for the amounts, which is what makes the result reproducible', () => {
		// §5.4's property test P-4: shuffling the line array must not change what the parts sum to, and
		// must not move value from one part to another beyond the documented index tie-break.
		const parts = fixture().service.allocate(amount('17.00'), [amount('33.33'), amount('16.67'), amount('49.99')]);
		const shuffled = fixture().service.allocate(amount('17.00'), [amount('49.99'), amount('33.33'), amount('16.67')]);

		expect(Money.sum(parts, EUR, DECIMALS).toStorageString()).toBe('17.000000');
		expect(Money.sum(shuffled, EUR, DECIMALS).toStorageString()).toBe('17.000000');
		expect([...parts.map((part) => part.toStorageString())].sort()).toEqual(
			[...shuffled.map((part) => part.toStorageString())].sort()
		);
	});

	it('gives a zero-weight part nothing and still sums to the whole', () => {
		const parts = fixture().service.allocate(amount('10.00'), [amount('0.00'), amount('5.00'), amount('5.00')]);

		expect(parts[0].toStorageString()).toBe('0.000000');
		expect(Money.sum(parts, EUR, DECIMALS).toStorageString()).toBe('10.000000');
	});

	it('hands the whole amount to a single weight', () => {
		const parts = fixture().service.allocate(amount('10.00'), [amount('3.33')]);

		expect(parts.map((part) => part.toStorageString())).toEqual(['10.000000']);
	});
});

describe('SellerSplitService — reversal (doc 20 §4.4 S8/S9, §5.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The S2 sale row: gross 100.00, tax 18.05, seller discount −5.00, commission 14.25, net 98.80. */
	const saleRow = (overrides: Row = {}) => ({
		id: 'sale-1',
		sellerId: NORD,
		orderId: ORDER,
		orderLineId: 'l1',
		kind: SellerTransactionKind.SALE,
		status: SellerTransactionStatus.PENDING,
		currency: EUR,
		currencyDecimals: DECIMALS,
		grossAmount: '100.000000',
		taxAmount: '18.050000',
		sellerDiscountAmount: '-5.000000',
		platformDiscountAmount: '0.000000',
		commissionBasis: CommissionBasis.DISCOUNTED_SUBTOTAL,
		commissionBasisAmount: '95.000000',
		commissionRate: '0.150000',
		commissionAmount: '14.250000',
		netAmount: '98.800000',
		tenantId: TENANT,
		organizationId: ORG,
		...overrides
	});

	it('refuses to reverse a transaction that does not exist', async () => {
		const fixture = splitFixture();

		await expect(
			fixture.service.reverse({ transactionId: 'nope', kind: SellerTransactionKind.REFUND, quantity: '1' })
		).rejects.toThrow(/does not exist/);
	});

	it('writes a partial reversal as a new row that mirrors the original exactly, and never edits it', async () => {
		// MK-7 on the reversal: the negated amounts satisfy the same identity, so the seller's balance moves
		// by exactly the amount that was reversed and the platform's commission by exactly its own share.
		const fixture = splitFixture({ transactions: [saleRow()] });

		const reversal = await fixture.service.reverse({
			transactionId: 'sale-1',
			kind: SellerTransactionKind.REFUND,
			refundId: 'refund-1',
			quantity: '1',
			description: 'one unit returned'
		});

		expect(reversal).toMatchObject({
			sellerId: NORD,
			kind: SellerTransactionKind.REFUND,
			reversesTransactionId: 'sale-1',
			refundId: 'refund-1',
			status: SellerTransactionStatus.PENDING,
			grossAmount: '-100.000000',
			taxAmount: '-18.050000',
			sellerDiscountAmount: '5.000000',
			commissionAmount: '-14.250000',
			netAmount: '-98.800000'
		});
		// The row it reverses keeps every amount it had: a ledger row's monetary columns are append-only,
		// so the status is the only thing a reversal may move (MK-15).
		expect(fixture.ledger()[0]).toMatchObject({
			id: 'sale-1',
			netAmount: '98.800000',
			commissionAmount: '14.250000',
			status: SellerTransactionStatus.PENDING
		});
		expect(fixture.events()).toEqual(['seller.transaction.reversed']);
	});

	it('takes the reversal’s basis back out of its own net, so the row still satisfies the identity', async () => {
		const fixture = splitFixture({ transactions: [saleRow()] });

		const reversal = await fixture.service.reverse({
			transactionId: 'sale-1',
			kind: SellerTransactionKind.REFUND,
			quantity: '1'
		});

		// The column is derived from the row itself — `net − tax − discount` — rather than copied from the
		// original, which is what keeps the reversal's own identity exact without a second basis figure.
		expect(reversal.commissionBasisAmount).toBe('-85.750000');
		const expected = Money.fromStorage(reversal.grossAmount, EUR, DECIMALS)
			.add(Money.fromStorage(reversal.taxAmount, EUR, DECIMALS))
			.add(Money.fromStorage(reversal.sellerDiscountAmount, EUR, DECIMALS))
			.subtract(Money.fromStorage(reversal.commissionAmount, EUR, DECIMALS));

		expect(expected.equals(Money.fromStorage(reversal.netAmount, EUR, DECIMALS))).toBe(true);
		// And it names the row it reverses and the money movement it belongs to, so a doubled refund
		// handler is a constraint violation rather than a double debit (§5.6, MK-16).
		expect(reversal.reversesTransactionId).toBe('sale-1');
	});

	it('leaves the original row untouched by a partial reversal, whatever the reversal does', async () => {
		const fixture = splitFixture({ transactions: [saleRow()] });

		await fixture.service.reverse({ transactionId: 'sale-1', kind: SellerTransactionKind.REFUND, quantity: '1' });

		expect(fixture.ledger().find((row) => row.id === 'sale-1')).toMatchObject({
			status: SellerTransactionStatus.PENDING,
			grossAmount: '100.000000',
			commissionAmount: '14.250000',
			netAmount: '98.800000'
		});
	});

	// The defect: the completing reversal stores the *remaining* net and the platform's share with the
	// signs the calculation produced rather than the signs a reversal row needs, so its own row identity
	// (MK-7) cannot hold and `assertRowIdentity` refuses it before it is ever written — no completing
	// reversal can be recorded at all, which is exactly the path a return, a claim refund and a
	// cancellation after capture all take (§5.6). Doc 20 §4.4 S9 states the completing row as
	// `net −24.70`, `commission −3.57`, derived so that "the seller is made exactly whole" and "the
	// platform is made exactly whole": after three per-unit reversals of `−24.70` each,
	// `98.80 − 3 × 24.70 = 24.70` is what remains to be reversed, and a reversal of it is negative.
	// (`seller-split.service.ts`, the `net = originalNet.add(reversedNet)` / `commission =
	// refund.subtract(net.abs())` pair in the `completes` branch of `reverse`.)
	it('[DEFECT] writes the completing reversal so that both parties are made exactly whole', async () => {
		const partial = (id: string) =>
			saleRow({
				id,
				kind: SellerTransactionKind.REFUND,
				reversesTransactionId: 'sale-1',
				refundId: id,
				grossAmount: '-25.000000',
				taxAmount: '-4.510000',
				sellerDiscountAmount: '1.250000',
				commissionAmount: '-3.560000',
				netAmount: '-24.700000'
			});
		const fixture = splitFixture({ transactions: [saleRow(), partial('r1'), partial('r2'), partial('r3')] });

		const completing = await fixture.service.reverse({
			transactionId: 'sale-1',
			kind: SellerTransactionKind.REFUND,
			refundId: 'refund-4',
			refundAmount: '28.27',
			quantity: '1',
			completes: true
		});

		const reversals = fixture.ledger().filter((row) => row.reversesTransactionId === 'sale-1');

		// The seller is made exactly whole: the four reversals give back the whole net of 98.80.
		expect(Money.fromStorage(sumOf(reversals, 'netAmount'), EUR, DECIMALS).toStorageString()).toBe('-98.800000');
		// The platform is made exactly whole too: its commission is fully reversed, to the minor unit.
		expect(Money.fromStorage(sumOf(reversals, 'commissionAmount'), EUR, DECIMALS).toStorageString()).toBe('-14.250000');
		// The buyer is made whole by the refund the completing row states, and the original is closed
		// without any of its amounts being rewritten.
		expect(completing.netAmount).toBe('-24.700000');
		expect(completing.commissionAmount).toBe('-3.570000');
		expect(fixture.ledger().find((row) => row.id === 'sale-1')).toMatchObject({
			status: SellerTransactionStatus.REVERSED,
			netAmount: '98.800000',
			commissionAmount: '14.250000'
		});
	});
});
