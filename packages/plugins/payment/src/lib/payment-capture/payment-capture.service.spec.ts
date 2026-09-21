/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a capture ledger needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the capture service, and the real collection service it checks its second ceiling
 * with, over in-memory doubles of their repositories. Only the base CRUD class, the request context,
 * the core `Payment` entity (which this suite addresses as a table) and the entity base classes are
 * substituted, and the money kernel is pulled through the seam with `requireActual`, so every total
 * below is computed by the platform's own arithmetic.
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

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
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
		// The affected-row reader is the platform's own, pulled through the seam rather than written
		// again here: a capture decides whether its compare-and-swap was refused from whatever the
		// driver answered the `UPDATE` with, and a double that understood a different set of shapes
		// would pass this suite while the four supported drivers disagreed with it.
		readAffectedRows: jest.requireActual('@gauzy/core/src/lib/database/database.helper').readAffectedRows,
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

/**
 * The affected-row reader above is the real one, and it asks the configuration which dialect is in
 * play; the configuration reads the process environment at import time and there is none here. The
 * dialect is answered as the default the platform develops against, which is also the one whose
 * quoting the reader leaves alone.
 */
jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => false,
		isPostgres: () => false,
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, Payment, RequestContext } from '@gauzy/core';
import { PaymentCapturedEvent } from '../events';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { PaymentCapture } from './payment-capture.entity';
import { PaymentCaptureService } from './payment-capture.service';

/**
 * The capture ledger: money actually taken (doc 10 §8.3, §8.7).
 *
 * A capture is the moment the platform's record and the provider's record have to agree, so the two
 * ceilings the money specification states are enforced here rather than trusted to the caller:
 *
 * ```
 * payment.capturedAmount + captureAmount <= payment.authorizedAmount - payment.canceledAmount
 * collection.capturedAmount + captureAmount <= collection.amount
 * ```
 *
 * The suite pins them from both sides — the amount that exactly reaches a ceiling is accepted, one cent
 * past it is refused with `PAYMENT_OVER_CAPTURE` — together with the three facts that make the ledger
 * reconcilable:
 *
 * - **the row is append-only.** There is no update and no delete of a capture: a partial capture is
 *   another row, and a correction is a refund. A ledger that can be rewritten cannot be reconciled;
 * - **the payment row moves with the capture**, in the same write: `capturedAmount`, `capturedAt` and
 *   the derived status, because a payment that says one thing while its captures say another is exactly
 *   the disagreement the extension exists to prevent;
 * - **the derived status is a function of the row's own amounts** (doc 10 §8.7), which is what makes it
 *   answerable for a payment that settles an invoice only and has no collection at all.
 *
 * To those three the ledger adds a fourth, without which the first two hold only while nothing else is
 * writing:
 *
 * - **the payment row is written conditionally on what the ceiling was measured from.** The `UPDATE`
 *   names the running total this call read among its criteria, so a second capture that reasoned about
 *   the same total changes no row and is refused with `PAYMENT_CAPTURE_CONFLICT` rather than
 *   overwriting the first one's figure. A ceiling checked against a value that may have moved by the
 *   time it is written is not a ceiling.
 *
 * The service is constructed directly with in-memory doubles of its repositories, over one datastore
 * that also hands out the entity manager the capture is written through. The double states the `where`
 * the service states — the whole of it, including the running total a compare-and-swap predicates
 * itself on — and applies updates to the stored row, so both "nothing was written by the refusal" and
 * "the second writer changed nothing" are asserted against state rather than against a mock's call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const PAYMENT = 'payment-1';
const COLLECTION = 'collection-1';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	payment: Row[];
	payment_capture: Row[];
	payment_collection: Row[];
}

/**
 * The entity classes the capture service hands its transaction manager, resolved to tables.
 *
 * `Payment` is the class the mocked `@gauzy/core` above exports and `PaymentCapture` is this package's
 * own entity, and the service imports those same two, so the identity the manager is keyed by is the
 * identity it is handed.
 */
const ENTITY_TABLES = new Map<unknown, keyof ITables>([
	[Payment, 'payment'],
	[PaymentCapture, 'payment_capture']
]);

/**
 * An in-memory stand-in for the datastore this suite drives: one TypeORM repository per table, and the
 * entity manager those repositories hand out.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: ITables) {
	let sequence = 0;
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			// A compare-and-swap on a running total states `IS NULL` for a column it read as absent,
			// because `= NULL` matches nothing in SQL. The double has to make the same distinction, or a
			// criteria the database would honour would silently match nothing here.
			if (expected instanceof FindOperator && expected.type === 'isNull') {
				return row[field] === null || row[field] === undefined;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const identify = (criteria: any) => (typeof criteria === 'string' ? criteria : (criteria?.id ?? undefined));
	const tableOf = (entity: unknown): keyof ITables => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const save = (table: keyof ITables, entity: Row) => {
		const rows = tables[table];

		if (entity.id) {
			const index = rows.findIndex((row) => row.id === entity.id);

			if (index >= 0) {
				rows[index] = { ...rows[index], ...entity };

				return rows[index];
			}
		}

		const created = { id: `${String(table)}-new-${++sequence}`, ...entity };

		rows.push(created);

		return created;
	};
	/**
	 * One `UPDATE`, applied the way the database applies it.
	 *
	 * TypeORM states the **whole** criteria it was handed, not the id alone. The running total a
	 * compare-and-swap predicates its statement on is part of that criteria, so a double that matched on
	 * the id only would answer one affected row for a statement the database would have matched nothing
	 * with — which is to say it would report a lost race as a write that landed, and the refusal this
	 * suite is about could never be observed.
	 *
	 * @param table The table to write.
	 * @param criteria The criteria, as an id or as a `where` object.
	 * @param partial The columns to set.
	 * @returns The affected-row count, in the shape TypeORM's own driver answers with.
	 */
	const applyUpdate = (table: keyof ITables, criteria: any, partial: Row) => {
		const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
		const index = tables[table].findIndex((row) => matches(row, where));

		if (index >= 0) {
			Object.assign(tables[table][index], partial);
		}

		return { affected: index >= 0 ? 1 : 0 };
	};

	/**
	 * The entity manager the capture service writes the payment row and the ledger row through.
	 *
	 * It models the manager's **entity-keyed** API — the entity class chooses the table, and the tables
	 * are the very arrays the repositories below read — so a compare-and-swap whose criteria match no
	 * row answers zero affected rows here exactly as it would against a database, which is the whole of
	 * what `PAYMENT_CAPTURE_CONFLICT` is decided from.
	 *
	 * **`transaction` is not a transaction, and this suite does not pretend it is.** It runs the work
	 * against the same arrays and hands it this same manager; an array has nothing to roll back to, so a
	 * body that threw half way would leave its earlier write standing. Asserting atomicity against a
	 * double that cannot provide it would be asserting a guarantee nobody has. What the double can be
	 * held to is the *order* the service writes in — the payment's compare-and-swap first, the ledger
	 * row only once it landed — and that order is what keeps a refused swap from leaving a capture row
	 * behind whatever the storage does afterwards. Atomicity itself is the database's, and is the reason
	 * the service asks for a transaction at all.
	 */
	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rowOrRows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
		update: async (entity: unknown, criteria: any, partial: Row) =>
			applyUpdate(tableOf(entity), criteria, partial)
	};

	/** One table's TypeORM repository, as the base CRUD class reads it. */
	const repository = (table: keyof ITables) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables[table].filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables[table].find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables[table].find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = tables[table].filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => tables[table].length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => save(table, entity),
		update: async (criteria: any, partial: Row) => applyUpdate(table, criteria, partial),
		delete: async (criteria: any) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

			if (index >= 0) {
				tables[table].splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	});

	return { repository, manager };
}

/**
 * One core `payment` row, as the capture service reads and writes it.
 *
 * @param id The row identifier.
 * @param overrides The authorisation and the totals the case is about.
 */
const paymentRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: 'order-1',
	paymentCollectionId: COLLECTION,
	amount: '100',
	currency: 'USD',
	status: 'AUTHORIZED',
	authorizedAmount: '100',
	capturedAmount: '0',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/** One `payment_collection` row, as the composed collection service reads it. */
const collectionRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: 'order-1',
	amount: '100',
	currency: 'USD',
	status: 'AWAITING',
	authorizedAmount: '100',
	capturedAmount: '0',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/**
 * Builds the capture service over one in-memory datastore, composing the real collection service over
 * its own double.
 *
 * @param options The rows the fixture starts with.
 */
function captureFixture(options: { payments?: Row[]; captures?: Row[]; collections?: Row[] } = {}) {
	const tables: ITables = {
		payment: options.payments ?? [paymentRow(PAYMENT)],
		payment_capture: options.captures ?? [],
		payment_collection: options.collections ?? [collectionRow(COLLECTION)]
	};
	const store = datastore(tables);
	const published: any[] = [];
	const collectionService = new PaymentCollectionService(store.repository('payment_collection') as never, {} as never);
	const service = new PaymentCaptureService(
		store.repository('payment_capture') as never,
		{} as never,
		store.repository('payment') as never,
		collectionService,
		{
			publish: async (event: any) => {
				published.push(event);

				return event;
			}
		} as never
	);

	return {
		service,
		tables,
		published,
		payment: (id: string = PAYMENT) => tables.payment.find((row) => row.id === id),
		collection: (id: string = COLLECTION) => tables.payment_collection.find((row) => row.id === id)
	};
}

/** A capture to record, so a case states only what it is about. */
const captureInput = (overrides: Row = {}) => ({
	paymentId: PAYMENT,
	amount: '40',
	currency: 'USD',
	...overrides
});

describe('PaymentCaptureService — the ledger and the payment row move together (doc 10 §8.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the capture, moves the payment total, the payment status and the collection', async () => {
		const fixture = captureFixture();

		const capture = await fixture.service.capture(captureInput() as never);

		expect(capture).toMatchObject({
			paymentId: PAYMENT,
			amount: '40',
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(capture.capturedAt).toBeInstanceOf(Date);
		expect(fixture.tables.payment_capture).toHaveLength(1);

		// The payment row says what its captures say: the running total, the instant and the derived
		// status, written in the same step.
		expect(fixture.payment()).toMatchObject({
			capturedAmount: '40',
			status: 'PARTIALLY_CAPTURED'
		});
		expect(fixture.payment().capturedAt).toBeInstanceOf(Date);
		expect(fixture.collection()).toMatchObject({ capturedAmount: '40' });

		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(PaymentCapturedEvent);
		expect(fixture.published[0]).toMatchObject({
			captureId: capture.id,
			paymentId: PAYMENT,
			amount: '40',
			currency: 'USD',
			organizationId: ORG
		});
	});

	it('appends a row per partial capture and keeps the payment total equal to their sum', async () => {
		// There is no partial update of a capture: a second instalment is a second row, and the payment's
		// total is the sum of what was appended.
		const fixture = captureFixture();

		await fixture.service.capture(captureInput({ amount: '30' }) as never);
		await fixture.service.capture(captureInput({ amount: '70' }) as never);

		expect(fixture.tables.payment_capture.map((row) => row.amount)).toEqual(['30', '70']);
		expect(fixture.payment()).toMatchObject({
			capturedAmount: '100',
			status: 'CAPTURED'
		});
		expect(fixture.collection()).toMatchObject({ capturedAmount: '100' });
	});

	it('keeps the captures of a payment without a collection on the payment row alone', async () => {
		// A payment recorded by the accounting side settles an invoice and has no collection; its status
		// still has to be answerable, which is why the derivation is local to the row (doc 10 §8.7).
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { paymentCollectionId: null })]
		});

		const capture = await fixture.service.capture(captureInput() as never);

		expect(capture).toMatchObject({ amount: '40' });
		expect(fixture.payment()).toMatchObject({
			capturedAmount: '40',
			status: 'PARTIALLY_CAPTURED'
		});
		expect(fixture.collection().capturedAmount).toBe('0');
	});

	it('refuses to update or delete a capture, whatever the fields are', async () => {
		// The ledger is append-only: a correction is a refund, never an edit.
		const fixture = captureFixture({
			captures: [{ id: 'capture-1', tenantId: TENANT, organizationId: ORG, paymentId: PAYMENT, amount: '40' }]
		});

		await expect(fixture.service.update('capture-1', { amount: '10' } as never)).rejects.toThrow(
			/PAYMENT_CAPTURE_APPEND_ONLY/
		);
		await expect(fixture.service.delete('capture-1')).rejects.toThrow(/PAYMENT_CAPTURE_APPEND_ONLY/);
		expect(fixture.tables.payment_capture).toHaveLength(1);
		expect(fixture.tables.payment_capture[0].amount).toBe('40');
	});

	it('refuses a capture whose payment moved between the ceiling being measured and the row being written', async () => {
		// The over-capture ceiling is computed from `capturedAmount` as this call read it, so the write
		// has to be conditional on the payment still holding that figure. Two captures of the whole
		// authorisation that both read zero would otherwise both pass the ceiling and both write the same
		// total: two ledger rows for twice the money, with the payment claiming one of them.
		//
		// The second writer is reproduced here by moving the payment between the read and the write, which
		// is the only ordering a single-threaded suite can state. The interleaving is real: the read is
		// `findPaymentOrFail` at the top of `capture`, the write is the compare-and-swap inside the
		// transaction, and any other capture that commits in between takes this branch.
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', capturedAmount: '0' })]
		});
		const read = fixture.service.findPaymentOrFail.bind(fixture.service);
		jest.spyOn(fixture.service, 'findPaymentOrFail').mockImplementation(async (paymentId) => {
			// The read hands back a detached row, which is what a read from a database hands back: the
			// object the caller reasons about does not follow the table afterwards.
			const payment = { ...(await read(paymentId)) } as never;

			// The other capture lands, taking the payment to 100, while this one still holds the zero it
			// measured its ceiling against.
			fixture.payment().capturedAmount = '100';

			return payment;
		});

		const refusal = await fixture.service
			.capture(captureInput({ amount: '100' }) as never)
			.then(() => undefined)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(String(refusal.message)).toContain('PAYMENT_CAPTURE_CONFLICT');
		// The refusal names the figure it reasoned about, so the caller can tell a lost race from a
		// request that was always too large and knows to read the payment again.
		expect(refusal.getResponse()).toMatchObject({
			code: 'PAYMENT_CAPTURE_CONFLICT',
			details: { paymentId: PAYMENT, capturedAmount: '0' }
		});

		// The refusal is what the transaction is ordered for: the payment keeps the figure the winner
		// wrote, and no ledger row was appended for money the payment does not account for.
		expect(fixture.payment().capturedAmount).toBe('100');
		expect(fixture.tables.payment_capture).toEqual([]);
		expect(fixture.published).toEqual([]);
	});

	it('sums the captures of a payment exactly, and answers zero when there are none', async () => {
		const fixture = captureFixture();

		expect(await fixture.service.sumCapturedForPayment(PAYMENT)).toBe('0');

		await fixture.service.capture(captureInput({ amount: '0.1' }) as never);
		await fixture.service.capture(captureInput({ amount: '0.2' }) as never);

		// The classic defect this must not have: `0.1 + 0.2` is `0.30000000000000004` in a double and
		// `0.3` through the money kernel (doc 07 §1.2).
		expect(await fixture.service.sumCapturedForPayment(PAYMENT)).toBe('0.3');
		expect(0.1 + 0.2).not.toBe(0.3);
	});
});

describe('PaymentCaptureService — the two ceilings (doc 10 §8.3, I-7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts a capture that takes the authorisation to exactly its limit', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', capturedAmount: '60' })]
		});

		const capture = await fixture.service.capture(captureInput({ amount: '40' }) as never);

		expect(capture).toMatchObject({ amount: '40' });
		expect(fixture.payment()).toMatchObject({ capturedAmount: '100', status: 'CAPTURED' });
	});

	it('refuses one cent past what is left of the authorisation, and writes nothing', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', capturedAmount: '60' })]
		});

		await expect(fixture.service.capture(captureInput({ amount: '40.01' }) as never)).rejects.toThrow(
			/PAYMENT_OVER_CAPTURE/
		);
		expect(fixture.tables.payment_capture).toEqual([]);
		expect(fixture.payment().capturedAmount).toBe('60');
		expect(fixture.published).toEqual([]);
	});

	it('counts a released authorisation against what may still be taken', async () => {
		// `authorizedAmount - canceledAmount` is what remains: 100 authorised and 40 released leaves 60,
		// so a capture of 60 is the last one that fits.
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', canceledAmount: '40' })]
		});

		await fixture.service.capture(captureInput({ amount: '60' }) as never);

		expect(fixture.payment()).toMatchObject({ capturedAmount: '60' });

		const spent = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', canceledAmount: '40', capturedAmount: '60' })]
		});

		await expect(spent.service.capture(captureInput({ amount: '0.01' }) as never)).rejects.toThrow(
			/PAYMENT_ALREADY_CAPTURED/
		);
	});

	it('refuses a capture against an authorisation that holds nothing left', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100', capturedAmount: '100' })]
		});

		await expect(fixture.service.capture(captureInput({ amount: '1' }) as never)).rejects.toThrow(
			/PAYMENT_ALREADY_CAPTURED/
		);
		expect(fixture.tables.payment_capture).toEqual([]);
	});

	it('refuses a capture against a payment that was never authorised', async () => {
		// A manual payment carries no authorisation step, so it is recorded rather than captured.
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '0', capturedAmount: '0' })]
		});

		await expect(fixture.service.capture(captureInput() as never)).rejects.toThrow(/PAYMENT_NOT_AUTHORIZED/);
		expect(fixture.tables.payment_capture).toEqual([]);
	});

	it('refuses a capture that the payment allows and the collection does not', async () => {
		// The second ceiling of doc 10 §8.3: the authorisation may cover more than the collection is for,
		// and the collection is what the buyer agreed to pay.
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100' })],
			collections: [collectionRow(COLLECTION, { amount: '50' })]
		});

		await expect(fixture.service.capture(captureInput({ amount: '60' }) as never)).rejects.toThrow(
			/PAYMENT_OVER_CAPTURE/
		);
		expect(fixture.tables.payment_capture).toEqual([]);
		expect(fixture.payment().capturedAmount).toBe('0');
		expect(fixture.collection().capturedAmount).toBe('0');
	});

	it('refuses an amount that is not a positive exact decimal, and a currency that is not the payment’s', async () => {
		const fixture = captureFixture();

		await expect(fixture.service.capture(captureInput({ amount: '0' }) as never)).rejects.toThrow(
			/PAYMENT_CAPTURE_AMOUNT_INVALID/
		);
		await expect(fixture.service.capture(captureInput({ amount: '-1' }) as never)).rejects.toThrow(
			/PAYMENT_CAPTURE_AMOUNT_INVALID/
		);
		await expect(fixture.service.capture(captureInput({ amount: 'forty' }) as never)).rejects.toThrow(
			/PAYMENT_AMOUNT_INVALID/
		);
		await expect(fixture.service.capture(captureInput({ currency: 'EUR' }) as never)).rejects.toThrow(
			/does not match payment currency/
		);
		expect(fixture.tables.payment_capture).toEqual([]);
	});

	it('refuses a capture in a currency nobody stated', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { currency: undefined })]
		});

		await expect(
			fixture.service.capture({ paymentId: PAYMENT, amount: '10' } as never)
		).rejects.toThrow(/PAYMENT_CURRENCY_INVALID/);
		expect(fixture.tables.payment_capture).toEqual([]);
	});

	it('reports a payment of another organization as missing', async () => {
		const fixture = captureFixture({ payments: [paymentRow(PAYMENT, { organizationId: OTHER_ORG })] });

		await expect(fixture.service.capture(captureInput() as never)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findPaymentOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.payment_capture).toEqual([]);
	});

	it('leaves exactly the remainder capturable when a payment is split into thirds', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT, { authorizedAmount: '100' })],
			collections: [collectionRow(COLLECTION, { amount: '100' })]
		});

		await fixture.service.capture(captureInput({ amount: '33.33' }) as never);
		await fixture.service.capture(captureInput({ amount: '33.33' }) as never);
		await fixture.service.capture(captureInput({ amount: '33.33' }) as never);

		expect(fixture.payment()).toMatchObject({ capturedAmount: '99.99' });
		expect(await fixture.service.sumCapturedForPayment(PAYMENT)).toBe('99.99');

		await fixture.service.capture(captureInput({ amount: '0.01' }) as never);

		expect(fixture.payment()).toMatchObject({
			capturedAmount: '100',
			status: 'CAPTURED'
		});
		expect(fixture.collection()).toMatchObject({ capturedAmount: '100' });
	});

	it('sums the captures of one payment and not of another, and paginates inside the organization', async () => {
		const fixture = captureFixture({
			payments: [paymentRow(PAYMENT), paymentRow('payment-2'), paymentRow('theirs', { organizationId: OTHER_ORG })],
			captures: [
				{ id: 'c1', tenantId: TENANT, organizationId: ORG, paymentId: PAYMENT, amount: '10', currency: 'USD' },
				{ id: 'c2', tenantId: TENANT, organizationId: ORG, paymentId: 'payment-2', amount: '5', currency: 'USD' },
				{
					id: 'c3',
					tenantId: TENANT,
					organizationId: OTHER_ORG,
					paymentId: PAYMENT,
					amount: '999',
					currency: 'USD'
				}
			]
		});

		expect(await fixture.service.sumCapturedForPayment(PAYMENT)).toBe('10');

		const page = await fixture.service.findCaptures();

		expect(page.total).toBe(2);
		expect(page.items.map((row) => row.id).sort()).toEqual(['c1', 'c2']);
	});
});

describe('PaymentCaptureService — the derived status of the payment row (doc 10 §8.7)', () => {
	/**
	 * The derivation table of doc 10 §8.7, read against the amounts of one row. The order of the tests
	 * is the order of the states: a refund is a fact about money that was taken, so it is asked about
	 * first, and only then the capture and the release.
	 */
	const derivations: Array<{
		trigger: string;
		payment: Row;
		captured: string;
		refunded: string;
		status: string;
	}> = [
		{
			trigger: 'nothing was authorised and nothing was taken',
			payment: { authorizedAmount: '0', capturedAmount: '0', canceledAmount: '0', amount: '100' },
			captured: '0',
			refunded: '0',
			status: 'NOT_PAID'
		},
		{
			trigger: 'the amount is authorised and nothing is taken',
			payment: { authorizedAmount: '100', capturedAmount: '0', canceledAmount: '0', amount: '100' },
			captured: '0',
			refunded: '0',
			status: 'AUTHORIZED'
		},
		{
			trigger: 'the whole authorisation was released before anything was taken',
			payment: { authorizedAmount: '100', capturedAmount: '0', canceledAmount: '100', amount: '100' },
			captured: '0',
			refunded: '0',
			status: 'CANCELED'
		},
		{
			trigger: 'part of the authorisation is taken',
			payment: { authorizedAmount: '100', capturedAmount: '40', canceledAmount: '0', amount: '100' },
			captured: '40',
			refunded: '0',
			status: 'PARTIALLY_CAPTURED'
		},
		{
			trigger: 'the authorisation is taken in full',
			payment: { authorizedAmount: '100', capturedAmount: '100', canceledAmount: '0', amount: '100' },
			captured: '100',
			refunded: '0',
			status: 'CAPTURED'
		},
		{
			trigger: 'what was taken is given back in part',
			payment: { authorizedAmount: '100', capturedAmount: '100', canceledAmount: '0', amount: '100' },
			captured: '100',
			refunded: '40',
			status: 'PARTIALLY_REFUNDED'
		},
		{
			trigger: 'everything that was taken is given back',
			payment: { authorizedAmount: '100', capturedAmount: '100', canceledAmount: '0', amount: '100' },
			captured: '100',
			refunded: '100',
			status: 'REFUNDED'
		},
		{
			trigger: 'a refund overshoots what is left after a release',
			payment: { authorizedAmount: '100', capturedAmount: '100', canceledAmount: '40', amount: '100' },
			captured: '60',
			refunded: '60',
			status: 'REFUNDED'
		}
	];

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(derivations)('derives $status when $trigger', ({ payment, captured, refunded, status }) => {
		const fixture = captureFixture();

		expect(
			fixture.service.derivePaymentStatus(
				paymentRow(PAYMENT, payment) as never,
				Money.of(captured, 'USD'),
				Money.of(refunded, 'USD')
			)
		).toBe(status);
	});

	it('derives a released payment as CANCELED only while nothing was taken', () => {
		// Control for the order of the tests: a release that happened after a capture is not a
		// cancellation, because the capture is the fact that matters.
		const fixture = captureFixture();

		expect(
			fixture.service.derivePaymentStatus(
				paymentRow(PAYMENT, {
					authorizedAmount: '100',
					capturedAmount: '0',
					canceledAmount: '99.99',
					amount: '100'
				}) as never,
				Money.of('0', 'USD'),
				Money.of('0', 'USD')
			)
		).toBe('AUTHORIZED');
	});
});
