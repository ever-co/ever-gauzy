/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a collection service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the service under test is
 * the real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted. The money kernel is pulled through the seam with `requireActual`, so every amount
 * below is computed by the platform's own arithmetic rather than by a second implementation of it.
 *
 * The base-class double mirrors the platform's `CrudService` where the behaviour is observable to a
 * caller, and that is both halves of the read pair: `findOneByWhereOptions` is documented as answering
 * `null` for an absent row but raises `NotFoundException` instead, on both the TypeORM and the MikroORM
 * branch (`crud.service.ts`, `findOneByWhereOptions`), while `findOneOrFailByWhereOptions` is the half
 * a caller uses when absence is an ordinary answer, reporting the miss as an `ITryRequest` carrying
 * `success: false`.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			// Faithful to the platform: an absent row is a refusal, not a null.
			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneOrFailByWhereOptions(where: any): Promise<any> {
			// Faithful to the platform: the same read, reporting the miss as a value rather than raising.
			const record = await this.typeOrmRepository.findOneBy(where);

			return record ? { success: true, record } : { success: false };
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
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

import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PaymentCollectionStatus } from '../payment.types';
import { PaymentCollectionService } from './payment-collection.service';

/**
 * The money side of one order or cart.
 *
 * **The amounts are the authority and the status is a function of them** (doc 10 §8.2, §8.7). Nothing
 * in this service accepts a status from a caller: `deriveStatus` reads the four amounts and writes the
 * lifecycle state, and every method that moves an amount moves it through the invariant the whole
 * domain rests on:
 *
 * ```
 * capturedAmount + canceledAmount <= authorizedAmount <= amount
 * refundedAmount <= capturedAmount
 * ```
 *
 * The suite pins that invariant from four sides:
 *
 * - **the ceilings are exact and inclusive.** An authorisation that reaches the collection amount is
 *   accepted and one cent past it is refused with `PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED`; a capture that
 *   reaches what is left is accepted and one cent past it is refused with `PAYMENT_OVER_CAPTURE`; a
 *   refund that reaches what was captured is accepted and one cent past it is refused with
 *   `REFUND_AMOUNT_EXCEEDS_CAPTURED` (doc 10 §8.3, §9.2 rules 4–5). Nothing is clamped: a clamp would
 *   take money nobody asked for and leave the ledger explaining a different amount than the request;
 * - **the status is derived, never stated.** A body that carries one is stripped, and each of the
 *   eight lifecycle values is reached from an amount combination rather than from a write;
 * - **the amounts are exact decimals.** Three captures of `33.33` against a `100.00` collection total
 *   `99.99` and leave exactly `0.01`, and `0.1 + 0.2` is `0.3` — the arithmetic is the kernel's, so no
 *   binary floating point ever reaches a column (doc 07 §1.1–§1.2);
 * - **a collection that has moved is no longer writable in its amount or its currency**, because the
 *   sessions were created for that figure and rewriting it would make every capture already taken look
 *   like an over-capture.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states and applies an update to the stored row, so "nothing was written by
 * the refusal" is asserted against state rather than against a mock's call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const CART = '00000000-0000-4000-8000-000000000020';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	payment_collection: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'in') {
					return (expected.value as unknown[]).some((one) => String(row[field] ?? '') === String(one));
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	return {
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/**
 * One `payment_collection` row, as the service reads it.
 *
 * @param id The row identifier.
 * @param overrides The amounts and flags the case is about.
 */
const collectionRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	amount: '100',
	currency: 'USD',
	status: PaymentCollectionStatus.NOT_PAID,
	authorizedAmount: '0',
	capturedAmount: '0',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/**
 * Builds the collection service over one in-memory `payment_collection` table.
 *
 * @param rows The collections the fixture starts with.
 */
function collectionFixture(rows: Row[] = []) {
	const tables: ITables = { payment_collection: [...rows] };
	const service = new PaymentCollectionService(repository(tables, 'payment_collection') as never, {} as never);

	return {
		service,
		tables,
		store: (id: string) => tables.payment_collection.find((row) => row.id === id)
	};
}

describe('PaymentCollectionService — creation and the canonical amount (doc 10 §8.2, doc 07 §1.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the collection for an order in NOT_PAID with the four amounts at zero', async () => {
		const fixture = collectionFixture();

		const created = await fixture.service.createCollection({
			orderId: ORDER,
			amount: '100',
			currency: 'USD'
		} as never);

		expect(created).toMatchObject({
			orderId: ORDER,
			amount: '100',
			currency: 'USD',
			status: PaymentCollectionStatus.NOT_PAID,
			authorizedAmount: '0',
			capturedAmount: '0',
			refundedAmount: '0',
			canceledAmount: '0',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.tables.payment_collection).toHaveLength(1);
	});

	it('stores the amount in the platform’s canonical form', async () => {
		// `100.00` and `100` are one amount, and two spellings of one amount must not become two rows a
		// comparison or a reconciliation can disagree about (doc 07 §1.1: the canonical form has no
		// redundant trailing fractional zeroes).
		const fixture = collectionFixture();

		const created = await fixture.service.createCollection({
			orderId: ORDER,
			amount: '100.00',
			currency: 'USD'
		} as never);

		expect(created).toMatchObject({ amount: '100', currency: 'USD' });
	});

	// The rule: the amount and the currency are canonicalised together, because they are one figure. The
	// money kernel reads a code into its upper-case form (`money.ts`, `normalizeCurrency`) and the stored
	// amount carries no redundant trailing fractional zeroes, so a collection stating `usd` is stored as
	// `USD` — which is the form `PaymentSessionService.openSession` compares a session's currency
	// against, and the form a report grouped by `currency` expects to find one currency under.
	it('stores the currency in the platform’s canonical form', async () => {
		const fixture = collectionFixture();

		const created = await fixture.service.createCollection({
			orderId: ORDER,
			amount: '100',
			currency: 'usd'
		} as never);

		expect(created).toMatchObject({ amount: '100', currency: 'USD' });
	});

	it('refuses a collection that names neither an order nor a cart', async () => {
		const fixture = collectionFixture();

		await expect(
			fixture.service.createCollection({ amount: '100', currency: 'USD' } as never)
		).rejects.toThrow(/PAYMENT_COLLECTION_TARGET_REQUIRED/);
		expect(fixture.tables.payment_collection).toEqual([]);
	});

	it('refuses a zero amount, a negative amount and an amount that is not an exact decimal', async () => {
		const fixture = collectionFixture();

		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: '0', currency: 'USD' } as never)
		).rejects.toThrow(/PAYMENT_COLLECTION_AMOUNT_INVALID/);
		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: '-1', currency: 'USD' } as never)
		).rejects.toThrow(/PAYMENT_COLLECTION_AMOUNT_INVALID/);
		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: 'ten', currency: 'USD' } as never)
		).rejects.toThrow(/PAYMENT_AMOUNT_INVALID/);
		// A float that is not exactly representable is refused rather than silently rounded: the error
		// of `0.1 + 0.2` becomes a wrong cent the moment it is stored (doc 07 §1.2).
		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: 0.1 + 0.2, currency: 'USD' } as never)
		).rejects.toThrow(/PAYMENT_AMOUNT_INVALID/);
		expect(fixture.tables.payment_collection).toEqual([]);
	});

	it('refuses a currency that is not a three-letter code', async () => {
		const fixture = collectionFixture();

		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: '100', currency: 'US' } as never)
		).rejects.toThrow(/PAYMENT_CURRENCY_INVALID/);
		await expect(
			fixture.service.createCollection({ orderId: ORDER, amount: '100', currency: 'DOLLARS' } as never)
		).rejects.toThrow(/PAYMENT_CURRENCY_INVALID/);
		await expect(fixture.service.createCollection({ orderId: ORDER, amount: '100' } as never)).rejects.toThrow(
			/PAYMENT_CURRENCY_INVALID/
		);
		expect(fixture.tables.payment_collection).toEqual([]);
	});

	it('refuses a second collection for a cart that already has one', async () => {
		// A cart has at most one live collection, which is what makes "how much is outstanding for this
		// cart?" a question with one answer (doc 10 §8.2, `IDX_payment_collection_cart`).
		const fixture = collectionFixture([collectionRow('existing', { orderId: undefined, cartId: CART })]);

		await expect(
			fixture.service.createCollection({ cartId: CART, amount: '100', currency: 'USD' } as never)
		).rejects.toThrow(/already has a payment collection/);
		expect(fixture.tables.payment_collection).toHaveLength(1);
	});

	// The rule: the cart guard reads through `findCollectionForCart`, whose documented answer for a cart
	// that has no collection is `null`, so the guard fires only when a collection is actually there. The
	// same read backs `findCollectionForOrder`, whose contract is the same "or null" — which is what
	// makes "how much is outstanding for this cart?" a question that can be asked before the first
	// collection exists.
	it('creates the first collection of a cart that has none', async () => {
		const fixture = collectionFixture();

		const created = await fixture.service.createCollection({
			cartId: CART,
			amount: '100',
			currency: 'USD'
		} as never);

		expect(created).toMatchObject({ cartId: CART, amount: '100', status: PaymentCollectionStatus.NOT_PAID });
		await expect(fixture.service.findCollectionForCart(CART)).resolves.toMatchObject({ id: created.id });
		await expect(fixture.service.findCollectionForCart('a-cart-with-nothing')).resolves.toBeNull();
		await expect(fixture.service.findCollectionForOrder('an-order-with-nothing')).resolves.toBeNull();
	});
});

describe('PaymentCollectionService — the status is derived, never stated (doc 10 §8.2, §8.7)', () => {
	/**
	 * One row of the derivation: the four amounts, the status the caller last saw, and the state that
	 * combination means. The table is doc 10 §8.7 read against the members of the lifecycle the
	 * platform's own `PaymentCollectionStatus` declares.
	 */
	const derivations: Array<{
		trigger: string;
		amounts: Row;
		status: PaymentCollectionStatus;
	}> = [
		{
			trigger: 'nothing has been attempted',
			amounts: {},
			status: PaymentCollectionStatus.NOT_PAID
		},
		{
			trigger: 'an attempt is with the provider',
			amounts: { status: PaymentCollectionStatus.AWAITING },
			status: PaymentCollectionStatus.AWAITING
		},
		{
			trigger: 'the last attempt failed and nothing moved',
			amounts: { status: PaymentCollectionStatus.FAILED },
			status: PaymentCollectionStatus.FAILED
		},
		{
			trigger: 'the whole amount is authorised',
			amounts: { authorizedAmount: '100' },
			status: PaymentCollectionStatus.AUTHORIZED
		},
		{
			trigger: 'less than the whole amount is authorised',
			amounts: { authorizedAmount: '99.99' },
			status: PaymentCollectionStatus.PARTIALLY_AUTHORIZED
		},
		{
			trigger: 'something is captured and something is outstanding',
			amounts: { authorizedAmount: '100', capturedAmount: '99.99' },
			status: PaymentCollectionStatus.PARTIALLY_CAPTURED
		},
		{
			trigger: 'the whole amount is captured',
			amounts: { authorizedAmount: '100', capturedAmount: '100' },
			status: PaymentCollectionStatus.COMPLETED
		},
		{
			trigger: 'the outstanding remainder was captured after a release',
			amounts: { authorizedAmount: '100', capturedAmount: '60', canceledAmount: '40' },
			status: PaymentCollectionStatus.COMPLETED
		},
		{
			trigger: 'the whole authorisation was released before anything was taken',
			amounts: { authorizedAmount: '100', canceledAmount: '100' },
			status: PaymentCollectionStatus.CANCELED
		}
	];

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(derivations)('derives $status when $trigger', ({ amounts, status }) => {
		const fixture = collectionFixture();

		expect(fixture.service.deriveStatus(collectionRow('c1', amounts) as never)).toBe(status);
	});

	it('re-derives the status from the amounts it was given, not from the status on the row', () => {
		// Control for the two rows that keep the stored status: a row that says AWAITING while the whole
		// amount is authorised is AUTHORIZED, because the amounts are the authority.
		const fixture = collectionFixture();

		expect(
			fixture.service.deriveStatus(
				collectionRow('c1', { status: PaymentCollectionStatus.AWAITING, authorizedAmount: '100' }) as never
			)
		).toBe(PaymentCollectionStatus.AUTHORIZED);
	});
});

describe('PaymentCollectionService — the amounts move one at a time (doc 10 §8.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records an authorisation, moves only the authorised amount and derives the status', async () => {
		const fixture = collectionFixture([collectionRow('c1')]);

		const after = await fixture.service.recordAuthorization('c1', '40');

		expect(after).toMatchObject({
			authorizedAmount: '40',
			capturedAmount: '0',
			refundedAmount: '0',
			canceledAmount: '0',
			status: PaymentCollectionStatus.PARTIALLY_AUTHORIZED
		});
	});

	it('authorises the collection as a whole, in as many attempts as the split needs', async () => {
		// Doc 10 §8.4: several providers may each authorise a share, and what is checked is the sum.
		const fixture = collectionFixture([collectionRow('c1')]);

		await fixture.service.recordAuthorization('c1', '30');
		await fixture.service.recordAuthorization('c1', '70');

		expect(fixture.store('c1')).toMatchObject({
			authorizedAmount: '100',
			status: PaymentCollectionStatus.AUTHORIZED
		});

		await expect(fixture.service.recordAuthorization('c1', '0.01')).rejects.toThrow(
			/PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED/
		);
		expect(fixture.store('c1').authorizedAmount).toBe('100');
	});

	it('records a capture, and the completion instant is stamped once', async () => {
		// The instant the collection completed is evidence, so a later movement that leaves the collection
		// completed does not move it.
		const fixture = collectionFixture([collectionRow('c1', { authorizedAmount: '100' })]);

		await fixture.service.recordCapture('c1', '50');

		expect(fixture.store('c1')).toMatchObject({
			capturedAmount: '50',
			status: PaymentCollectionStatus.PARTIALLY_CAPTURED
		});
		expect(fixture.store('c1').completedAt).toBeUndefined();

		await fixture.service.recordCapture('c1', '50');

		const completedAt = fixture.store('c1').completedAt;

		expect(fixture.store('c1')).toMatchObject({
			capturedAmount: '100',
			status: PaymentCollectionStatus.COMPLETED
		});
		expect(completedAt).toBeInstanceOf(Date);

		await fixture.service.recordRefund('c1', '1');

		expect(fixture.store('c1')).toMatchObject({ status: PaymentCollectionStatus.COMPLETED });
		expect(fixture.store('c1').completedAt).toBe(completedAt);
	});

	it('records a refund against what was captured and refuses one that would pass it', async () => {
		const fixture = collectionFixture([
			collectionRow('c1', { authorizedAmount: '100', capturedAmount: '50' })
		]);

		await fixture.service.recordRefund('c1', '50');

		expect(fixture.store('c1')).toMatchObject({ refundedAmount: '50' });

		await expect(fixture.service.recordRefund('c1', '0.01')).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(fixture.store('c1').refundedAmount).toBe('50');
	});

	it('records the release of an authorisation and refuses a release past what is outstanding', async () => {
		// The released amount plus what was captured may not pass what was authorised: the rest of the
		// authorisation is still with the provider.
		const fixture = collectionFixture([
			collectionRow('c1', { authorizedAmount: '100', capturedAmount: '40' })
		]);

		await fixture.service.recordCancellation('c1', '60');

		expect(fixture.store('c1')).toMatchObject({ canceledAmount: '60' });
		await expect(fixture.service.recordCancellation('c1', '0.01')).rejects.toThrow(
			/PAYMENT_CANCEL_EXCEEDS_AUTHORIZED/
		);
		expect(fixture.store('c1').canceledAmount).toBe('60');
	});

	it('accepts a release of nothing, because cancelling an attempt that never reached the provider releases nothing', async () => {
		const fixture = collectionFixture([collectionRow('c1')]);

		const after = await fixture.service.recordCancellation('c1', '0');

		expect(after).toMatchObject({ canceledAmount: '0', status: PaymentCollectionStatus.NOT_PAID });
	});

	it('moves a collection to AWAITING or FAILED only while nothing has moved', async () => {
		const untouched = collectionFixture([collectionRow('c1')]);

		expect(await untouched.service.markAwaiting('c1')).toMatchObject({ status: PaymentCollectionStatus.AWAITING });
		expect(await untouched.service.markFailed('c1')).toMatchObject({ status: PaymentCollectionStatus.FAILED });

		// Once money has moved the status is the amounts' to state, so neither marker may rewrite it.
		const moved = collectionFixture([
			collectionRow('c1', { authorizedAmount: '100', status: PaymentCollectionStatus.AUTHORIZED })
		]);

		expect(await moved.service.markAwaiting('c1')).toMatchObject({
			status: PaymentCollectionStatus.AUTHORIZED
		});
		expect(await moved.service.markFailed('c1')).toMatchObject({
			status: PaymentCollectionStatus.AUTHORIZED
		});
	});
});

describe('PaymentCollectionService — the ceilings (doc 10 §8.3, §9.2, I-7)', () => {
	const AT_THE_CEILING = collectionRow('c1', { authorizedAmount: '40', capturedAmount: '20' });

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts an authorisation that reaches the collection amount and refuses one cent past it', () => {
		const fixture = collectionFixture();

		expect(() =>
			fixture.service.assertCanAuthorize(collectionRow('c1', { authorizedAmount: '40' }) as never, '60')
		).not.toThrow();
		expect(() => fixture.service.assertCanAuthorize(AT_THE_CEILING as never, '60.01')).toThrow(
			/PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED/
		);
	});

	it('accepts a capture that reaches the collection amount and refuses one cent past it', () => {
		const fixture = collectionFixture();

		expect(() =>
			fixture.service.assertCanCapture(collectionRow('c1', { capturedAmount: '40' }) as never, '60')
		).not.toThrow();
		expect(() => fixture.service.assertCanCapture(AT_THE_CEILING as never, '80.01')).toThrow(
			/PAYMENT_OVER_CAPTURE/
		);
	});

	it('accepts a refund that reaches what was captured and refuses one cent past it', () => {
		const fixture = collectionFixture();

		expect(() =>
			fixture.service.assertCanRefund(collectionRow('c1', { capturedAmount: '20' }) as never, '20')
		).not.toThrow();
		expect(() =>
			fixture.service.assertCanRefund(
				collectionRow('c1', { capturedAmount: '20', refundedAmount: '19.99' }) as never,
				'0.02'
			)
		).toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
	});

	it('leaves the collection exactly as it was when a ceiling is hit', async () => {
		// Nothing is clamped and nothing is written: the refused request must not leave a partial amount
		// behind for a reconciliation to explain.
		const fixture = collectionFixture([collectionRow('c1', { authorizedAmount: '100', capturedAmount: '100' })]);
		const before = { ...fixture.store('c1') };

		await expect(fixture.service.recordCapture('c1', '0.01')).rejects.toThrow(/PAYMENT_OVER_CAPTURE/);

		expect(fixture.store('c1')).toEqual(before);
	});

	it('keeps captured + canceled <= authorized <= amount and refunded <= captured over a sequence', async () => {
		// The whole domain rests on these two lines (doc 10 §8.2, I-7). The sequence is a split payment
		// that is partly captured, partly released and partly given back, and the invariant is asserted
		// after every move rather than only at the end.
		const fixture = collectionFixture([collectionRow('c1')]);
		const cents = (value: string) => Math.round(Number(value) * 100);
		const assertInvariant = () => {
			const row = fixture.store('c1');

			expect(cents(row.capturedAmount) + cents(row.canceledAmount)).toBeLessThanOrEqual(
				cents(row.authorizedAmount)
			);
			expect(cents(row.authorizedAmount)).toBeLessThanOrEqual(cents(row.amount));
			expect(cents(row.refundedAmount)).toBeLessThanOrEqual(cents(row.capturedAmount));
		};

		await fixture.service.recordAuthorization('c1', '40');
		assertInvariant();
		await fixture.service.recordAuthorization('c1', '60');
		assertInvariant();
		await fixture.service.recordCapture('c1', '70');
		assertInvariant();
		await fixture.service.recordRefund('c1', '20');
		assertInvariant();
		await fixture.service.recordCancellation('c1', '30');
		assertInvariant();

		// What is outstanding is the collection amount less what was released, so 70 captured against a
		// 30.00 release is the whole of what is still owed and the collection is complete.
		expect(fixture.store('c1')).toMatchObject({
			authorizedAmount: '100',
			capturedAmount: '70',
			refundedAmount: '20',
			canceledAmount: '30',
			status: PaymentCollectionStatus.COMPLETED
		});
	});

	it('adds exact decimals without binary floating point drift', async () => {
		// The classic defect this package must not have: `0.1 + 0.2` is `0.30000000000000004` in a double
		// and `0.3` through the money kernel, and the difference is a wrong cent the moment it is stored
		// (doc 07 §1.2).
		const fixture = collectionFixture([collectionRow('c1', { amount: '0.3' })]);

		await fixture.service.recordAuthorization('c1', '0.1');
		await fixture.service.recordAuthorization('c1', '0.2');

		expect(fixture.store('c1')).toMatchObject({
			authorizedAmount: '0.3',
			status: PaymentCollectionStatus.AUTHORIZED
		});
		expect(0.1 + 0.2).not.toBe(0.3);
		expect(fixture.store('c1').authorizedAmount).not.toBe(String(0.1 + 0.2));
	});

	it('leaves exactly the remainder capturable when a payment is split into thirds', async () => {
		// 3 × 33.33 = 99.99, so exactly 0.01 is left and one cent more than that is refused: the ceiling is
		// read from the stored total at every step rather than from a counter that could drift.
		const fixture = collectionFixture([collectionRow('c1', { authorizedAmount: '100' })]);

		await fixture.service.recordCapture('c1', '33.33');
		await fixture.service.recordCapture('c1', '33.33');
		await fixture.service.recordCapture('c1', '33.33');

		expect(fixture.store('c1')).toMatchObject({
			capturedAmount: '99.99',
			status: PaymentCollectionStatus.PARTIALLY_CAPTURED
		});

		await fixture.service.recordCapture('c1', '0.01');

		expect(fixture.store('c1')).toMatchObject({
			capturedAmount: '100',
			status: PaymentCollectionStatus.COMPLETED
		});
		await expect(fixture.service.recordCapture('c1', '0.01')).rejects.toThrow(/PAYMENT_OVER_CAPTURE/);
	});
});

describe('PaymentCollectionService — what may still change (doc 10 §8.2, §8.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('changes descriptive fields of a collection that has not moved, canonicalising a new amount', async () => {
		const fixture = collectionFixture([collectionRow('c1')]);

		const updated = await fixture.service.updateCollection('c1', {
			amount: '250.00',
			metadata: { captureMode: 'MANUAL' }
		} as never);

		expect(updated).toMatchObject({ amount: '250', metadata: { captureMode: 'MANUAL' } });
	});

	it('refuses to re-state the amount or the currency of a collection that has moved', async () => {
		// The sessions were created for that figure; rewriting it afterwards would make every capture
		// already taken look like an over-capture.
		const fixture = collectionFixture([collectionRow('c1', { authorizedAmount: '40' })]);

		await expect(fixture.service.updateCollection('c1', { amount: '200' } as never)).rejects.toThrow(
			/no longer writable/
		);
		await expect(fixture.service.updateCollection('c1', { currency: 'EUR' } as never)).rejects.toThrow(
			/no longer writable/
		);
		expect(fixture.store('c1')).toMatchObject({ amount: '100', currency: 'USD' });
	});

	it('strips a status a body carries, because the amounts are the authority', async () => {
		const fixture = collectionFixture([collectionRow('c1')]);

		await fixture.service.updateCollection('c1', {
			status: PaymentCollectionStatus.COMPLETED,
			metadata: { note: 'paid' }
		} as never);

		expect(fixture.store('c1')).toMatchObject({
			status: PaymentCollectionStatus.NOT_PAID,
			metadata: { note: 'paid' }
		});
	});

	it('reports an unknown collection, and another organization’s collection, as missing', async () => {
		const fixture = collectionFixture([collectionRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.findCollectionOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findCollectionOrFail('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.recordCapture('theirs', '1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.updateCollection('theirs', { metadata: {} } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.store('theirs').capturedAmount).toBe('0');
	});

	it('paginates the collections of the caller’s organization, and only those', async () => {
		const fixture = collectionFixture([
			collectionRow('mine'),
			collectionRow('also-mine', { orderId: 'another-order' }),
			collectionRow('theirs', { organizationId: OTHER_ORG })
		]);

		const page = await fixture.service.findCollections();

		expect(page.total).toBe(2);
		expect(page.items.map((collection) => collection.id).sort()).toEqual(['also-mine', 'mine']);
	});
});
