/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a subscription lifecycle needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the subscription service, the real plan, line and billing services it is built
 * from, the real cycle module and the platform's real money layer.
 *
 * Only the application graph is substituted — the base CRUD class, the request context, the entity
 * base classes, the numbering series, the idempotency store and the three capabilities the domain
 * reaches through ports. The idempotency double is the platform's own contract: a key is claimed once,
 * a completed key is replayed, a key held by another worker is in flight, and a key reused with a
 * different request is refused.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The platform's own base class, and the inheritance between the two: the tenant-aware class reads a
	 * row before it writes it, and the base class is the one that reaches the statement.
	 */
	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}

		async update(criteria: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(criteria, partial);
		}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}

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

		async findOneByWhereOptions(options: any): Promise<any> {
			const record = await this.typeOrmRepository.findOne({ where: options });

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		/**
		 * The platform's own update, in the two behaviours this suite turns on.
		 *
		 * A criterion that names a `version` is a precondition rather than a locator, so the read in
		 * front of the statement is skipped for it and the affected-row count is what reports a write
		 * that lost its race — the conflict the concurrency kernel's contract is built on. Every other
		 * criterion is read first, so a row that is not there is answered "not found" instead of the
		 * statement quietly matching nothing. A double that read unconditionally would answer the stale
		 * case with a `404` while production answers `409`, which is a green suite proving the wrong
		 * thing.
		 */
		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);

				return await super.update(id, partial);
			}

			if (id && typeof id === 'object' && !('version' in id)) {
				await this.findOneByWhereOptions(id);
			}

			return await super.update(id, partial);
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
		CrudService,
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
		// The conditional write, and the refusals it raises, are the platform's own: the assertions are
		// about the statement the service issues, and a stub would only assert that the service calls the
		// stub.
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
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
import {
	AdjustmentOwnerType,
	AdjustmentType,
	IdempotencyOutcome
} from '@gauzy/contracts';
import { ApiErrorCode, ApiException, IVersionExpectation, RequestContext } from '@gauzy/core';
import {
	SubscriptionBillingPeriod,
	SubscriptionBillingStatus,
	SubscriptionStatus
} from '../subscription.types';
import { SubscriptionPlanService } from '../subscription-plan/subscription-plan.service';
import { SubscriptionItemService } from '../subscription-item/subscription-item.service';
import { SubscriptionBillingService } from '../subscription-billing/subscription-billing.service';
import { SubscriptionPlan } from '../subscription-plan/subscription-plan.entity';
import { SubscriptionItem } from '../subscription-item/subscription-item.entity';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionService } from './subscription.service';

/**
 * The subscription lifecycle and the recurring billing run.
 *
 * Four rules make this service what it is (its own summary), and each of them exists because the
 * alternative is a customer charged for something nobody decided:
 *
 * 1. **a cycle is a row before it is an attempt** — the billing row is opened in `PENDING` before any
 *    work starts, so a crash mid-cycle leaves the period owed rather than skipped (doc 11 §10.5);
 * 2. **a cycle is charged at most once** — the period's unique key plus the platform idempotency store
 *    refuse the second attempt, and a settled cycle is replayed from its own row rather than
 *    recomputed;
 * 3. **a renewal goes through the ordinary order path** — this domain states the recurring lines and
 *    the payer and receives an order back; it writes no order, payment or stock row itself;
 * 4. **a failure is a state, not an exception** — a declined charge records the attempt and the next
 *    retry instant on the cycle's own row and moves the subscription into dunning, and nothing that
 *    failed is ever marked paid.
 *
 * The suite pins those, the calendar (doc 11 §10.5: "`nextBillingAt += one period` computed from the
 * **period start**, not from the moment the job ran (so drift never accumulates)"), the pause/resume
 * rule ("`nextBillingAt = max(now, currentPeriodEnd)`", §10.7), the dunning schedule of §10.6, and the
 * proration rule of §10.8 — including its own worked example.
 *
 * The service is constructed over in-memory tables with the real sub-services behind it, so a case
 * about the calendar is a statement about the rows that were written rather than about a call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CUSTOMER = '00000000-0000-4000-8000-000000000030';
const HOLDER = '00000000-0000-4000-8000-000000000040';
const TOKEN = '00000000-0000-4000-8000-000000000041';
const PLAN = 'plan-1';
const BETTER_PLAN = 'plan-2';
const VARIANT = 'variant-a';
const BETTER_VARIANT = 'variant-b';
const SUBSCRIPTION = 'subscription-1';

/** The period the worked example of doc 11 §10.8 is stated against. */
const MARCH = new Date('2026-03-01T00:00:00.000Z');
const APRIL = new Date('2026-04-01T00:00:00.000Z');
/** The instant the worked example evaluates at: sixteen days ahead of the period's end. */
const MID_MARCH = new Date('2026-03-16T00:00:00.000Z');

type Row = Record<string, any>;

interface ITables {
	subscription_plan: Row[];
	subscription: Row[];
	subscription_item: Row[];
	subscription_billing: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param onWrite A hook the fixture uses to model a competing writer.
 */
function repository(tables: ITables, tableName: keyof ITables, onWrite?: (entity: Row) => void) {
	let sequence = 0;
	const live = () => tables[tableName].filter((row) => !row.deletedAt);
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
		all: () => tables[tableName],
		find: async (options: any = {}) =>
			limited(sorted(live().filter((row) => matches(row, options.where)), options.order), options.take),
		findOne: async (options: any = {}) => {
			const found = live().find((row) => matches(row, options.where)) ?? null;

			// A `relations` read is what a detail view asks for, and the ORM attaches the rows it was asked
			// for: a double that ignored the option would make "the read returns its lines" unassertable.
			if (found && options.relations?.items && tableName === 'subscription') {
				found.items = tables.subscription_item.filter(
					(row) => !row.deletedAt && same(row.subscriptionId, found.id)
				);
			}

			return found;
		},
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
			onWrite?.(entity);

			if (entity.id) {
				const index = tables[tableName].findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					tables[tableName][index] = { ...tables[tableName][index], ...entity };

					return tables[tableName][index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			tables[tableName].push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			// A version-predicated write arrives as `{ id, version }`, and the version is part of the
			// condition rather than of the patch: a row the write is not predicated on matches nothing,
			// which is exactly what the affected-row count reports.
			const where = typeof criteria === 'string' ? { id: criteria } : criteria ?? {};
			const index = tables[tableName].findIndex((row) => matches(row, where));

			if (index >= 0) {
				Object.assign(tables[tableName][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			// The platform's `softDelete` takes an id as readily as a criteria object.
			const where = typeof criteria === 'string' ? { id: criteria } : criteria;
			const matching = tables[tableName].filter((row) => matches(row, where));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One `subscription_plan` row, as the services read it. */
const planRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Plan ${id}`,
	code: id.toUpperCase(),
	billingPeriod: SubscriptionBillingPeriod.MONTHLY,
	billingInterval: 1,
	currency: 'USD',
	isActive: true,
	variantId: id === BETTER_PLAN ? BETTER_VARIANT : VARIANT,
	...overrides
});

/** One `subscription` row, as the services read it. */
const subscriptionRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	planId: PLAN,
	customerId: CUSTOMER,
	paymentAccountHolderId: HOLDER,
	paymentMethodTokenId: TOKEN,
	status: SubscriptionStatus.ACTIVE,
	quantity: '1.000000',
	currentPeriodStart: new Date(MARCH),
	currentPeriodEnd: new Date(APRIL),
	nextBillingAt: new Date(APRIL),
	billingCycleCount: 0,
	currency: 'USD',
	// The row carries the optimistic lock every write to it is predicated on, which is the value the
	// column's `NOT NULL DEFAULT 1` gives it.
	version: 1,
	...overrides
});

/** One `subscription_item` row, as the services read it. */
const itemRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	subscriptionId: SUBSCRIPTION,
	variantId: VARIANT,
	quantity: '1.000000',
	unitPrice: '120.000000',
	position: 0,
	...overrides
});

/**
 * Builds the subscription service over one in-memory store, with the real sub-services behind it.
 *
 * @param options.plans The plans the fixture starts with.
 * @param options.subscriptions The subscriptions the fixture starts with.
 * @param options.items The recurring lines the fixture starts with.
 * @param options.billings The cycles the fixture starts with.
 * @param options.prices What the pricing capability answers with, by variant.
 * @param options.orders What the order capability answers with, or how it refuses.
 * @param options.withPricing Whether the pricing capability is registered.
 * @param options.withOrder Whether the order capability is registered.
 * @param options.withInstruments Whether the instrument capability is registered.
 * @param options.instrumentRefusal What the instrument capability answers when it refuses.
 * @param options.inFlightOnNewKey Whether the idempotency store is already held by another worker.
 */
function subscriptionFixture(
	options: {
		plans?: Row[];
		subscriptions?: Row[];
		items?: Row[];
		billings?: Row[];
		prices?: Record<string, string | null>;
		orders?: { paid?: boolean; paidAt?: Date; orderId?: string } | ((request: Row) => Row | never);
		withPricing?: boolean;
		withOrder?: boolean;
		withInstruments?: boolean;
		instrumentRefusal?: { reasonCode?: string; reason?: string };
		inFlightOnNewKey?: boolean;
	} = {}
) {
	const tables: ITables = {
		subscription_plan: [...(options.plans ?? [planRow(PLAN), planRow(BETTER_PLAN)])],
		subscription: [...(options.subscriptions ?? [subscriptionRow(SUBSCRIPTION)])],
		subscription_item: [...(options.items ?? [itemRow('item-1')])],
		subscription_billing: [...(options.billings ?? [])]
	};
	const orderCalls: Row[] = [];
	const prorationCalls: Row[] = [];
	/** Every payer the instrument capability was asked to resolve, so "it was never asked" is provable. */
	const instrumentCalls: Row[] = [];
	const events: Row[] = [];
	const adjustments: Row[] = [];
	/** Every write the service committed, so a rollback can be asserted rather than assumed. */
	const commits: string[] = [];

	const subscriptionRepository = repository(tables, 'subscription', () => commits.push('subscription'));
	const entityToTable = new Map<unknown, keyof ITables>([
		[Subscription, 'subscription'],
		[SubscriptionItem, 'subscription_item'],
		[SubscriptionBilling, 'subscription_billing']
	]);
	const manager = {
		connection: { options: { type: 'postgres' } },
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const table = entityToTable.get(entity);

			if (!table) {
				throw new Error('the in-memory double was handed an entity it does not know');
			}

			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			commits.push(String(table));

			for (const row of list) {
				if (!row.id) {
					row.id = `${String(table)}-new-${tables[table].length + 1}`;
				}

				tables[table].push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		findOne: async (entity: unknown, findOptions: any = {}) => {
			const table = entityToTable.get(entity);

			if (!table) {
				throw new Error('the in-memory double was handed an entity it does not know');
			}

			return (
				tables[table].find((row) =>
					Object.entries(findOptions.where ?? {}).every(
						([field, expected]) => String(row[field] ?? '') === String(expected ?? '')
					)
				) ?? null
			);
		}
	};
	const transaction = async (run: (transactional: any) => Promise<any>) => {
		const copy = Object.fromEntries(
			Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
		);

		try {
			return await run(manager);
		} catch (error) {
			for (const [table, rows] of Object.entries(copy)) {
				(tables as unknown as Record<string, Row[]>)[table] = rows;
			}

			throw error;
		}
	};

	Object.assign(subscriptionRepository, { manager: { ...manager, transaction } });

	const asked: Row[] = [];
	const pricing =
		options.withPricing === false
			? undefined
			: {
					resolveRecurringPrice: async (request: Row) => {
						asked.push(request);

						const unitPrice = options.prices?.[request.variantId] ?? '120.00';

						return unitPrice === null ? null : { unitPrice, currency: request.currency };
					}
			  };
	const catalog = {
		isVariantSubscribable: async () => true,
		defaultVariantOf: async () => VARIANT
	};
	const planService = new SubscriptionPlanService(
		repository(tables, 'subscription_plan') as never,
		{} as never,
		subscriptionRepository as never,
		catalog as never
	);
	const itemService = new SubscriptionItemService(
		repository(tables, 'subscription_item') as never,
		{} as never,
		pricing as never,
		catalog as never
	);
	const billingService = new SubscriptionBillingService(
		repository(tables, 'subscription_billing') as never,
		{} as never
	);

	/**
	 * The platform's idempotency contract, in memory: claim, replay, in-flight, reused key — and the
	 * stale-lock takeover that makes a retry possible at all. A claim whose lock has aged past the
	 * platform's own window belongs to nobody and is taken over; that is what lets a dunning attempt a
	 * day later run the work the failed attempt left unfinished.
	 */
	const records = new Map<string, Row>();
	const staleLockMs = 2 * 60 * 1000;
	let clockOffset = 0;
	const storeNow = () => Date.now() + clockOffset;
	const idempotencyService = {
		claim: async (request: Row) => {
			const identity = `${request.scope}:${request.key}`;
			const existing = records.get(identity);

			if (!existing) {
				if (options.inFlightOnNewKey) {
					const held = { ...request, response: null, lockedAt: storeNow() };

					records.set(identity, held);

					return { outcome: IdempotencyOutcome.IN_FLIGHT, record: held };
				}

				const claimed = { ...request, response: null, lockedAt: storeNow() };

				records.set(identity, claimed);

				return { outcome: IdempotencyOutcome.CLAIMED, record: claimed };
			}

			if (existing.requestHash !== request.requestHash) {
				return { outcome: IdempotencyOutcome.REUSED_KEY, record: existing };
			}

			if (existing.response) {
				return { outcome: IdempotencyOutcome.REPLAYED, record: existing, response: existing.response };
			}

			if (storeNow() - existing.lockedAt > staleLockMs) {
				// The lock has aged out: the worker that held it is gone, so this caller takes it over.
				existing.lockedAt = storeNow();

				return { outcome: IdempotencyOutcome.CLAIMED, record: existing };
			}

			return { outcome: IdempotencyOutcome.IN_FLIGHT, record: existing };
		},
		complete: async (record: Row, response: Row) => {
			record.response = { status: response.responseStatus, body: response.responseBody, ...response };
		},
		/** Models a restarted store: the claims are gone, the rows the store protected are not. */
		forget: () => records.clear(),
		/** Models the passage of time, which is what ages a lock out between two attempts. */
		advanceBy: (ms: number) => {
			clockOffset += ms;
		},
		records
	};

	const adjustmentService = {
		append: async (adjustment: Row) => {
			adjustments.push(adjustment);

			return adjustment;
		},
		findByOwner: async (ownerType: string, ownerId: string) =>
			adjustments.filter((row) => row.ownerType === ownerType && String(row.ownerId) === String(ownerId))
	};

	const outbox = {
		append: async (_manager: unknown, event: Row) => {
			events.push(event);

			return event;
		}
	};

	const orderGateway =
		options.withOrder === false
			? undefined
			: {
					raiseSubscriptionOrder: async (request: Row) => {
						orderCalls.push(request);

						if (typeof options.orders === 'function') {
							return options.orders(request);
						}

						return {
							orderId: options.orders?.orderId ?? `order-${orderCalls.length}`,
							paid: options.orders?.paid ?? true,
							paidAt: options.orders?.paidAt
						};
					},
					raiseProrationOrder: async (request: Row) => {
						prorationCalls.push(request);

						return { orderId: `proration-order-${prorationCalls.length}`, paid: true };
					}
			  };

	const instruments =
		options.withInstruments === false
			? undefined
			: {
					resolveChargeableInstrument: async (request: Row) => {
						instrumentCalls.push(request);

						return options.instrumentRefusal
							? { chargeable: false, ...options.instrumentRefusal }
							: {
									chargeable: true,
									accountHolderId: request.accountHolderId ?? HOLDER,
									paymentMethodTokenId: request.paymentMethodTokenId ?? TOKEN
							  };
					}
			  };

	const service = new SubscriptionService(
		subscriptionRepository as never,
		{} as never,
		planService,
		itemService,
		billingService,
		idempotencyService as never,
		adjustmentService as never,
		outbox as never,
		orderGateway as never,
		instruments as never
	);

	return {
		service,
		planService,
		itemService,
		billingService,
		tables,
		events,
		orderCalls,
		prorationCalls,
		instrumentCalls,
		adjustments,
		adjustmentsOf: (ownerId: string) =>
			adjustments.filter((row) => row.ownerType === AdjustmentOwnerType.SUBSCRIPTION_BILLING && row.ownerId === ownerId),
		idempotencyService,
		commits,
		subscription: (id: string) => tables.subscription.find((row) => row.id === id),
		items: (subscriptionId: string = SUBSCRIPTION) =>
			tables.subscription_item.filter((row) => row.subscriptionId === subscriptionId && !row.deletedAt),
		billings: (subscriptionId: string = SUBSCRIPTION) =>
			tables.subscription_billing.filter((row) => row.subscriptionId === subscriptionId && !row.deletedAt),
		cycle: (periodStart: Date) =>
			tables.subscription_billing.find(
				(row) => row.subscriptionId === SUBSCRIPTION && new Date(row.periodStart).getTime() === periodStart.getTime()
			)
	};
}

/**
 * The instant one calendar month after a date, at the same time of day — which is what the cycle
 * module's own month arithmetic produces. The suite only states it for mid-month instants, where no
 * end-of-month clamp is involved.
 */
const monthAfter = (date: Date) =>
	new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth() + 1,
			date.getUTCDate(),
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
			date.getUTCMilliseconds()
		)
	);

describe('SubscriptionService — putting a customer on a plan (doc 11 §10.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('commits the agreement, its lines, its first cycle and its event together', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }]
		});

		expect(created).toMatchObject({
			planId: PLAN,
			customerId: CUSTOMER,
			status: SubscriptionStatus.PENDING,
			quantity: '1',
			billingCycleCount: 0,
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(created.currentPeriodStart).toBeInstanceOf(Date);
		expect(created.nextBillingAt).toEqual(created.currentPeriodEnd);
		expect(created.currentPeriodEnd).toEqual(monthAfter(created.currentPeriodStart as Date));

		expect(fixture.items(created.id)).toHaveLength(1);
		expect(fixture.items(created.id)[0]).toMatchObject({ variantId: VARIANT, unitPrice: '120.000000' });

		const [cycle] = fixture.billings(created.id);

		expect(cycle).toMatchObject({
			status: SubscriptionBillingStatus.PENDING,
			amount: '120.000000',
			currency: 'USD',
			attemptCount: 0
		});
		expect(cycle.dueAt).toEqual(cycle.periodStart);

		expect(fixture.events.map((event) => event.name)).toEqual(['subscription.created']);
		expect(fixture.events[0]).toMatchObject({
			aggregateType: 'SUBSCRIPTION',
			aggregateId: created.id,
			data: { subscriptionId: created.id, planId: PLAN, customerId: CUSTOMER, billingId: cycle.id }
		});
		// Everything that makes the subscription a subscription was written in one commit.
		expect(fixture.commits).toEqual(['subscription', 'subscription_item', 'subscription_billing']);
	});

	it('starts billing immediately when the caller asks and there is no trial', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});

		expect(created.status).toBe(SubscriptionStatus.ACTIVE);
	});

	it('leaves a trialling subscription pending, with its first period ending when the trial does', async () => {
		// Doc 11 §10.4.4: "`trialEndsAt` is recorded in `subscription.metadata`, and
		// `nextBillingAt = now + trialDays`. The first paid period starts when the trial ends."
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { trialDays: 14 }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			startTrial: true,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});

		expect(created.status).toBe(SubscriptionStatus.PENDING);
		expect(created.metadata).toMatchObject({ trialEndsAt: (created.currentPeriodEnd as Date).toISOString() });
		expect((created.currentPeriodEnd as Date).getTime() - (created.currentPeriodStart as Date).getTime()).toBe(
			14 * 24 * 60 * 60 * 1000
		);
		expect(fixture.billings(created.id)[0].status).toBe(SubscriptionBillingStatus.WAIVED);
	});

	it('does not start a trial for a plan that has none, however the caller asks', async () => {
		const fixture = subscriptionFixture({ plans: [planRow(PLAN, { trialDays: 0 }), planRow(BETTER_PLAN)], subscriptions: [], items: [], billings: [] });

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			startTrial: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});

		expect(created.metadata?.['trialEndsAt']).toBeUndefined();
		expect(created.currentPeriodEnd).toEqual(monthAfter(created.currentPeriodStart as Date));
	});

	it('is idempotent on the order that produced it', async () => {
		// Doc 11 §10.4.6: "The step is idempotent on `originOrderId`: an operation retry finds the existing
		// subscription and returns it instead of creating a second one."
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { originOrderId: 'order-origin' })]
		});

		const retried = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			originOrderId: 'order-origin',
			items: [{ variantId: VARIANT, unitPrice: '999' }]
		});

		expect(retried.id).toBe(SUBSCRIPTION);
		expect(fixture.tables.subscription).toHaveLength(1);
		// Nothing was written a second time: no second agreement, no second line, no second event.
		expect(fixture.events).toEqual([]);
		expect(fixture.commits).toEqual([]);
	});

	it('refuses a request that names no plan or no customer', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		await expect(
			fixture.service.createSubscription({ customerId: CUSTOMER, items: [{ variantId: VARIANT }] } as never)
		).rejects.toThrow(/must name the plan it is on/);
		await expect(
			fixture.service.createSubscription({ planId: PLAN, items: [{ variantId: VARIANT }] } as never)
		).rejects.toThrow(/must name the customer/);
		expect(fixture.tables.subscription).toEqual([]);
	});

	it('refuses a currency that disagrees with the plan’s, and commits nothing', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		await expect(
			fixture.service.createSubscription({
				planId: PLAN,
				customerId: CUSTOMER,
				currency: 'EUR',
				items: [{ variantId: VARIANT, unitPrice: '120' }]
			})
		).rejects.toThrow(/SUBSCRIPTION_CURRENCY_MISMATCH/);
		expect(fixture.tables.subscription).toEqual([]);
		expect(fixture.commits).toEqual([]);
	});

	it('refuses a plan the catalogue will not sell, and commits nothing', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { isActive: false }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		await expect(
			fixture.service.createSubscription({
				planId: PLAN,
				customerId: CUSTOMER,
				items: [{ variantId: VARIANT, unitPrice: '120' }]
			})
		).rejects.toThrow(/SUBSCRIPTION_PLAN_INACTIVE/);
		expect(fixture.commits).toEqual([]);
	});

	it('refuses a line set that cannot be priced, and commits nothing', async () => {
		// A plan whose catalogue target resolves to a variant supplies the line itself; a plan attached to
		// nothing — a pure service entitlement — has to be told what it delivers.
		const entitlement = subscriptionFixture({
			plans: [planRow(PLAN, { variantId: undefined }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		await expect(
			entitlement.service.createSubscription({ planId: PLAN, customerId: CUSTOMER, items: [] })
		).rejects.toThrow(/SUBSCRIPTION_ITEMS_REQUIRED/);
		expect(entitlement.commits).toEqual([]);

		const unpriced = subscriptionFixture({ subscriptions: [], items: [], billings: [], withPricing: false });

		await expect(
			unpriced.service.createSubscription({
				planId: PLAN,
				customerId: CUSTOMER,
				items: [{ variantId: BETTER_VARIANT }]
			})
		).rejects.toThrow(/SUBSCRIPTION_PRICING_UNAVAILABLE/);
		expect(unpriced.commits).toEqual([]);
	});

	it('prices the first cycle as the sum of its lines less the plan discount, exactly', async () => {
		// A ten-per-cent discount of 99.99 is 9.999, which crosses one boundary to 10.00, leaving 89.99 —
		// the discount is an exact decimal until the currency's scale is reached, and the amount the cycle
		// bills is the discounted one.
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { discountPercentage: '0.1' }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			items: [{ variantId: VARIANT, unitPrice: '99.99' }]
		});
		const [cycle] = fixture.billings(created.id);

		expect(cycle.amount).toBe('89.990000');
		expect(cycle.metadata).toMatchObject({ gross: '99.990000', discount: '10.000000' });
	});

	it('lets a caller state a discount for one subscription only', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { discountPercentage: '0.1' }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			discountPercentage: '0.25',
			items: [{ variantId: VARIANT, unitPrice: '100' }]
		});

		expect(created.metadata).toMatchObject({ discountPercentage: '0.25' });
		expect(fixture.billings(created.id)[0].amount).toBe('75.000000');
	});

	// The defect: a trial's cycle row is written `WAIVED`, which is right, but with the *recurring*
	// amount on it rather than zero. Doc 11 §10.4.4 states the row verbatim: "the first billing amount is
	// zero, the billing row is written with `status = 'WAIVED'` and `amount = 0`". A waived row that
	// carries a hundred and twenty is indistinguishable from revenue to anything that reads `amount`
	// without reading the status first, and a trial exists precisely so that nothing is owed for it.
	// (`subscription.service.ts`: the row's `amount` is zero whenever the period is a trial, and what
	// the period would have cost stays in its metadata.)
	it('writes a trial’s first cycle with nothing on it', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { trialDays: 14 }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			startTrial: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const [cycle] = fixture.billings(created.id);

		expect(cycle.status).toBe(SubscriptionBillingStatus.WAIVED);
		expect(cycle.amount).toBe('0.000000');
		expect(cycle.metadata).toMatchObject({ trial: true });
	});
});

describe('SubscriptionService — activate, pause, resume, cancel, expire (doc 11 §10.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('computes the first paid period from the activation, not from the creation', async () => {
		// "The period is computed from the instant it is activated rather than from creation, so a
		// subscription that sat pending for a week does not inherit a week of period it was never billed
		// for."
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					status: SubscriptionStatus.PENDING,
					currentPeriodStart: new Date('2020-01-01T00:00:00.000Z'),
					currentPeriodEnd: new Date('2020-02-01T00:00:00.000Z'),
					nextBillingAt: new Date('2020-02-01T00:00:00.000Z')
				})
			]
		});

		const activated = await fixture.service.activate(SUBSCRIPTION);

		expect(activated.status).toBe(SubscriptionStatus.ACTIVE);
		expect((activated.currentPeriodStart as Date).getUTCFullYear()).toBeGreaterThan(2020);
		expect(activated.nextBillingAt).toEqual(activated.currentPeriodEnd);
		expect(activated.currentPeriodEnd).toEqual(monthAfter(activated.currentPeriodStart as Date));
		expect(fixture.events.map((event) => event.name)).toEqual(['subscription.activated']);
	});

	it('starts the first paid period when a trial ends, when the trial has not run out yet', async () => {
		const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					status: SubscriptionStatus.PENDING,
					metadata: { trialEndsAt: trialEnd.toISOString() }
				})
			]
		});

		const activated = await fixture.service.activate(SUBSCRIPTION);

		expect(activated.currentPeriodStart).toEqual(trialEnd);
		expect(activated.currentPeriodEnd).toEqual(monthAfter(trialEnd));
	});

	it('activates an already active subscription as a no-op', async () => {
		const fixture = subscriptionFixture();

		const activated = await fixture.service.activate(SUBSCRIPTION);

		expect(activated.status).toBe(SubscriptionStatus.ACTIVE);
		expect(fixture.events).toEqual([]);
	});

	it('refuses to activate a subscription that is not pending', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.CANCELED })]
		});

		await expect(fixture.service.activate(SUBSCRIPTION)).rejects.toThrow(
			/cannot activate; expected PENDING/
		);
	});

	it('pauses billing, for a stated instant or indefinitely', async () => {
		const until = new Date('2026-05-01T00:00:00.000Z');
		const fixture = subscriptionFixture();

		const paused = await fixture.service.pause(SUBSCRIPTION, { until, reason: 'customer asked' });

		expect(paused).toMatchObject({ status: SubscriptionStatus.PAUSED, pausedUntil: until });
		// The period is not consumed: the instant the subscription would have been billed is untouched.
		expect(paused.nextBillingAt).toEqual(APRIL);
		expect(fixture.events[0]).toMatchObject({ name: 'subscription.paused', data: { pausedUntil: until } });

		const indefinitely = subscriptionFixture();
		const open = await indefinitely.service.pause(SUBSCRIPTION);

		expect(open).toMatchObject({ status: SubscriptionStatus.PAUSED, pausedUntil: null });
	});

	it('refuses to pause a subscription that is not active', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })]
		});

		await expect(fixture.service.pause(SUBSCRIPTION)).rejects.toThrow(/cannot pause; expected ACTIVE/);
	});

	it('resumes with the next billing instant at the later of now and the period already paid for', async () => {
		// Doc 11 §10.7: "`pausedUntil` cleared; `nextBillingAt = max(now, currentPeriodEnd)`" — a pause
		// never refunds time and never charges twice for it.
		const paidFor = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: MARCH })]
		});
		const at = new Date(MARCH);

		const early = await paidFor.service.resume(SUBSCRIPTION, at);

		expect(early).toMatchObject({ status: SubscriptionStatus.ACTIVE, pausedUntil: null, nextBillingAt: APRIL });

		const overdue = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: MARCH })]
		});
		const after = new Date('2026-05-15T00:00:00.000Z');

		const late = await overdue.service.resume(SUBSCRIPTION, after);

		expect(late.nextBillingAt).toEqual(after);
	});

	it('refuses to resume a subscription that is not paused', async () => {
		const fixture = subscriptionFixture();

		await expect(fixture.service.resume(SUBSCRIPTION)).rejects.toThrow(/cannot resume; expected PAUSED/);
	});

	it('cancels at the end of the period by default, keeping the period the customer paid for', async () => {
		const fixture = subscriptionFixture();

		const canceled = await fixture.service.cancel(SUBSCRIPTION, { reason: 'too expensive' });

		expect(canceled).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			cancelReason: 'too expensive',
			nextBillingAt: APRIL
		});
		expect(canceled.metadata).toMatchObject({ cancelAtPeriodEnd: true });
		expect(canceled.canceledAt).toBeInstanceOf(Date);
	});

	it('cancels immediately when the caller asks for it', async () => {
		const fixture = subscriptionFixture();

		const canceled = await fixture.service.cancel(SUBSCRIPTION, { immediate: true });

		expect(canceled).toMatchObject({ status: SubscriptionStatus.CANCELED, nextBillingAt: null, pausedUntil: null });
		expect(canceled.metadata?.['cancelAtPeriodEnd']).toBeUndefined();
	});

	it('treats cancelling a canceled or expired subscription as a no-op', async () => {
		// "Cancelling an expired or already cancelled subscription is a no-op that returns the row, because
		// the outcome the caller wanted has already happened."
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('canceled', { status: SubscriptionStatus.CANCELED }),
				subscriptionRow('expired', { status: SubscriptionStatus.EXPIRED })
			]
		});

		await expect(fixture.service.cancel('canceled')).resolves.toMatchObject({
			status: SubscriptionStatus.CANCELED
		});
		await expect(fixture.service.cancel('expired')).resolves.toMatchObject({ status: SubscriptionStatus.EXPIRED });
		expect(fixture.events).toEqual([]);
	});

	it('expires a subscription and refuses one that was cancelled, which was a decision', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('live'),
				subscriptionRow('canceled', { status: SubscriptionStatus.CANCELED }),
				subscriptionRow('expired', { status: SubscriptionStatus.EXPIRED })
			]
		});

		const expired = await fixture.service.expire('live', 'MAX_BILLING_CYCLES_REACHED');

		expect(expired).toMatchObject({ status: SubscriptionStatus.EXPIRED, nextBillingAt: null, pausedUntil: null });
		await expect(fixture.service.expire('canceled')).rejects.toThrow(/cannot expire/);
		// An already expired subscription is answered with itself rather than refused.
		await expect(fixture.service.expire('expired')).resolves.toMatchObject({ status: SubscriptionStatus.EXPIRED });
	});
});

describe('SubscriptionService — plan changes and proration (doc 11 §10.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.useFakeTimers({
			now: MID_MARCH,
			// Only the calendar is frozen: the promise machinery the suite runs on is left alone.
			doNotFake: [
				'hrtime',
				'nextTick',
				'performance',
				'queueMicrotask',
				'requestAnimationFrame',
				'cancelAnimationFrame',
				'requestIdleCallback',
				'cancelIdleCallback',
				'setImmediate',
				'clearImmediate',
				'setInterval',
				'clearInterval',
				'setTimeout',
				'clearTimeout'
			]
		});
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('settles an upgrade by the specification’s own worked example', async () => {
		// Doc 11 §10.8, verbatim: a subscription billing monthly at 120.00 EUR with a period from 1 March
		// to 1 April, upgraded on 16 March to a plan costing 300.00 a month, gives `credit = 61.94`,
		// `charge = 154.84` and `net = 92.90`, charged immediately. The period boundaries are unchanged,
		// "which keeps the billing calendar stable and makes the arithmetic reproducible from persisted
		// rows alone".
		const fixture = subscriptionFixture({ prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' } });

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(outcome).toMatchObject({
			credit: '61.940000',
			charge: '154.840000',
			net: '92.900000',
			settlement: 'CHARGED',
			currency: 'USD'
		});
		expect(fixture.prorationCalls).toHaveLength(1);
		expect(fixture.prorationCalls[0]).toMatchObject({ amount: '92.900000', subscriptionId: SUBSCRIPTION });
		// The calendar is not rewritten by a change; the new price applies from the next renewal.
		expect(outcome.subscription).toMatchObject({ currentPeriodStart: MARCH, currentPeriodEnd: APRIL, planId: BETTER_PLAN });
	});

	it('waives a difference that is not worth collecting, at the exact threshold and below it', async () => {
		// Doc 11 §10.8: `0 < net <= minimumProrationCharge` — "the amount is waived (transaction cost
		// exceeds value) and recorded in `metadata.waivedProrations[]`". The boundary belongs to the
		// waived side: the rule is `net > minimum`, not `>=`.
		const atThreshold = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { minimumProrationCharge: '92.90' } })]
		});
		const below = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { minimumProrationCharge: '1000' } })]
		});

		const waivedAtThreshold = await atThreshold.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });
		const waivedBelow = await below.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(waivedAtThreshold).toMatchObject({ net: '92.900000', settlement: 'WAIVED' });
		expect(waivedAtThreshold.subscription.metadata?.['waivedProrations']).toEqual([
			expect.objectContaining({ amount: '92.900000', currency: 'USD' })
		]);
		expect(waivedBelow).toMatchObject({ net: '92.900000', settlement: 'WAIVED' });
		expect(atThreshold.prorationCalls).toEqual([]);
		expect(below.prorationCalls).toEqual([]);
	});

	it('charges one storage unit past the threshold', async () => {
		// The other side of the boundary above: a minimum one unit lower than the difference is collected.
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { minimumProrationCharge: '92.89' } })]
		});

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(outcome).toMatchObject({ settlement: 'CHARGED', net: '92.900000' });
		expect(fixture.prorationCalls).toHaveLength(1);
	});

	it('turns a downgrade into a credit against the next cycle, with no money moving now', async () => {
		// Doc 11 §10.8: `net <= 0` — "no money moves now. A `adjustment` of type `CREDIT` ... is attached to
		// the **next** billing order."
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '60.00' },
			billings: [
				{
					id: 'cycle-march',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(MARCH),
					periodEnd: new Date(APRIL),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					attemptCount: 1
				}
			]
		});

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(outcome).toMatchObject({ credit: '61.940000', charge: '30.970000', net: '-30.970000', settlement: 'DEFERRED' });
		expect(outcome.subscription.metadata?.['pendingCredit']).toMatchObject({
			amount: '-30.970000',
			currency: 'USD'
		});
		expect(fixture.adjustmentsOf('cycle-march')).toEqual([
			expect.objectContaining({
				ownerType: AdjustmentOwnerType.SUBSCRIPTION_BILLING,
				type: AdjustmentType.CREDIT,
				amount: '-30.970000',
				referenceId: SUBSCRIPTION
			})
		]);
		expect(fixture.prorationCalls).toEqual([]);
	});

	it('schedules a change the caller wants from the next period, with no proration at all', async () => {
		// "`effective = 'NEXT_PERIOD'` — no proration at all: the change is scheduled in
		// `metadata.scheduledPlanChange = { planId, effectiveAt: periodEnd}`."
		const fixture = subscriptionFixture({ prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' } });

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, {
			planId: BETTER_PLAN,
			effective: 'NEXT_PERIOD',
			note: 'move at renewal'
		});

		expect(outcome).toMatchObject({ settlement: 'SCHEDULED', credit: '0.000000', charge: '0.000000', net: '0.000000' });
		expect(outcome.subscription.metadata?.['scheduledPlanChange']).toMatchObject({
			planId: BETTER_PLAN,
			effectiveAt: APRIL,
			description: 'move at renewal'
		});
		// The plan itself has not moved yet: the new price applies from the period the change takes hold in.
		expect(outcome.subscription.planId).toBe(PLAN);
		expect(fixture.prorationCalls).toEqual([]);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('refuses to charge a difference with no order capability registered, and commits nothing', async () => {
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			withOrder: false
		});

		await expect(fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN })).rejects.toThrow(
			/SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE/
		);
		expect(fixture.subscription(SUBSCRIPTION)?.planId).toBe(PLAN);
	});

	it('refuses a change that cannot be settled because the payer may not be charged', async () => {
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { paymentAccountHolderId: null, paymentMethodTokenId: null })
			],
			withInstruments: false
		});

		await expect(fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN })).rejects.toThrow(
			/SUBSCRIPTION_PAYMENT_METHOD_MISSING/
		);
	});

	it('refuses an identical change another worker is already settling', async () => {
		// The charge is claimed under a key derived from the change itself, so a second arrival of the same
		// change inside the period is refused rather than charged a second time.
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' },
			inFlightOnNewKey: true
		});

		await expect(fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN })).rejects.toThrow(
			/SUBSCRIPTION_PRORATION_IN_FLIGHT/
		);
		expect(fixture.prorationCalls).toEqual([]);
	});

	it('settles two different changes in one period on their own account', async () => {
		// The key is derived from the change, not from the moment the request arrived: a different change in
		// the same period is not answered with the first one's claim.
		const fixture = subscriptionFixture({ prices: { [VARIANT]: '120.00', 'variant-c': '10.00' } });

		const added = await fixture.service.addItem(SUBSCRIPTION, { variantId: 'variant-c', unitPrice: '10' });
		const changed = await fixture.service.changeItemQuantity(SUBSCRIPTION, VARIANT, '2');

		expect(added.settlement).toBe('CHARGED');
		expect(changed.settlement).toBe('CHARGED');
		expect(fixture.prorationCalls).toHaveLength(2);
		expect(fixture.prorationCalls[0].amount).not.toBe(fixture.prorationCalls[1].amount);
		expect(fixture.prorationCalls[0].idempotencyKey).not.toBe(fixture.prorationCalls[1].idempotencyKey);

		// And the lines the changes produced are the ones the next cycle will bill.
		expect(fixture.items().map((line) => [line.variantId, line.quantity])).toEqual([
			[VARIANT, '2.000000'],
			['variant-c', '1.000000']
		]);
	});

	it('refuses a change on a subscription nobody may change any more', async () => {
		// "A subscription in status ... cannot be changed; reactivate it as a new subscription instead."
		for (const status of [SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED]) {
			const fixture = subscriptionFixture({ subscriptions: [subscriptionRow(SUBSCRIPTION, { status })] });

			await expect(fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN })).rejects.toThrow(
				/cannot be changed; reactivate it as a new subscription instead/
			);
			await expect(fixture.service.addItem(SUBSCRIPTION, { variantId: 'variant-c' })).rejects.toThrow(
				/cannot be changed/
			);
		}
	});

	it('refuses a line change on a variant the subscription does not carry, and refuses to empty it', async () => {
		const fixture = subscriptionFixture({
			items: [itemRow('item-1'), itemRow('item-2', { variantId: 'variant-c', position: 1 })]
		});

		await expect(fixture.service.changeItemQuantity(SUBSCRIPTION, 'nothing', '1')).rejects.toThrow(
			/SUBSCRIPTION_ITEM_NOT_FOUND/
		);
		await expect(fixture.service.removeItem(SUBSCRIPTION, 'nothing')).rejects.toThrow(
			/SUBSCRIPTION_ITEM_NOT_FOUND/
		);
		// One line left: removing it would leave a subscription that bills nothing.
		await fixture.service.removeItem(SUBSCRIPTION, 'variant-c');
		await expect(fixture.service.removeItem(SUBSCRIPTION, VARIANT)).rejects.toThrow(/SUBSCRIPTION_LAST_ITEM/);
	});

	it('re-states the discount on a plan change rather than inheriting the old plan’s', async () => {
		// "A plan change re-states the discount: the new plan's terms replace whatever the old one was sold
		// with, and a plan that grants none must not inherit the previous one's."
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { discountPercentage: '0.5' }), planRow(BETTER_PLAN)],
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { discountPercentage: '0.5' } })],
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' }
		});

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(outcome.subscription.metadata?.['discountPercentage']).toBeUndefined();
	});
});

describe('SubscriptionService — billing one cycle (doc 11 §10.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises the cycle’s order, marks it paid and rolls the calendar from the period', async () => {
		// "`nextBillingAt += one period` computed from the **period start**, not from the moment the job
		// ran (so drift never accumulates)" — a run six hours late produces the same calendar as one on time.
		const fixture = subscriptionFixture();
		const late = new Date(APRIL.getTime() + 6 * 60 * 60 * 1000);

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: late });

		expect(outcome).toMatchObject({
			subscriptionId: SUBSCRIPTION,
			status: SubscriptionBillingStatus.PAID,
			replayed: false,
			amount: '120.000000',
			currency: 'USD'
		});
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.orderCalls[0]).toMatchObject({
			subscriptionId: SUBSCRIPTION,
			firstCycle: true,
			amount: '120.000000',
			currency: 'USD',
			lines: [{ variantId: VARIANT, quantity: '1.000000', unitPrice: '120.000000' }]
		});

		const subscription = fixture.subscription(SUBSCRIPTION);

		expect(subscription).toMatchObject({ status: SubscriptionStatus.ACTIVE, billingCycleCount: 1 });
		expect(subscription?.currentPeriodStart).toEqual(APRIL);
		expect(subscription?.currentPeriodEnd).toEqual(monthAfter(APRIL));
		// The calendar follows the period, not the run: a late run does not shift every later period.
		expect(subscription?.nextBillingAt).toEqual(monthAfter(APRIL));
		expect(fixture.events.map((event) => event.name)).toEqual(['subscription.renewed']);
	});

	it('records a cycle whose money has not settled as invoiced', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION);

		expect(outcome.status).toBe(SubscriptionBillingStatus.INVOICED);
		expect(fixture.cycle(APRIL)?.paidAt ?? null).toBeNull();
	});

	it('bills one period once, replaying the settled cycle rather than recomputing it', async () => {
		// The store is empty — the process restarted, or the claim has aged out — but the row says the
		// period was billed. Recomputing it would be a second answer to a question the row has already
		// answered, and acting on that answer is how a customer is charged twice.
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-billed',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: monthAfter(APRIL),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					orderId: 'order-earlier',
					paidAt: new Date(APRIL),
					attemptCount: 1
				}
			]
		});

		// The price moved after the fact; what was charged must not move with it.
		fixture.tables.subscription_item[0].unitPrice = '999.000000';

		const replayed = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(replayed).toMatchObject({
			replayed: true,
			billingId: 'cycle-billed',
			amount: '120.000000',
			orderId: 'order-earlier',
			status: SubscriptionBillingStatus.PAID
		});
		expect(fixture.orderCalls).toEqual([]);
		expect(fixture.billings()).toHaveLength(1);
	});

	it('refuses a cycle whose key was used with a different request', async () => {
		// The per-period key is claimed once; a second request for the same period that is not the same
		// request is a fault rather than a retry.
		const fixture = subscriptionFixture();
		const claim = await fixture.idempotencyService.claim({
			scope: 'subscription.bill',
			key: `${SUBSCRIPTION}:${APRIL.toISOString()}`,
			requestHash: 'a-different-request'
		});

		await fixture.idempotencyService.complete(claim.record, { responseStatus: 200, responseBody: {} });

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow(
			/SUBSCRIPTION_BILL_KEY_REUSED/
		);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('reports a period another pass is holding, and starts nothing', async () => {
		const fixture = subscriptionFixture({ inFlightOnNewKey: true });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.PENDING,
			replayed: false,
			message: /Another billing pass holds this period/
		});
		expect(fixture.orderCalls).toEqual([]);
	});

	it('does not bill a cancelled or expired subscription', async () => {
		for (const status of [SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED]) {
			const fixture = subscriptionFixture({ subscriptions: [subscriptionRow(SUBSCRIPTION, { status })] });

			const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: false });
			expect(outcome.billingId).toBeUndefined();
			expect(fixture.billings()).toEqual([]);
			expect(fixture.orderCalls).toEqual([]);
		}
	});

	it('does not consume a paused subscription’s period, and resumes it once the pause runs out', async () => {
		// "The billing run skips a paused subscription, and resuming recomputes the next billing instant
		// from the resume rather than back-dating it."
		const paused = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: new Date('2026-05-01T00:00:00.000Z') })]
		});

		const skipped = await paused.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(skipped).toMatchObject({ replayed: false, message: /paused, so the period is not consumed/ });
		expect(paused.billings()).toEqual([]);
		expect(paused.orderCalls).toEqual([]);

		const elapsed = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: new Date('2026-03-15T00:00:00.000Z') })]
		});

		const resumed = await elapsed.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(resumed.status).toBe(SubscriptionBillingStatus.PAID);
		expect(elapsed.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.ACTIVE);
		expect(elapsed.events.map((event) => event.name)).toEqual(['subscription.resumed', 'subscription.renewed']);
	});

	it('cancels at the end of the period it had already paid for, and bills nothing', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					metadata: { cancelAtPeriodEnd: true },
					cancelReason: 'not needed any more'
				})
			]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: false });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.CANCELED,
			cancelReason: 'not needed any more'
		});
		expect(fixture.billings()).toEqual([]);
	});

	it('does not open a cycle before the period it was cancelled at has ended', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true } })]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: MARCH });

		// The period is still running, so the cycle it pays for is billed as usual.
		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.ACTIVE);
	});

	it('expires the subscription instead of scheduling another cycle at the plan’s ceiling', async () => {
		// "when `billingCycleCount >= plan.maxBillingCycles`, no new billing is created and the
		// subscription becomes `EXPIRED`" (doc 11 §10.5).
		const reached = subscriptionFixture({
			plans: [planRow(PLAN, { maxBillingCycles: 3 }), planRow(BETTER_PLAN)],
			subscriptions: [subscriptionRow(SUBSCRIPTION, { billingCycleCount: 3 })]
		});

		const outcome = await reached.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: false });
		expect(outcome.message).toMatch(/bills at most 3 cycles/);
		expect(reached.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.EXPIRED, nextBillingAt: null });
		expect(reached.billings()).toEqual([]);
	});

	it('expires the subscription on the cycle that reaches the ceiling', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { maxBillingCycles: 1 }), planRow(BETTER_PLAN)],
			subscriptions: [subscriptionRow(SUBSCRIPTION, { billingCycleCount: 0 })]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.EXPIRED,
			billingCycleCount: 1,
			nextBillingAt: null
		});
		expect(fixture.events.map((event) => event.name)).toEqual(['subscription.renewed', 'subscription.expired']);
	});

	it('refuses to price a cycle for a subscription with no recurring lines', async () => {
		const fixture = subscriptionFixture({ items: [] });

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow(
			/SUBSCRIPTION_ITEMS_REQUIRED/
		);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('fails the cycle rather than marking it paid when no order capability is registered', async () => {
		const fixture = subscriptionFixture({ withOrder: false });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			replayed: false,
			errorCode: 'SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE'
		});
		expect(fixture.cycle(APRIL)?.status).toBe(SubscriptionBillingStatus.FAILED);
		expect(fixture.cycle(APRIL)?.paidAt).toBeNull();
	});
});

describe('SubscriptionService — a failure is a state, not an exception (doc 11 §10.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** A gateway that fails a stated number of times and then succeeds, as a real dunning run would. */
	const refusingGateway = (failures: number) => {
		let attempts = 0;

		return () => {
			attempts += 1;

			if (attempts <= failures) {
				throw new Error(`SUBSCRIPTION_CHARGE_DECLINED: attempt ${attempts} was declined`);
			}

			return { orderId: `order-${attempts}`, paid: true };
		};
	};

	it('records the declined attempt, its retry instant and moves the subscription into dunning', async () => {
		// Doc 11 §10.6: attempt 1 is T+0, attempt 2 is T+1 day. The subscription stays `ACTIVE` and is owed
		// the same period, "so the calendar does not move".
		const fixture = subscriptionFixture({ orders: refusingGateway(1) });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			replayed: false,
			errorCode: 'SUBSCRIPTION_CHARGE_DECLINED'
		});
		expect(outcome.nextRetryAt).toEqual(new Date(APRIL.getTime() + 24 * 60 * 60 * 1000));

		const cycle = fixture.cycle(APRIL);

		expect(cycle).toMatchObject({ attemptCount: 1, nextRetryAt: outcome.nextRetryAt, paidAt: null });
		expect(cycle?.lastError).toMatch(/attempt 1 was declined/);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: APRIL
		});
		expect(fixture.events.map((event) => event.name)).toEqual(['subscription.payment-failed']);
	});

	it('does not attempt the next charge before the dunning schedule says so', async () => {
		// The retry instant lives on the cycle's own row, and the subscription is still selected by the due
		// scan — so the pass has to respect the row rather than the calendar. The lock the failed attempt
		// left behind has aged out by then, which is what lets the next attempt take the period over.
		const fixture = subscriptionFixture({ orders: refusingGateway(1) });

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });
		fixture.idempotencyService.advanceBy(5 * 60 * 1000);

		const tooEarly = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The retry instant has come round, and by then the lock the previous attempt left is stale again.
		fixture.idempotencyService.advanceBy(24 * 60 * 60 * 1000);

		const whenDue = await fixture.service.billCycle(SUBSCRIPTION, {
			asOf: new Date(APRIL.getTime() + 24 * 60 * 60 * 1000)
		});

		expect(tooEarly).toMatchObject({ replayed: true });
		expect(tooEarly.message).toMatch(/dunning schedule has not reached/);
		expect(fixture.orderCalls).toHaveLength(2);
		expect(whenDue.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.cycle(APRIL)?.status).toBe(SubscriptionBillingStatus.PAID);
		// One period, one row, however many attempts it took.
		expect(fixture.billings()).toHaveLength(1);
	});

	it('lets an operator attempt the charge regardless of the schedule', async () => {
		// "a manual attempt ignores the dunning schedule, which is what makes 'retry this now' possible".
		const fixture = subscriptionFixture({ orders: refusingGateway(1) });

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });
		fixture.idempotencyService.advanceBy(5 * 60 * 1000);

		const retried = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true });

		expect(retried.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.billings()).toHaveLength(1);
	});

	it('spends the schedule over five attempts and then stops billing automatically', async () => {
		// Doc 11 §10.6: the gaps between attempts are 0, 1, 3, 5 and 7 days measured from the failure, so
		// each attempt's instant is the one the previous attempt's own row states — and after attempt 5 the
		// billing row is terminal, the subscription is `FAILED`, and nothing further is attempted until an
		// operator acts.
		const fixture = subscriptionFixture({ orders: refusingGateway(99) });
		let at = new Date(APRIL);

		for (let attempt = 1; attempt <= 5; attempt += 1) {
			const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: at });
			const cycle = fixture.cycle(APRIL);

			expect(outcome.status).toBe(SubscriptionBillingStatus.FAILED);
			expect(cycle?.attemptCount).toBe(attempt);

			if (attempt < 5) {
				const nextRetryAt = cycle?.nextRetryAt as Date;

				expect(outcome.nextRetryAt).toEqual(nextRetryAt);
				// Time passes to the instant the row says the next attempt is owed; by then the failed
				// attempt's lock has aged out and the period can be taken over.
				fixture.idempotencyService.advanceBy(nextRetryAt.getTime() - at.getTime());
				at = nextRetryAt;
			}
		}

		const cycle = fixture.cycle(APRIL);

		expect(cycle).toMatchObject({ attemptCount: 5, nextRetryAt: null, status: SubscriptionBillingStatus.FAILED });
		// Five attempts, one period, one row: the attempt history is the row's own.
		expect(fixture.billings()).toHaveLength(1);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.FAILED,
			nextBillingAt: null
		});
		expect(fixture.orderCalls).toHaveLength(5);

		// And the spent subscription is not selected by a later pass at all: `FAILED` is the state that says
		// "billed again only on an operator's word", and the scheduled scan reads the statuses that are
		// still owed an attempt.
		const later = new Date(at.getTime() + 30 * 24 * 60 * 60 * 1000);

		fixture.idempotencyService.advanceBy(30 * 24 * 60 * 60 * 1000);

		expect((await fixture.service.findDue(later, 10)).map((row) => row.id)).toEqual([]);
		expect(await fixture.service.runBilling({ asOf: later })).toMatchObject({ examined: 0 });
		expect(fixture.orderCalls).toHaveLength(5);
		expect(fixture.billings()).toHaveLength(1);
	});

	it('never marks a cycle paid when the instrument may not be charged', async () => {
		// Doc 11 §10.6 recovery aside, a subscription whose resolved instrument is not usable has to fail
		// into dunning "rather than silently skipping the period" — and never to look settled.
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { paymentAccountHolderId: null, paymentMethodTokenId: null })],
			withInstruments: false
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			errorCode: 'SUBSCRIPTION_PAYMENT_METHOD_MISSING'
		});
		expect(fixture.cycle(APRIL)?.paidAt).toBeNull();
		expect(fixture.orderCalls).toEqual([]);
	});

	it('reports an unusable instrument with the cycle’s own payer code, which is what dunning keys on', async () => {
		// A revoked — or expired, or missing — instrument is terminal: the customer has to supply
		// another one, and the code that action is keyed on is this domain's own (doc 10, "the
		// instrument becomes unusable while a subscription points at it"). The capability's own code for
		// the same guard names the row it read rather than the action the customer takes, so it is not
		// what enters dunning or triggers the "update your payment method" notification.
		const fixture = subscriptionFixture({
			instrumentRefusal: { reasonCode: 'PAYMENT_METHOD_TOKEN_REVOKED', reason: 'the card was removed' }
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			errorCode: 'SUBSCRIPTION_PAYMENT_METHOD_MISSING',
			message: 'the card was removed'
		});
		expect(fixture.orderCalls).toEqual([]);
	});

	it('fails the cycle with the capability’s own reason when the remembered payer is refused', async () => {
		const fixture = subscriptionFixture({
			instrumentRefusal: { reasonCode: 'PAYMENT_INSTRUMENT_REVOKED', reason: 'the card was removed' }
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			errorCode: 'PAYMENT_INSTRUMENT_REVOKED',
			message: 'the card was removed'
		});
		expect(fixture.orderCalls).toEqual([]);
	});

	it('fails a subscription that remembers no payer with its own code, without asking the capability', async () => {
		// The registered capability is a different case from the absent one, and it must not change the
		// answer: a subscription that names no payer has nothing for a capability to resolve, and the
		// refusal the customer and the dunning schedule see is `SUBSCRIPTION_PAYMENT_METHOD_MISSING`
		// (doc 11 §10.5 step 1) — not whatever a resolver answers about a row it was never given.
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { paymentAccountHolderId: null, paymentMethodTokenId: null })]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			errorCode: 'SUBSCRIPTION_PAYMENT_METHOD_MISSING'
		});
		expect(fixture.instrumentCalls).toEqual([]);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('asks the capability for a payer the subscription does remember', async () => {
		// The other half of the case above: when the subscription does name a payer, the capability is
		// the thing that decides whether it may still be charged, and it is asked with what is stored.
		const fixture = subscriptionFixture({});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.instrumentCalls).toHaveLength(1);
		expect(fixture.instrumentCalls[0]).toMatchObject({ accountHolderId: HOLDER, paymentMethodTokenId: TOKEN });
	});
});

describe('SubscriptionService — the adjustments a cycle carries (doc 11 §10.8, §10.10)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('charges a plan’s setup fee on the first cycle and remembers that it did', async () => {
		// Doc 11 §10.4.5: "Charged on the first *paid* billing, never on a trial period and never on
		// renewals, tracked by `metadata.chargedSetupFeePlanIds`."
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { setupFee: '49.99' }), planRow(BETTER_PLAN)]
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.orderCalls[0]).toMatchObject({ setupFee: '49.990000', firstCycle: true });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);

		// The second cycle is a renewal, and the fee is not charged again.
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: monthAfter(APRIL) });

		expect(fixture.orderCalls[1].setupFee).toBeUndefined();
	});

	it('applies a deferred credit to the next cycle, once, and clears it', async () => {
		// Doc 11 §10.10 and §10.8: a credit "is attached to the **next** billing order. Credits are consumed
		// before any payment is attempted". It is an adjustment on the cycle rather than a smaller amount,
		// so the reduction stays visible in the ledger.
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					metadata: { pendingCredit: { amount: '-30.970000', currency: 'USD' } }
				})
			]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.orderCalls[0]).toMatchObject({ amount: '120.000000', creditAmount: '-30.970000' });
		expect(fixture.adjustmentsOf(fixture.cycle(APRIL)?.id)).toEqual([
			expect.objectContaining({ type: AdjustmentType.CREDIT, amount: '-30.970000', currency: 'USD' })
		]);
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toBeUndefined();
	});

	it('grants the plan’s discount as an adjustment on the cycle, once', async () => {
		// Doc 11 §10.10: the discount "is applied **first**, as a `adjustment` of type `PROMOTION` ... on
		// each recurring order". Appending it twice would double it — and a dunning retry lands on the same
		// period's row, so the second attempt must find the discount already there.
		let attempt = 0;
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { discountPercentage: '0.1' }), planRow(BETTER_PLAN)],
			orders: () => {
				attempt += 1;

				if (attempt === 1) {
					throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
				}

				return { orderId: `order-${attempt}`, paid: true };
			}
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		const cycleId = fixture.cycle(APRIL)?.id;

		expect(fixture.adjustmentsOf(cycleId)).toEqual([
			expect.objectContaining({
				type: AdjustmentType.PROMOTION,
				amount: '-12.000000',
				referenceType: 'subscription-plan',
				referenceId: PLAN
			})
		]);

		// The retry is a day later, when the failed attempt's lock has aged out and the period is owed
		// another attempt.
		fixture.idempotencyService.advanceBy(24 * 60 * 60 * 1000);

		const retried = await fixture.service.billCycle(SUBSCRIPTION, {
			asOf: new Date(APRIL.getTime() + 24 * 60 * 60 * 1000)
		});

		expect(retried.status).toBe(SubscriptionBillingStatus.PAID);
		expect(retried.amount).toBe('108.000000');
		expect(fixture.orderCalls[1]).toMatchObject({ amount: '108.000000', discountAmount: '12.000000' });
		expect(fixture.adjustmentsOf(cycleId)).toHaveLength(1);
		expect(fixture.billings()).toHaveLength(1);
	});

	it('states the lines and the payer the ordinary order path needs, and writes no order itself', async () => {
		// Rule 3 of the class: "This domain states the recurring lines and the payer and receives an order
		// back; it writes no order, payment or stock row itself."
		const fixture = subscriptionFixture();

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.orderCalls[0]).toMatchObject({
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			periodStart: APRIL,
			note: expect.stringContaining('attempt 1')
		});
		// The order path's key moves with the attempt, so a retry is not answered with the decline it is
		// trying to recover from; the per-period key is what the cycle's own claim holds.
		expect(fixture.orderCalls[0].idempotencyKey).toBe(`${SUBSCRIPTION}:${APRIL.toISOString()}:1`);
		// The only rows this domain wrote are its own.
		expect(Object.keys(fixture.tables).every((table) => table.startsWith('subscription'))).toBe(true);
	});
});

describe('SubscriptionService — the billing run and the due scan (doc 11 §10.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('bills every subscription whose instant has passed and reports what the pass did', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('due', { nextBillingAt: new Date(MARCH) }),
				subscriptionRow('not-due', { nextBillingAt: new Date('2026-06-01T00:00:00.000Z') })
			],
			items: [itemRow('item-1', { subscriptionId: 'due' })],
			billings: []
		});

		const run = await fixture.service.runBilling({ asOf: APRIL });

		expect(run).toMatchObject({ examined: 1, billed: 1, failed: 0, skipped: 0 });
		expect(run.results[0]).toMatchObject({ subscriptionId: 'due', status: SubscriptionBillingStatus.PAID });
	});

	it('does not abandon the pass when one subscription cannot be billed', async () => {
		// "One subscription that cannot be billed must not abandon the pass: the rest of the tenants' due
		// cycles are owed their attempt, and the failure is reported as this subscription's outcome rather
		// than as the run's."
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('unpriceable', { nextBillingAt: new Date(MARCH) }),
				subscriptionRow('billable', { nextBillingAt: new Date(MARCH) })
			],
			// The first subscription has no lines, so its cycle cannot be priced.
			items: [itemRow('item-1', { subscriptionId: 'billable' })],
			billings: []
		});

		const run = await fixture.service.runBilling({ asOf: APRIL });

		expect(run.examined).toBe(2);
		expect(run.billed).toBe(1);
		// The other subscription's outcome is the failure, and the pass went on to bill the one behind it.
		expect(run.results.find((result) => result.subscriptionId === 'unpriceable')).toMatchObject({
			status: SubscriptionBillingStatus.FAILED,
			errorCode: 'SUBSCRIPTION_ITEMS_REQUIRED'
		});
		expect(run.results.find((result) => result.subscriptionId === 'billable')).toMatchObject({
			status: SubscriptionBillingStatus.PAID
		});
		expect(run.billed + run.failed + run.skipped).toBe(run.examined);
	});

	it('restricts a pass to one subscription when an operator names one', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('due', { nextBillingAt: new Date(MARCH) }),
				subscriptionRow('also-due', { nextBillingAt: new Date(MARCH) })
			],
			items: [
				itemRow('item-1', { subscriptionId: 'due' }),
				itemRow('item-2', { subscriptionId: 'also-due' })
			],
			billings: []
		});

		const run = await fixture.service.runBilling({ asOf: APRIL, subscriptionId: 'also-due' });

		expect(run.examined).toBe(1);
		expect(run.results[0].subscriptionId).toBe('also-due');
		expect(fixture.billings('due')).toEqual([]);
	});

	it('selects the subscriptions a pass must examine, oldest instant first', async () => {
		// "`subscription` where `status = 'ACTIVE'` and `nextBillingAt <= now()`, and where
		// `status = 'PAUSED'` and `pausedUntil <= now()` (these resume)" (doc 11 §10.5).
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('later', { nextBillingAt: new Date('2026-03-20T00:00:00.000Z') }),
				subscriptionRow('earlier', { nextBillingAt: new Date('2026-03-10T00:00:00.000Z') }),
				subscriptionRow('paused-due', {
					status: SubscriptionStatus.PAUSED,
					pausedUntil: new Date('2026-03-15T00:00:00.000Z'),
					nextBillingAt: new Date('2026-06-01T00:00:00.000Z')
				}),
				subscriptionRow('paused-open', {
					status: SubscriptionStatus.PAUSED,
					pausedUntil: null,
					nextBillingAt: null
				}),
				subscriptionRow('canceled', { status: SubscriptionStatus.CANCELED, nextBillingAt: null }),
				subscriptionRow('not-due', { nextBillingAt: new Date('2026-09-01T00:00:00.000Z') })
			]
		});

		const due = await fixture.service.findDue(APRIL, 10);

		// Doc 11 §10.5: the pass is "batched (default 200) ordered by `nextBillingAt`" — a paused
		// subscription that is due to resume is ordered by the same key, not by the instant it paused.
		expect(due.map((row) => row.id)).toEqual(['earlier', 'later', 'paused-due']);
		expect((await fixture.service.findDue(APRIL, 2)).map((row) => row.id)).toEqual(['earlier', 'later']);
	});

	it('reads across tenants when there is no request in context', async () => {
		// The scheduled run has no tenant in context and reads across tenants deliberately, one
		// subscription at a time, and writes each row with the tenant it read (`subscription.scope.ts`).
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('mine', { nextBillingAt: new Date(MARCH) }),
				subscriptionRow('theirs', { nextBillingAt: new Date(MARCH), organizationId: 'another-organization' })
			],
			items: [],
			billings: []
		});

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		expect((await fixture.service.findDue(APRIL, 10)).map((row) => row.id)).toEqual(['mine', 'theirs']);
	});

	it('reports a settled cycle as skipped rather than billed', async () => {
		// A pass that found a period already settled did not bill anything, and counting it as billed would
		// overstate what the run did.
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-settled',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: monthAfter(APRIL),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					orderId: 'order-earlier',
					paidAt: new Date(APRIL),
					attemptCount: 1
				}
			]
		});

		const run = await fixture.service.runBilling({ asOf: APRIL });

		expect(run).toMatchObject({ examined: 1, billed: 0, failed: 0, skipped: 1 });
		expect(run.results[0]).toMatchObject({ replayed: true, billingId: 'cycle-settled' });
		expect(fixture.orderCalls).toEqual([]);
	});
});

describe('SubscriptionService — the reads a detail view is built from', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads a subscription with its lines and its billing history', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-march',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(MARCH),
					periodEnd: new Date(APRIL),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					attemptCount: 1
				}
			]
		});

		const detailed = await fixture.service.findOneDetailed(SUBSCRIPTION);

		expect(detailed.items).toHaveLength(1);
		expect(detailed.billings).toHaveLength(1);
		expect((await fixture.service.findBillings(SUBSCRIPTION)).map((cycle) => cycle.id)).toEqual(['cycle-march']);
	});

	it('refuses a subscription of another organization, an unknown one, and one that is not there', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('theirs', { organizationId: 'another-organization' }),
				subscriptionRow('deleted', { deletedAt: new Date() })
			]
		});

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('deleted')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findBillings('no-such-subscription')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The versioned write.
 *
 * A subscription carries an optimistic lock, and this suite pins what the lock is for: the write a
 * route performs is predicated on the version its caller read, in the same statement that increments
 * it, so a change based on a subscription that has moved on is refused with a conflict rather than
 * applied over a value nobody saw. It pins the other half of the convention too: the writes a request
 * makes after its first one are the request's own follow-up, so they ride the version the row holds
 * rather than reporting the request's own increment as a race it lost.
 *
 * The conditional update is the platform's real `commitVersionedUpdate`, driven over the in-memory
 * repository, so a case is a statement about the row that was written and the count the statement
 * reported rather than about a call log.
 */
describe('SubscriptionService — the versioned write', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The fixture's subscription row is at version one, and this is the expectation that accepts it. */
	const asReadByTheCaller: IVersionExpectation = { wildcard: false, versions: [1] };

	it('refuses a write predicated on a version the subscription no longer holds', async () => {
		const fixture = subscriptionFixture();

		const refusal = await fixture.service
			.pause(SUBSCRIPTION, { reason: 'customer asked' }, { wildcard: false, versions: [3] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.getStatus()).toBe(409);
		// The refusal came from the statement, so the row is untouched and no event was published for a
		// change that did not happen.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.ACTIVE, version: 1 });
		expect(fixture.events).toEqual([]);
	});

	it('writes under the version the caller read, and leaves the row one version further on', async () => {
		const fixture = subscriptionFixture();

		const paused = await fixture.service.pause(SUBSCRIPTION, { reason: 'customer asked' }, asReadByTheCaller);

		expect(paused).toMatchObject({ status: SubscriptionStatus.PAUSED });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.PAUSED, version: 2 });
	});

	it('writes the fields a caller changed under the version that caller read', async () => {
		// The route a field edit arrives on: the fields are written under the version the caller read, and
		// the answer is the subscription as it stands afterwards.
		const fixture = subscriptionFixture();

		const changed = await fixture.service.applyChanges(SUBSCRIPTION, { quantity: '3' }, asReadByTheCaller);

		expect(changed).toMatchObject({ quantity: '3', version: 2 });
	});

	it('refuses a change predicated on a version the subscription no longer holds', async () => {
		// The conflict, not a not-found: the row exists and has merely moved on, and the caller has to be
		// told to read it again rather than sent down the deleted-record path.
		const fixture = subscriptionFixture();

		const refusal = await fixture.service
			.applyChanges(SUBSCRIPTION, { quantity: '3' }, { wildcard: false, versions: [4] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.getStatus()).toBe(409);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ quantity: '1.000000', version: 1 });
	});

	it('predicates a write that no caller conditioned on the version the row holds', async () => {
		// A scheduled pass, another service or a replayed event has no caller to state a version, so the
		// write is predicated on the row's own — which is still a conditional write, not last-writer-wins.
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING, version: 5 })]
		});

		const activated = await fixture.service.activate(SUBSCRIPTION);

		expect(activated).toMatchObject({ status: SubscriptionStatus.ACTIVE });
		expect(fixture.subscription(SUBSCRIPTION)?.version).toBe(6);
	});

	it('spends the caller’s version on the first write and rides the row’s own version after it', async () => {
		// A cycle that owes a setup fee writes the subscription twice: the fee it remembers, and the
		// cycle it records. The first carries the caller's version; the second would be refused if it
		// carried it too, because the row has moved on — by this request's own first write.
		const fixture = subscriptionFixture({ plans: [planRow(PLAN, { setupFee: '30' }), planRow(BETTER_PLAN)] });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true }, asReadByTheCaller);

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1,
			version: 3
		});
	});

	it('refuses a cycle predicated on a version the subscription no longer holds', async () => {
		const fixture = subscriptionFixture();

		const refusal = await fixture.service
			.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true }, { wildcard: false, versions: [9] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		// The subscription the caller reasoned about was not the one in the database, so nothing about it
		// moved: no calendar, no cycle count, no new version.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 0,
			version: 1
		});
	});
});
