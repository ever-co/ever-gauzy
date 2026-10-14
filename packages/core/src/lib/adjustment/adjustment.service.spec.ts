jest.mock('../core/crud/crud.service', () => {
	// The rules asserted here are the ledger's own, and the real base class reaches the entity barrel
	// and with it the whole application graph. A unit test pays for the narrowest surface the module
	// under test touches, so the base class is replaced by the one thing a subclass inherits from it:
	// a constructor.
	class CrudService {}

	return { CrudService };
});

import { AdjustmentOwnerType, AdjustmentType, IAdjustmentCreateInput } from '@gauzy/contracts';
import { Money } from '../money/money';
import { RequestContext } from '../core/context/request-context';
import { AdjustmentService } from './adjustment.service';
import { TypeOrmAdjustmentReasonRepository } from './repository/type-orm-adjustment-reason.repository';
import { TypeOrmAdjustmentRepository } from './repository/type-orm-adjustment.repository';

/**
 * The money-adjustment ledger.
 *
 * Every reduction or addition to an amount payable is one row here, whatever produced it, so the
 * rules the service owns are the rules the platform's money depends on: the amount is an exact
 * decimal and never zero, its sign agrees with what produced it, a manual movement cites a governed
 * reason a customer can be shown, and the sum of one owner's rows reconciles with that owner's
 * discount total *exactly* — which is what makes an allocated discount and the ledger that records
 * it agree to the last minor unit.
 *
 * The ledger is exercised against an in-memory table that behaves like the table it stands in for:
 * it stamps the columns the database generates, applies the `where` and the `order` the service asks
 * for, and returns what was saved. No database, no network, no clock.
 */

type Row = Record<string, any>;

/**
 * An in-memory stand-in for one table.
 *
 * `find` filters on the criteria it is given and sorts on the ordering it is given, so a service
 * that stopped narrowing or ordering a read is caught here rather than accommodated.
 */
class Table {
	readonly rows: Row[] = [];
	private sequence = 0;

	/** Stands in for `repository.create`: the database's generated columns are filled in here. */
	create(input: Row): Row {
		this.sequence += 1;

		return {
			id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
			createdAt: new Date(Date.UTC(2026, 2, 1, 10, 0, this.sequence)),
			...input
		};
	}

	async save(row: Row): Promise<Row> {
		if (!this.rows.includes(row)) {
			this.rows.push(row);
		}

		return row;
	}

	async find(options: { where?: Row; order?: Row } = {}): Promise<Row[]> {
		return this.matching(options.where).sort(byOrder(options.order));
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.matching(options.where)[0] ?? null;
	}

	private matching(where: Row = {}): Row[] {
		return this.rows.filter((row) =>
			Object.entries(where).every(([column, condition]) => matches(row[column], condition))
		);
	}
}

/** One column's condition, including the membership operator the service builds with `In`. */
function matches(value: unknown, condition: unknown): boolean {
	const operator = condition as { _type?: string; _value?: unknown[] };

	if (operator && typeof operator === 'object' && operator._type === 'in' && Array.isArray(operator._value)) {
		return operator._value.includes(value);
	}

	// A missing column and a null column are the same thing to the database.
	return (value ?? null) === (condition ?? null);
}

/** The comparator `find` sorts with, so `createdAt ASC, id ASC` means what it says. */
function byOrder(order: Row = {}): (left: Row, right: Row) => number {
	const columns = Object.keys(order);

	return (left, right) => {
		for (const column of columns) {
			if (left[column] === right[column]) {
				continue;
			}

			const direction = order[column] === 'DESC' ? -1 : 1;

			return (left[column] > right[column] ? 1 : -1) * direction;
		}

		return 0;
	};
}

const CART_LINE = AdjustmentOwnerType.CART_LINE;
const CART = AdjustmentOwnerType.CART;
const LINE = '6b1e0f2a-0000-4000-8000-000000000001';

/** A reason row, with the fields `resolveReason` reads. */
const reason = (overrides: Row = {}): Row => ({
	code: 'GOODWILL',
	label: 'Goodwill',
	appliesTo: AdjustmentType.MANUAL,
	requiresApproval: false,
	isActive: true,
	...overrides
});

/** The input of an adjustment that passes every rule, so a case can vary exactly one thing. */
const input = (overrides: Partial<IAdjustmentCreateInput> = {}): IAdjustmentCreateInput => ({
	ownerType: CART_LINE,
	ownerId: LINE,
	amount: '-10.00',
	currency: 'USD',
	type: AdjustmentType.PROMOTION,
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

/** The service under test, with the tables it writes to. */
function ledger(reasons: Row[] = []) {
	const adjustments = new Table();
	const reasonTable = new Table();

	for (const row of reasons) {
		reasonTable.rows.push(reasonTable.create(row));
	}

	const service = new AdjustmentService(
		adjustments as unknown as TypeOrmAdjustmentRepository,
		{} as never,
		reasonTable as unknown as TypeOrmAdjustmentReasonRepository,
		{} as never
	);

	return { service, adjustments, reasonTable };
}

afterEach(() => {
	// A case that stands a request context up has to take it down again.
	jest.restoreAllMocks();
});

describe('appending to the adjustment ledger', () => {
	it('stores the sign as given, the exact amount and the currency it is expressed in', async () => {
		const { service, adjustments } = ledger();

		const row = await service.append(input({ amount: '-19.999999', currency: 'usd' }));

		expect(row.amount).toBe('-19.999999');
		expect(row.currency).toBe('USD');
		expect(row.type).toBe(AdjustmentType.PROMOTION);
		expect(row.isTaxInclusive).toBe(false);
		expect(adjustments.rows).toHaveLength(1);
	});

	it('refuses a zero adjustment, because a zero row is noise every later sum has to carry', async () => {
		const { service, adjustments } = ledger();

		expect(await refusalOf(() => service.append(input({ amount: '0.00' })))).toMatch(
			/^ADJUSTMENT_AMOUNT_ZERO/
		);
		expect(await refusalOf(() => service.append(input({ amount: '-0' })))).toMatch(/^ADJUSTMENT_AMOUNT_ZERO/);
		expect(adjustments.rows).toHaveLength(0);
	});

	it('refuses a discount stored as an increase, and a surcharge stored as a reduction', async () => {
		const { service, adjustments } = ledger();

		expect(await refusalOf(() => service.append(input({ amount: '5.00' })))).toMatch(
			/^ADJUSTMENT_SIGN_MISMATCH/
		);
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.SHIPPING_DISCOUNT, amount: '5.00' }))
			)
		).toMatch(/^ADJUSTMENT_SIGN_MISMATCH/);
		expect(
			await refusalOf(() => service.append(input({ type: AdjustmentType.FEE, amount: '-5.00' })))
		).toMatch(/^ADJUSTMENT_SIGN_MISMATCH/);

		// Control: the type, not the amount, decides the sign. A ledger that stored whatever sign it
		// was handed would have kept the +5.00 promotion and quietly raised the amount payable.
		await service.append(input({ amount: '-5.00' }));
		expect(adjustments.rows.map((row) => row.amount)).toEqual(['-5']);
	});

	it('accepts either sign for the types whose sign the type does not fix', async () => {
		const { service, adjustments } = ledger([
			{ code: 'PRICE_MATCH', label: 'Price match', appliesTo: AdjustmentType.MANUAL }
		]);

		await service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00', description: 'Goodwill', reasonCode: 'price_match' }));
		await service.append(input({ type: AdjustmentType.MANUAL, amount: '15.00', description: 'Correction', reasonCode: 'PRICE_MATCH' }));
		await service.append(input({ type: AdjustmentType.GIFT_CARD, amount: '-25.00' }));
		await service.append(input({ type: AdjustmentType.ROUNDING, amount: '0.01' }));
		await service.append(input({ type: AdjustmentType.FEE, amount: '9.99', description: 'Handling', reasonCode: 'PRICE_MATCH' }));

		// Every amount is stored in its canonical form, so two rows that represent the same movement
		// are the same text however the caller spelled them.
		expect(adjustments.rows.map((row) => row.amount)).toEqual(['-15', '15', '-25', '0.01', '9.99']);
	});

	it('requires a description and a governed reason when a person moved the money', async () => {
		const { service } = ledger([reason()]);

		expect(
			await refusalOf(() => service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00' })))
		).toMatch(/^ADJUSTMENT_DESCRIPTION_REQUIRED/);
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00', description: 'ok' }))
			)
		).toMatch(/^ADJUSTMENT_DESCRIPTION_REQUIRED/);
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00', description: 'Goodwill credit' }))
			)
		).toMatch(/^ADJUSTMENT_REASON_REQUIRED/);
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.FEE, amount: '15.00', description: 'Handling fee' }))
			)
		).toMatch(/^ADJUSTMENT_REASON_REQUIRED/);

		// A promotion is produced by a rule, so it carries neither.
		await service.append(input());
	});

	it('resolves the reason code case-insensitively and records the approval it demands', async () => {
		const { service } = ledger([reason({ requiresApproval: true })]);

		const row = await service.append(
			input({ type: AdjustmentType.MANUAL, amount: '-50.00', description: 'Goodwill', reasonCode: ' goodwill ' })
		);

		expect(row.reasonCode).toBe('GOODWILL');
		expect(row.metadata).toEqual({ requiresApproval: true });
	});

	it('keeps a producer trace that the reason does not demand', async () => {
		const { service } = ledger([reason()]);

		const row = await service.append(
			input({ metadata: { promotionId: 'p-1', allocationMethod: 'LARGEST_REMAINDER' } })
		);

		expect(row.metadata).toEqual({ promotionId: 'p-1', allocationMethod: 'LARGEST_REMAINDER' });
	});

	it('refuses a reason that is unknown, deactivated, or about another kind of movement', async () => {
		const { service } = ledger([
			reason(),
			reason({ code: 'RETIRED', isActive: false }),
			reason({ code: 'SPRING10', appliesTo: AdjustmentType.PROMOTION })
		]);

		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00', description: 'Goodwill', reasonCode: 'NOPE' }))
			)
		).toMatch(/^ADJUSTMENT_REASON_UNKNOWN/);
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.MANUAL, amount: '-15.00', description: 'Goodwill', reasonCode: 'RETIRED' }))
			)
		).toMatch(/^ADJUSTMENT_REASON_INACTIVE/);

		// A reason that applies to every manual movement may be cited by a fee; one that belongs to
		// promotions may not.
		await expect(
			service.append(input({ type: AdjustmentType.FEE, amount: '15.00', description: 'Handling', reasonCode: 'GOODWILL' }))
		).resolves.toBeDefined();
		expect(
			await refusalOf(() =>
				service.append(input({ type: AdjustmentType.FEE, amount: '15.00', description: 'Handling', reasonCode: 'SPRING10' }))
			)
		).toMatch(/^ADJUSTMENT_REASON_NOT_APPLICABLE/);
	});

	it('refuses an adjustment that names no owner and one that names no type', async () => {
		const { service } = ledger();

		expect(await refusalOf(() => service.append(input({ ownerId: '' })))).toMatch(/^ADJUSTMENT_OWNER_REQUIRED/);
		expect(await refusalOf(() => service.append(input({ type: undefined })))).toMatch(/^ADJUSTMENT_TYPE_REQUIRED/);
	});

	it('reports an amount that is not an exact decimal with the money layer’s own code', async () => {
		const { service } = ledger();

		expect(await refusalOf(() => service.append(input({ amount: '1e-7' })))).toMatch(
			/^MONEY_NOT_DECIMAL_STRING/
		);
		expect(await refusalOf(() => service.append(input({ amount: '-0.0050001' })))).toBeUndefined();
	});
});

describe('reading a ledger', () => {
	it('reads one owner’s adjustments oldest first, which is the order they apply in', async () => {
		const { service } = ledger();
		const later = input({ ownerId: LINE, amount: '-3.00', createdAt: new Date('2026-03-01T12:00:00Z') });
		const earlier = input({ ownerId: LINE, amount: '-1.00', createdAt: new Date('2026-03-01T10:00:00Z') });
		const middle = input({ ownerId: LINE, amount: '-2.00', createdAt: new Date('2026-03-01T11:00:00Z') });

		await service.append(later);
		await service.append(earlier);
		await service.append(middle);

		// The rows were written out of order, so a read with no ordering would return them in that
		// order and a later adjustment would be applied before an earlier one.
		expect((await service.findByOwner(CART_LINE, LINE)).map((row) => row.amount)).toEqual(['-1', '-2', '-3']);
	});

	it('keeps the ledgers of two owners and two owner types apart', async () => {
		const { service } = ledger();
		const other = '6b1e0f2a-0000-4000-8000-000000000002';

		await service.append(input({ ownerId: LINE, amount: '-1.00' }));
		await service.append(input({ ownerId: other, amount: '-2.00' }));
		await service.append(input({ ownerType: CART, ownerId: LINE, amount: '-3.00' }));

		expect((await service.findByOwner(CART_LINE, LINE)).map((row) => row.amount)).toEqual(['-1']);
		expect((await service.findByOwner(CART_LINE, other)).map((row) => row.amount)).toEqual(['-2']);
		expect((await service.findByOwner(CART, LINE)).map((row) => row.amount)).toEqual(['-3']);
	});

	it('records a stamp of the request the row was written under, and does not narrow an unscoped read', async () => {
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');
		const { service } = ledger();

		const row = await service.append(input({ amount: '-1.00' }));
		expect(row.tenantId).toBe('tenant-1');
		expect(row.organizationId).toBe('org-1');

		// A read under one tenant sees that tenant's ledger only…
		expect(await service.findByOwner(CART_LINE, LINE)).toHaveLength(1);

		tenant.mockReturnValue('tenant-2');
		await service.append(input({ amount: '-2.00' }));
		expect((await service.findByOwner(CART_LINE, LINE)).map((found) => found.amount)).toEqual(['-2']);

		// …while a caller with no context is not silently restricted to rows belonging to nobody.
		tenant.mockReturnValue(null);
		organization.mockReturnValue(null);

		const unscoped = await service.append(input({ amount: '-3.00' }));

		expect('tenantId' in unscoped).toBe(false);
		expect((await service.findByOwner(CART_LINE, LINE)).map((found) => found.amount)).toEqual([
			'-1',
			'-2',
			'-3'
		]);
	});

	it('sums the rows of one owner exactly, so an allocated discount reconciles to the unit', async () => {
		const { service } = ledger();
		const discount = Money.of('-10.00', 'USD');

		// An order-level discount of 10.00 allocated across three lines — the allocation the invoice
		// presents and the ledger has to agree with.
		for (const part of discount.allocate(['19.99', '29.99', '49.99'])) {
			await service.append(input({ amount: part.amount, code: 'SPRING10' }));
		}

		const total = await service.totalForOwner(CART_LINE, LINE, 'USD');

		expect(total.count).toBe(3);
		expect(total.currency).toBe('USD');
		expect(total.total).toBe('-10.000000');
		expect(
			Money.sum(
				(await service.findByOwner(CART_LINE, LINE)).map((row) => Money.fromStorage(row.amount, row.currency)),
				'USD'
			).toStorageString()
		).toBe('-10.000000');
	});

	it('refuses to sum a ledger whose rows disagree on currency', async () => {
		const { service } = ledger();

		await service.append(input({ amount: '-1.00' }));
		await service.append(input({ amount: '-2.00', currency: 'EUR' }));

		expect(await refusalOf(() => service.totalForOwner(CART_LINE, LINE, 'USD'))).toMatch(/^CURRENCY_MISMATCH/);
	});

	it('reports zero for an owner that carries no adjustments', async () => {
		const { service } = ledger();

		expect(await service.totalForOwner(CART_LINE, LINE, 'USD')).toEqual({
			ownerType: CART_LINE,
			ownerId: LINE,
			currency: 'USD',
			total: '0.000000',
			count: 0
		});
	});

	it('reports an adjustment that exceeds what is payable as an exact excess rather than clamping it', async () => {
		const { service } = ledger();

		await service.append(input({ amount: '-60.00' }));
		await service.append(input({ amount: '-55.00' }));

		const payable = Money.of('100.00', 'USD');
		const applied = (await service.findByOwner(CART_LINE, LINE)).reduce(
			(total, row) => total.add(Money.fromStorage(row.amount, row.currency)),
			payable
		);

		// The excess has to survive the ledger: it is what the caller writes to a credit line instead
		// of dropping, and only the caller knows whether the movement was authorised.
		expect(applied.amount).toBe('-15');
		expect(applied.abs().toStorageString()).toBe('15.000000');

		// Control: a ledger that clamped the running total at zero would report nothing owed and
		// lose the 15.00.
		expect(Math.max(0, Number(applied.amount))).toBe(0);
	});
});

describe('the governed reason table', () => {
	it('creates a reason once and never overwrites the label an administrator edited', async () => {
		const { service, reasonTable } = ledger([{ code: 'GOODWILL', label: 'Edited by an administrator' }]);

		const existing = await service.ensureReason({ code: 'goodwill', label: 'Goodwill' });

		// Control: a seed run that created unconditionally would produce a second row and restart the
		// vocabulary the ledger's history refers to.
		expect(existing.label).toBe('Edited by an administrator');
		expect(reasonTable.rows).toHaveLength(1);

		const created = await service.ensureReason({ code: 'price_match', label: 'Price match', sortOrder: 5 });
		expect(created.code).toBe('PRICE_MATCH');
		expect(created.appliesTo).toBe(AdjustmentType.MANUAL);
		expect(created.isSystem).toBe(true);
		expect(created.sortOrder).toBe(5);
		expect(reasonTable.rows).toHaveLength(2);
	});

	it('lists the reasons of a type in display order, with the ones that apply to any type', async () => {
		const { service } = ledger([
			{ code: 'SECOND', label: 'Second', appliesTo: AdjustmentType.MANUAL, sortOrder: 2 },
			{ code: 'FIRST', label: 'First', appliesTo: AdjustmentType.MANUAL, sortOrder: 1 },
			{ code: 'FEE_ONLY', label: 'Fee only', appliesTo: AdjustmentType.FEE, sortOrder: 3 },
			{ code: 'PROMO', label: 'Promotion', appliesTo: AdjustmentType.PROMOTION, sortOrder: 4 }
		]);

		expect((await service.listReasons()).map((row) => row.code)).toEqual([
			'FIRST',
			'SECOND',
			'FEE_ONLY',
			'PROMO'
		]);
		expect((await service.listReasons(AdjustmentType.FEE)).map((row) => row.code)).toEqual([
			'FIRST',
			'SECOND',
			'FEE_ONLY'
		]);
		expect(await refusalOf(() => service.ensureReason({ code: '  ', label: 'Blank' }))).toMatch(
			/^ADJUSTMENT_REASON_REQUIRED/
		);
	});
});
