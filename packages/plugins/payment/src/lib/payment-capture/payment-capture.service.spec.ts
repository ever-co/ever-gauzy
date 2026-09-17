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
import { Money, RequestContext } from '@gauzy/core';
import { PaymentCapturedEvent } from '../events';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
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
 * The service is constructed directly with in-memory doubles of its repositories. The double states the
 * `where` the service states and applies updates to the stored row, so "nothing was written by the
 * refusal" is asserted against state rather than against a mock's call log.
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
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const identify = (criteria: any) =>
		typeof criteria === 'string' ? criteria : (criteria?.id ?? undefined);

	return {
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
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
			const id = identify(criteria);
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = identify(criteria);
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
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
	const published: any[] = [];
	const collectionService = new PaymentCollectionService(
		repository(tables, 'payment_collection') as never,
		{} as never
	);
	const service = new PaymentCaptureService(
		repository(tables, 'payment_capture') as never,
		{} as never,
		repository(tables, 'payment') as never,
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
