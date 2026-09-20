/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a billing ledger needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**,
 * with the platform's real money layer and the platform's own `isUniqueViolation` behind it — the
 * whole point of the race case below is which errors it recognises.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

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

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

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

		async softDelete(criteria: any): Promise<any> {
			return this.typeOrmRepository.softDelete(criteria);
		}
	}

	return {
		TenantAwareCrudService,
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
		VersionedColumn: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: jest.requireActual('@gauzy/core/src/lib/core/errors/unique-violation').isUniqueViolation,
		SequenceService: class SequenceService {},
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
import { SubscriptionBillingStatus } from '../subscription.types';
import { SubscriptionBillingService } from './subscription-billing.service';

/**
 * The billing ledger: one row per cycle, and the attempt history on it.
 *
 * The service owns the two writes that make a billing run safe to retry, and doc 05 §15.4 states
 * both of them as invariants of the table:
 *
 * - **one billing row per `(subscription, periodStart)`** — "the unique index is what makes a retried
 *   billing run idempotent, which is the whole point of the constraint" — so `createPending` answers
 *   the row that is already there rather than opening a second one, and a loser of an insert race
 *   reads the winner's row instead of being handed a driver error;
 * - **`paidAt` is non-null exactly when `status = 'PAID'`** — the pair asserts what the other says
 *   rather than merely accompanying it — plus `amount >= 0` and `periodStart < periodEnd`.

 * The suite pins those, the refusal that keeps the cycle's own arithmetic honest (a period that does
 * not end after it starts, a negative amount), the attempt history every dunning decision is read
 * from, and the refund guard ("only a paid cycle has money to give back").
 *
 * The service is constructed directly over one in-memory table. The double states the `where` and the
 * operators the service states — equality, `In` and `LessThanOrEqual` — because a double that
 * answered everything would make the due-retry and scope cases vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000010';
const OTHER_SUBSCRIPTION = '00000000-0000-4000-8000-000000000011';

type Row = Record<string, any>;

const PERIOD_START = new Date('2026-03-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-04-01T00:00:00.000Z');

/**
 * The in-memory stand-in for the cycle table's TypeORM repository.
 *
 * @param rows The whole table.
 * @param options.onSave What the write does instead of succeeding, when a case is about a race.
 */
function repository(rows: Row[], options: { onSave?: (entity: Row) => void } = {}) {
	let sequence = 0;
	const live = () => rows.filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	/** The instant a column value stands for, whichever form the driver handed it back in. */
	const instant = (value: unknown): number => new Date(value as string | number | Date).getTime();
	const matchesValue = (value: unknown, expected: unknown): boolean => {
		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value ?? []).some((candidate: unknown) => matchesValue(value, candidate));
				case 'lessThanOrEqual':
					return instant(value ?? 0) <= instant(expected.value ?? 0);
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		// TypeORM drops an `undefined` member from the condition rather than matching nothing.
		if (expected === undefined) {
			return true;
		}

		// A timestamp column hands back a `Date` and the condition carries one too.
		if (value instanceof Date || expected instanceof Date) {
			return instant(value ?? 0) === instant(expected ?? 0);
		}

		return same(value, expected);
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => matchesValue(row[field], expected));
	const sorted = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				const a = left[column] instanceof Date ? left[column].getTime() : left[column];
				const b = right[column] instanceof Date ? right[column].getTime() : right[column];

				if (a === b) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (a > b ? 1 : -1) * direction;
			}

			return 0;
		});
	};
	const limited = (found: Row[], take?: number) => (take === undefined ? found : found.slice(0, take));

	return {
		rows: live,
		find: async (options: any = {}) =>
			limited(sorted(live().filter((row) => matches(row, options.where)), options.order), options.take),
		findOne: async (options: any = {}) => live().find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = live().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => live().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
		save: async (entity: any) => {
			options.onSave?.(entity);

			if (entity.id) {
				const index = rows.findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows[index] = { ...rows[index], ...entity };

					return rows[index];
				}
			}

			const created = { id: `billing-new-${++sequence}`, ...entity };

			rows.push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows.findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(rows[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			// The platform's `softDelete` takes an id as readily as a criteria object.
			const where = typeof criteria === 'string' ? { id: criteria } : criteria;
			const matching = rows.filter((row) => matches(row, where));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One `subscription_billing` row, as the service reads it. */
const billingRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	subscriptionId: SUBSCRIPTION,
	periodStart: new Date(PERIOD_START),
	periodEnd: new Date(PERIOD_END),
	amount: '120.000000',
	currency: 'USD',
	status: SubscriptionBillingStatus.PENDING,
	dueAt: new Date(PERIOD_START),
	paidAt: null,
	attemptCount: 0,
	...overrides
});

/**
 * Builds the billing service over one in-memory table.
 *
 * @param rows The cycles the fixture starts with.
 * @param options.uniqueViolationOnInsert Whether the insert loses a race against another worker.
 */
function billingFixture(rows: Row[] = [], options: { uniqueViolationOnInsert?: boolean } = {}) {
	const table = rows.map((row) => ({ ...row }));
	let raced = false;
	// A competing worker's row is committed *before* this writer's insert reaches the database, which is
	// what a lost race actually looks like from the loser's side.
	const store = repository(table, {
		onSave: (entity) => {
			if (!options.uniqueViolationOnInsert || raced) {
				return;
			}

			raced = true;
			table.push(
				billingRow('billing-of-the-winner', {
					periodStart: new Date(entity.periodStart),
					periodEnd: new Date(entity.periodEnd),
					amount: '120.000000'
				})
			);

			const error = new Error('duplicate key value violates unique constraint "UQ_subscription_billing_period"');

			(error as Row).code = '23505';

			throw error;
		}
	});
	const service = new SubscriptionBillingService(store as never, {} as never);

	return {
		service,
		table,
		billing: (id: string) => table.find((row) => row.id === id)
	};
}

describe('SubscriptionBillingService — opening a cycle (doc 05 §15.4, doc 11 §10.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('opens the cycle in PENDING before any work starts, with the documented defaults', async () => {
		// "One `subscription_billing` row per subscription per period, in `PENDING`, **before** any
		// billing work starts, so a crash cannot silently skip a period" (doc 11 §10.5).
		const fixture = billingFixture();

		const billing = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '120',
			currency: 'USD'
		});

		expect(billing).toMatchObject({
			subscriptionId: SUBSCRIPTION,
			status: SubscriptionBillingStatus.PENDING,
			amount: '120.000000',
			currency: 'USD',
			dueAt: PERIOD_START,
			attemptCount: 0,
			tenantId: TENANT,
			organizationId: ORG
		});
		// A row that was opened and never settled carries no payment instant: `paidAt` is non-null exactly
		// when the cycle is `PAID`, and the column's default is null.
		expect(billing.paidAt ?? null).toBeNull();
		expect(billing.periodStart).toEqual(PERIOD_START);
		expect(billing.periodEnd).toEqual(PERIOD_END);
	});

	it('refuses a period that does not end after it starts, and one that is not a period at all', async () => {
		// The table's own check constraint is `periodStart < periodEnd`; a zero-length period is a cycle
		// that bills an instant, and a reversed one is a cycle that ends before it begins.
		const fixture = billingFixture();

		for (const [start, end] of [
			[PERIOD_START, PERIOD_START],
			[PERIOD_END, PERIOD_START]
		] as Array<[Date, Date]>) {
			await expect(
				fixture.service.createPending({
					subscriptionId: SUBSCRIPTION,
					periodStart: start,
					periodEnd: end,
					amount: '1',
					currency: 'USD'
				})
			).rejects.toThrow(/SUBSCRIPTION_BILLING_PERIOD_INVALID/);
		}

		await expect(
			fixture.service.createPending({
				subscriptionId: SUBSCRIPTION,
				periodStart: '2026-03-01' as never,
				periodEnd: PERIOD_END,
				amount: '1',
				currency: 'USD'
			})
		).rejects.toThrow(/SUBSCRIPTION_BILLING_PERIOD_INVALID/);
		expect(fixture.table).toEqual([]);
	});

	it('refuses a negative amount, at the currency’s scale', async () => {
		// `amount >= 0` is the column's invariant, and the check is made on what the currency will store:
		// minus half a cent in a currency with no minor unit is nothing at all.
		const fixture = billingFixture();

		await expect(
			fixture.service.createPending({
				subscriptionId: SUBSCRIPTION,
				periodStart: PERIOD_START,
				periodEnd: PERIOD_END,
				amount: '-1',
				currency: 'USD'
			})
		).rejects.toThrow(/SUBSCRIPTION_BILLING_AMOUNT_INVALID/);

		await expect(
			fixture.service.createPending({
				subscriptionId: SUBSCRIPTION,
				periodStart: PERIOD_START,
				periodEnd: PERIOD_END,
				amount: '-0.4',
				currency: 'JPY'
			})
		).resolves.toMatchObject({ amount: '0.000000' });
	});

	it('writes the amount at the currency’s scale, half-up', async () => {
		const fixture = billingFixture();

		const usd = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '10.005',
			currency: 'USD'
		});
		const jpy = await fixture.service.createPending({
			subscriptionId: OTHER_SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '100.5',
			currency: 'JPY'
		});

		expect(usd.amount).toBe('10.010000');
		expect(jpy.amount).toBe('101.000000');
	});

	it('answers the cycle that already exists for the period rather than opening a second one', async () => {
		// The whole point of the unique `(subscriptionId, periodStart)` key: a retried pass — or a manual
		// run racing the scheduled one — finds the period it was going to bill and does nothing further.
		const fixture = billingFixture();

		const first = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '120',
			currency: 'USD'
		});
		const second = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '999',
			currency: 'USD'
		});

		expect(second.id).toBe(first.id);
		// And the amount the row already carries is left alone: a second attempt is not a re-pricing.
		expect(second.amount).toBe('120.000000');
		expect(fixture.table).toHaveLength(1);
	});

	it('answers the winner’s row when the insert lost a race', async () => {
		// Two workers reached the same period at the same instant. The loser reads the winner's row and
		// does nothing further, which is what keeps one period to one charge — and it is not handed the
		// driver error, which would abandon the cycle it was trying to bill.
		const fixture = billingFixture([], { uniqueViolationOnInsert: true });

		const billing = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '120',
			currency: 'USD'
		});

		expect(billing).toMatchObject({ id: 'billing-of-the-winner', amount: '120.000000' });
		expect(fixture.table).toHaveLength(1);
	});

	it('tells two periods of one subscription apart, and two subscriptions’ periods apart', async () => {
		// Control for the identity above: the key is the pair, so neither a later period nor another
		// subscription's cycle is mistaken for the one that already exists.
		const fixture = billingFixture();

		await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '120',
			currency: 'USD'
		});
		await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_END,
			periodEnd: new Date('2026-05-01T00:00:00.000Z'),
			amount: '120',
			currency: 'USD'
		});
		await fixture.service.createPending({
			subscriptionId: OTHER_SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '120',
			currency: 'USD'
		});

		expect(fixture.table).toHaveLength(3);
	});
});

describe('SubscriptionBillingService — the attempt history on the row (doc 11 §10.5, §10.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records that the cycle produced an order', async () => {
		const fixture = billingFixture([billingRow('billing-1', { lastError: 'a previous decline' })]);

		const invoiced = await fixture.service.markInvoiced('billing-1', 'order-1');

		expect(invoiced).toMatchObject({
			status: SubscriptionBillingStatus.INVOICED,
			orderId: 'order-1',
			amount: '120.000000',
			lastError: null
		});
	});

	it('records an amount that differs from the one the cycle was opened with', async () => {
		const fixture = billingFixture([billingRow('billing-1')]);

		const invoiced = await fixture.service.markInvoiced('billing-1', 'order-1', '118.8');

		expect(invoiced.amount).toBe('118.800000');
	});

	it('makes paidAt non-null exactly when the cycle is PAID', async () => {
		// Doc 05 §15.4: "`paidAt` is non-null exactly when `status = 'PAID'`". Every write that moves the
		// status moves the timestamp with it, so the two can never disagree.
		const fixture = billingFixture([billingRow('billing-1')]);

		const paid = await fixture.service.markPaid('billing-1', { orderId: 'order-1', attemptCount: 1 });

		expect(paid).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1', nextRetryAt: null });
		expect(paid.paidAt).toBeInstanceOf(Date);

		const failed = await fixture.service.markFailed('billing-1', { attemptCount: 2, error: 'declined' });

		expect(failed).toMatchObject({ status: SubscriptionBillingStatus.FAILED, paidAt: null });
	});

	it('keeps the attempt count and the order a paid cycle already carried when none is stated', async () => {
		const fixture = billingFixture([billingRow('billing-1', { attemptCount: 3, orderId: 'order-1' })]);

		const paid = await fixture.service.markPaid('billing-1');

		expect(paid).toMatchObject({ attemptCount: 3, orderId: 'order-1' });
	});

	it('records a failed attempt with the instant the next one is owed', async () => {
		const fixture = billingFixture([billingRow('billing-1')]);
		const retryAt = new Date('2026-04-02T00:00:00.000Z');

		const failed = await fixture.service.markFailed('billing-1', {
			attemptCount: 1,
			error: 'SUBSCRIPTION_CHARGE_FAILED: the instrument was declined',
			nextRetryAt: retryAt
		});

		expect(failed).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			attemptCount: 1,
			nextRetryAt: retryAt,
			paidAt: null
		});
		expect(failed.lastError).toMatch(/the instrument was declined/);
	});

	it('clears the retry instant when the schedule is exhausted', async () => {
		// A null `nextRetryAt` is what takes the cycle out of the due-retry scan, which is how "no further
		// automatic attempt is owed" is expressed.
		const fixture = billingFixture([
			billingRow('billing-1', { attemptCount: 4, nextRetryAt: new Date('2026-03-08T00:00:00.000Z') })
		]);

		const failed = await fixture.service.markFailed('billing-1', { attemptCount: 5, error: 'declined again', nextRetryAt: null });

		expect(failed).toMatchObject({ attemptCount: 5, nextRetryAt: null });
	});

	it('records why a cycle was deliberately not charged, keeping what the row already carried', async () => {
		// `WAIVED` is deliberately distinct from `PAID`: reporting that treats them alike overstates
		// revenue, so the reason is kept on the row.
		const fixture = billingFixture([
			billingRow('billing-1', { attemptCount: 1, paidAt: new Date(), metadata: { gross: '120.000000' } })
		]);

		const waived = await fixture.service.markWaived('billing-1', { reason: 'goodwill', note: 'support credit' });

		expect(waived).toMatchObject({
			status: SubscriptionBillingStatus.WAIVED,
			paidAt: null,
			nextRetryAt: null,
			metadata: { gross: '120.000000', waivedReason: 'goodwill', waivedNote: 'support credit' }
		});
	});

	it('refuses to refund a cycle that was never paid', async () => {
		const fixture = billingFixture([
			billingRow('pending', { status: SubscriptionBillingStatus.PENDING }),
			billingRow('invoiced', { status: SubscriptionBillingStatus.INVOICED })
		]);

		for (const id of ['pending', 'invoiced']) {
			await expect(fixture.service.markRefunded(id, 'customer asked')).rejects.toThrow(
				/only a paid cycle has money to give back/
			);
			expect(fixture.billing(id)?.status).not.toBe(SubscriptionBillingStatus.REFUNDED);
		}
	});

	it('records that a paid cycle was refunded, and keeps the note', async () => {
		const fixture = billingFixture([
			billingRow('billing-1', { status: SubscriptionBillingStatus.PAID, paidAt: new Date() })
		]);

		const refunded = await fixture.service.markRefunded('billing-1', 'service never delivered');

		expect(refunded).toMatchObject({ status: SubscriptionBillingStatus.REFUNDED });
		expect(refunded.metadata).toMatchObject({ refundNote: 'service never delivered' });
	});

	it('refuses a cycle of another organization, and one that does not exist', async () => {
		const fixture = billingFixture([billingRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.markPaid('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.markInvoiced('theirs', 'order-1')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.markFailed('theirs', { attemptCount: 1, error: 'x' })).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.markWaived('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.markRefunded('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('no-such-cycle')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SubscriptionBillingService — the reads a pass is built from (doc 11 §10.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads a subscription’s cycles newest period first, inside the caller’s organization', async () => {
		const fixture = billingFixture([
			billingRow('older', { periodStart: new Date('2026-01-01T00:00:00.000Z') }),
			billingRow('newer', { periodStart: new Date('2026-03-01T00:00:00.000Z') }),
			billingRow('another-subscription', { subscriptionId: OTHER_SUBSCRIPTION }),
			billingRow('theirs', { organizationId: OTHER_ORG })
		]);

		expect((await fixture.service.findForSubscription(SUBSCRIPTION)).map((row) => row.id)).toEqual([
			'newer',
			'older'
		]);
	});

	it('reads a cycle by its period, and answers nothing for a period never billed', async () => {
		const fixture = billingFixture([billingRow('billing-1')]);

		expect(await fixture.service.findByPeriod(SUBSCRIPTION, PERIOD_START)).toMatchObject({ id: 'billing-1' });
		expect(await fixture.service.findByPeriod(SUBSCRIPTION, new Date('2026-05-01T00:00:00.000Z'))).toBeNull();
		// The same period of another subscription is another cycle.
		expect(await fixture.service.findByPeriod(OTHER_SUBSCRIPTION, PERIOD_START)).toBeNull();
	});

	it('reads only the failed cycles whose retry has come due, oldest first', async () => {
		const now = new Date('2026-03-10T00:00:00.000Z');
		const fixture = billingFixture([
			billingRow('due-later', {
				status: SubscriptionBillingStatus.FAILED,
				nextRetryAt: new Date('2026-03-11T00:00:00.000Z')
			}),
			billingRow('due-now', {
				status: SubscriptionBillingStatus.FAILED,
				nextRetryAt: new Date('2026-03-10T00:00:00.000Z')
			}),
			billingRow('due-earlier', {
				status: SubscriptionBillingStatus.FAILED,
				nextRetryAt: new Date('2026-03-09T00:00:00.000Z')
			}),
			// A cycle that is still in progress or that has settled is not a candidate for another charge,
			// which is what makes the scan an index seek.
			billingRow('pending', { status: SubscriptionBillingStatus.PENDING }),
			billingRow('paid', { status: SubscriptionBillingStatus.PAID, nextRetryAt: now })
		]);

		expect((await fixture.service.findDueRetries(now)).map((row) => row.id)).toEqual(['due-earlier', 'due-now']);
		// The boundary itself is due: `nextRetryAt <= now`.
		expect((await fixture.service.findDueRetries(now, 1)).map((row) => row.id)).toEqual(['due-earlier']);
	});

	it('takes at least one cycle however the caller states the limit', async () => {
		// A pass that took zero cycles would report a successful run forever while billing nobody.
		const now = new Date('2026-03-10T00:00:00.000Z');
		const fixture = billingFixture([
			billingRow('due-1', { status: SubscriptionBillingStatus.FAILED, nextRetryAt: new Date('2026-03-09T00:00:00.000Z') }),
			billingRow('due-2', { status: SubscriptionBillingStatus.FAILED, nextRetryAt: new Date('2026-03-09T00:00:00.000Z') })
		]);

		expect(await fixture.service.findDueRetries(now, 0)).toHaveLength(1);
		expect(await fixture.service.findDueRetries(now, -5)).toHaveLength(1);
		expect(await fixture.service.findDueRetries(now, 1.9)).toHaveLength(1);
		expect(await fixture.service.findDueRetries(now, 2)).toHaveLength(2);
	});
});

describe('SubscriptionBillingService — a cycle that is not the caller’s is not a cycle', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes a cycle in the caller’s scope and reads it back only inside that scope', async () => {
		// The scope a cycle is written with is the scope it is read with, so a row opened by one tenant is
		// never returned to another.
		const fixture = billingFixture();

		const billing = await fixture.service.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: PERIOD_START,
			periodEnd: PERIOD_END,
			amount: '0',
			currency: 'USD'
		});

		expect(billing).toMatchObject({ tenantId: TENANT, organizationId: ORG });
		await expect(fixture.service.findOneScoped(billing.id)).resolves.toMatchObject({ id: billing.id });

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		await expect(fixture.service.findOneScoped(billing.id)).rejects.toBeInstanceOf(NotFoundException);
		expect(await fixture.service.findByPeriod(SUBSCRIPTION, PERIOD_START)).toBeNull();
	});
});
