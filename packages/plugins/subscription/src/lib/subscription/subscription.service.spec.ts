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
/** The platform's cross-tenant reference check, which reads a real database: recorded, and answered per test. */
const mockAssertReferences = jest.fn(async (..._args: unknown[]) => undefined);

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
		// The comparison an edit makes against the version it read its metadata at, the kernel's own.
		matchesExpectation: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').matchesExpectation,
		parseEntityVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').parseEntityVersion,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The exact-decimal primitives the proration reads. The real ones, for the same reason `Money`
		// is real here: a proration that rounded differently from the platform would be asserted
		// against a rounding this suite invented rather than the one the money layer performs.
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		isUniqueViolation: jest.requireActual('@gauzy/core/src/lib/core/errors/unique-violation').isUniqueViolation,
		toClientSafeError: jest.requireActual('@gauzy/core/src/lib/core/errors/database-error').toClientSafeError,
		redactDatabaseError: jest.requireActual('@gauzy/core/src/lib/core/errors/database-error').redactDatabaseError,
		// The order path's fence a cycle's charge claim is measured in (`chargeClaimWindowMs`): the platform's own
		// stale-lock window, `IdempotencyService.DEFAULT_STALE_LOCK_MS` in `idempotency.service.ts`.
		IdempotencyService: class IdempotencyService {
			static readonly DEFAULT_STALE_LOCK_MS = 2 * 60 * 1000;
		},
		SequenceService: class SequenceService {},
		assertPlainReferencesNotForeign: (...args: unknown[]) => mockAssertReferences(...args),
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
 * The entitlement package's consumer of `subscription.canceled` is the real one (see the contract suite at
 * the end of this file); the service it writes through is the one module of that package replaced, because
 * it reaches the entitlement tables, and the contract is what the consumer decides from the payload.
 */
jest.mock('@gauzy/plugin-entitlement/src/lib/entitlement/entitlement.service', () => ({
	EntitlementService: class EntitlementService {}
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
import { SubscriptionBillingService, chargeClaimWindowMs } from '../subscription-billing/subscription-billing.service';
import { SubscriptionItem } from '../subscription-item/subscription-item.entity';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import { SubscriptionPlan } from '../subscription-plan/subscription-plan.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionService } from './subscription.service';
import { SUBSCRIPTION_REFERENCES } from '../subscription.references';

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
				// SQL's `NULL < x` matches nothing, which is why a stale-or-absent claim is stated as `Or(IsNull(), LessThan(…))`.
				case 'lessThan':
					return value !== null && value !== undefined && instant(value) < instant(expected.value);
				case 'or':
					return (expected.value as unknown as unknown[]).some((operand) => matchesValue(value, operand));
				case 'isNull':
					return value === null || value === undefined;
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
	/** A page of the rows found, as `skip` and `take` select it (the due scan reads page by page). */
	const limited = (found: Row[], take?: number, skip = 0) =>
		found.slice(skip, take === undefined ? undefined : skip + take);

	return {
		rows: live,
		all: () => tables[tableName],
		find: async (options: any = {}) =>
			limited(
				sorted(
					live().filter((row) => matches(row, options.where)),
					options.order
				),
				options.take,
				options.skip
			),
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
		orders?: { paid?: boolean; paidAt?: Date; orderId?: string } | ((request: Row) => Row | Promise<Row> | never);
		withPricing?: boolean;
		withOrder?: boolean;
		withInstruments?: boolean;
		instrumentRefusal?: { reasonCode?: string; reason?: string };
		inFlightOnNewKey?: boolean;
		transactionalUpdateError?: () => Error;
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
		[SubscriptionBilling, 'subscription_billing'],
		[SubscriptionPlan, 'subscription_plan']
	]);
	/** The row locks the service took (`lockPlanRow`), in order, and what "commits" while one is waited for. */
	const locks: string[] = [];
	const onLock: Array<() => void> = [];
	const manager = {
		connection: { options: { type: 'postgres' } },
		query: async (sql: string) => {
			locks.push(sql);
			onLock.splice(0).forEach((committed) => committed());
			return [];
		},
		// A transaction's repository writes the same store: the double's transaction restores it on a rollback.
		getRepository: (entity: unknown) => {
			const table = entityToTable.get(entity);

			if (!table) {
				throw new Error('the in-memory double was handed an entity it does not know');
			}

			const transactional = repository(tables, table, table === 'subscription' ? () => commits.push('subscription') : undefined);

			// A write of the subscription inside a transaction that the database refuses, for the case about how that is answered.
			if (options.transactionalUpdateError && table === 'subscription') {
				transactional.update = async () => {
					throw options.transactionalUpdateError!();
				};
			}

			return transactional;
		},
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
		/** The stored claim, with the status the platform's row carries: completed once it has a response. */
		findByKey: async (scope: string, key: string) => {
			const record = records.get(`${scope}:${key}`);

			return record ? { ...record, status: record.response ? 'COMPLETED' : 'IN_PROGRESS' } : null;
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
		locks,
		onLock,
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
 * The instant one calendar month after a date, at the same time of day, clamped to the last day of the
 * next month when that month is shorter (31 October → 30 November, 31 January → 28 or 29 February):
 * the billing rule the cycle module states and `subscription.cycle.spec.ts` pins with fixed dates.
 *
 * It used not to clamp, on the note that the suite only passed it mid-month instants, but several specs
 * here pass it an instant read from the clock (a creation, an activation, a resume, a trial ending a week
 * from now). Stage run 40080742318 (2026-10-24) had the trial end on 31 October, so the helper expected
 * 1 December, where `Date.UTC`'s "31 November" rolls to, while the service rightly ended the period on
 * 30 November.
 */
const monthAfter = (date: Date) => {
	const nextMonth = (date.getUTCMonth() + 1) % 12;
	const next = new Date(
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

	// A day the next month does not have rolls into the month after it; day 0 of that month is the next
	// month's last day, at the same time of day.
	if (next.getUTCMonth() !== nextMonth) {
		next.setUTCDate(0);
	}

	return next;
};

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
		// The opening period is the first one billed, so the next billing instant is its start.
		expect(created.nextBillingAt).toEqual(created.currentPeriodStart);
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

	it('holds the plan row in share mode while the subscription is created on it', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }]
		});

		expect(fixture.locks).toEqual([expect.stringMatching(/FROM "subscription_plan" WHERE "id" = \$1 FOR SHARE$/)]);
	});

	it('sees a deactivation that committed while it waited for the plan row, and commits nothing', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		// The plan passed the checks before the transaction; an update deactivates it before the lock is granted.
		fixture.onLock.push(() => {
			fixture.tables.subscription_plan.find((row) => row.id === PLAN).isActive = false;
		});

		await expect(
			fixture.service.createSubscription({
				planId: PLAN,
				customerId: CUSTOMER,
				items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }]
			})
		).rejects.toThrow('SUBSCRIPTION_PLAN_INACTIVE');
		expect(fixture.commits).toEqual([]);
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
		// The activation's period is the first one billed.
		expect(activated.nextBillingAt).toEqual(activated.currentPeriodStart);
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
		// The first paid period is billed once the trial is over, not one period later.
		expect(activated.nextBillingAt).toEqual(trialEnd);
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

	it('adds a second deferred credit to the first rather than replacing it', async () => {
		// The corrected contract. The carried amount was **assigned** on every change, so a customer who
		// downgraded twice inside one period was owed both credits and given only the second: the first
		// one's amount was overwritten on the subscription and nothing anywhere remembered it. The money
		// moves when the next cycle consumes what is carried, so what is carried has to be the whole of
		// what is owed.
		const fixture = subscriptionFixture({
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '60.00' },
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					metadata: { pendingCredit: { amount: '-12.000000', currency: 'USD' } }
				})
			]
		});

		const outcome = await fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN });

		expect(outcome).toMatchObject({ net: '-30.970000', settlement: 'DEFERRED' });
		// -12.00 already carried, -30.97 decided now: the row carries the sum.
		expect(outcome.subscription.metadata?.['pendingCredit']).toMatchObject({
			amount: '-42.970000',
			currency: 'USD'
		});
		// The control: assigning rather than adding left only the second amount behind.
		expect(outcome.subscription.metadata?.['pendingCredit']).not.toMatchObject({ amount: '-30.970000' });
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

	it('refuses a move to a plan priced in another currency, before anything is charged', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN), planRow(BETTER_PLAN, { currency: 'EUR' })],
			prices: { [VARIANT]: '120.00', [BETTER_VARIANT]: '300.00' }
		});

		await expect(fixture.service.changePlan(SUBSCRIPTION, { planId: BETTER_PLAN })).rejects.toThrow(
			'SUBSCRIPTION_CURRENCY_MISMATCH: the plan is priced in EUR and the subscription is billed in USD.'
		);
		expect(fixture.prorationCalls).toHaveLength(0);
		expect(fixture.subscription(SUBSCRIPTION).planId).toBe(PLAN);
	});
});

describe('SubscriptionService — a write the database refuses inside a transaction', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('is answered as CrudService.update answers it: a 400 that carries no database internals', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })],
			transactionalUpdateError: () =>
				Object.assign(new Error('numeric field overflow on column "quantity" of relation "subscription"'), {
					code: '22003',
					query: 'UPDATE "subscription" SET "status" = $1 WHERE "id" = $2',
					parameters: ['ACTIVE', SUBSCRIPTION]
				})
		});

		const logged = jest.spyOn((fixture.service as any).logger, 'error').mockImplementation(() => undefined);

		const refused = await fixture.service.activate(SUBSCRIPTION).catch((error: unknown) => error);

		expect(refused).toBeInstanceOf(BadRequestException);
		expect(JSON.stringify((refused as BadRequestException).getResponse())).not.toMatch(/UPDATE|"subscription"|quantity/);
		expect(fixture.subscription(SUBSCRIPTION).status).toBe(SubscriptionStatus.PENDING);
		// What the answer no longer carries is logged for the operator, without the values the statement was bound to.
		expect(logged).toHaveBeenCalledTimes(1);
		expect(logged.mock.calls[0][0]).toMatch(/22003/);
		expect(logged.mock.calls[0][0]).not.toMatch(/"ACTIVE"/);
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

	it.each([SubscriptionBillingStatus.PAID, SubscriptionBillingStatus.WAIVED])(
		'does not turn a charge that succeeded into a failed attempt when an operator settled the cycle (%s) meanwhile (Greptile)',
		async (settledAs) => {
			// The charge is in flight when an operator records the cycle another way; the run's own `markPaid` then
			// meets a cycle that is no longer payable. Reporting that as a failed charge would schedule a retry - a
			// second charge of money already taken.
			let fixture: ReturnType<typeof subscriptionFixture>;
			fixture = subscriptionFixture({
				orders: () => {
					Object.assign(fixture.cycle(APRIL)!, {
						status: settledAs,
						paidAt: settledAs === SubscriptionBillingStatus.PAID ? new Date(APRIL) : null
					});

					return { orderId: 'order-1', paid: true };
				}
			});

			const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			expect(outcome.status).not.toBe(SubscriptionBillingStatus.FAILED);
			expect(fixture.cycle(APRIL)).toMatchObject({ status: settledAs });
			expect(fixture.cycle(APRIL)?.nextRetryAt ?? null).toBeNull();
			expect(fixture.events.map((event) => event.name)).not.toContain('subscription.payment-failed');
		}
	);

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

/**
 * The charge claim (CodeRabbit on ever-co/ever-gauzy#11565): a pass claims the cycle before it calls the order path,
 * an operator's `pay` or `waive` is refused while the claim is live, the attempt's outcome ends it, and a stale claim
 * is recovered under the earlier call's attempt key so the order path's own idempotency says what that call did.
 */
describe('SubscriptionService — a cycle’s charge is fenced against an operator settling it (charge claim)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const inFlight = { status: 409, response: { code: 'SUBSCRIPTION_BILLING_CHARGE_IN_FLIGHT' } };
	/** The open April cycle, as an earlier pass left it. */
	const aprilCycle = (overrides: Row = {}): Row => ({
		id: 'cycle-april',
		tenantId: TENANT,
		organizationId: ORG,
		subscriptionId: SUBSCRIPTION,
		periodStart: new Date(APRIL),
		periodEnd: monthAfter(APRIL),
		amount: '120.000000',
		currency: 'USD',
		status: SubscriptionBillingStatus.PENDING,
		dueAt: new Date(APRIL),
		paidAt: null,
		attemptCount: 0,
		...overrides
	});
	/** A claim a pass took the given time ago. */
	const claimedAgo = (ms: number, token: string): Row => ({
		chargeClaimToken: token,
		chargeClaimedAt: new Date(Date.now() - ms)
	});
	const staleClaim = () => claimedAgo(chargeClaimWindowMs() + 1000, 'a-pass-that-died');
	const eventNames = (fixture: ReturnType<typeof subscriptionFixture>) => fixture.events.map((event) => event.name);

	it.each([
		['pays', (fixture: ReturnType<typeof subscriptionFixture>, id: string) => fixture.service.payCycle(id)],
		[
			'waives',
			(fixture: ReturnType<typeof subscriptionFixture>, id: string) =>
				fixture.billingService.markWaived(id, { reason: 'goodwill' })
		]
	])('refuses an operator who %s the cycle while its charge is in flight, and records the charge', async (_action, settle) => {
		let refusal: unknown;
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: async () => {
				// The operator acts while the order path is taking the money.
				refusal = await settle(fixture, fixture.cycle(APRIL)!.id).catch((error: unknown) => error);

				return { orderId: 'order-1', paid: true };
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(refusal).toMatchObject(inFlight);
		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1', replayed: false });
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PAID,
			orderId: 'order-1',
			chargeClaimToken: null,
			chargeClaimedAt: null
		});
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it.each([
		[true, SubscriptionBillingStatus.PAID],
		[false, SubscriptionBillingStatus.INVOICED]
	])('ends the claim when the order path answers paid: %s (%s)', async (paid, status) => {
		const fixture = subscriptionFixture({ orders: { paid, orderId: 'order-1' } });

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.cycle(APRIL)).toMatchObject({ status, chargeClaimToken: null, chargeClaimedAt: null });
	});

	it('ends the claim when the charge fails, so the operator can settle the failed cycle', async () => {
		const fixture = subscriptionFixture({
			orders: () => {
				throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the instrument was declined');
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });
		const cycle = fixture.cycle(APRIL)!;

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.FAILED, errorCode: 'SUBSCRIPTION_CHARGE_DECLINED' });
		expect(cycle).toMatchObject({ attemptCount: 1, chargeClaimToken: null, chargeClaimedAt: null });
		await expect(fixture.billingService.markWaived(cycle.id, { reason: 'goodwill' })).resolves.toMatchObject({
			status: SubscriptionBillingStatus.WAIVED
		});
	});

	it('ends the claim when recording the attempt throws, rather than fencing the cycle until it goes stale', async () => {
		const fixture = subscriptionFixture({
			orders: () => {
				throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the instrument was declined');
			}
		});

		jest.spyOn(fixture.billingService, 'markFailed').mockRejectedValueOnce(new Error('the database went away'));

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PENDING,
			chargeClaimToken: null,
			chargeClaimedAt: null
		});
	});

	it('does not charge a cycle another pass is charging, and leaves that pass’s claim alone', async () => {
		const fixture = subscriptionFixture({ billings: [aprilCycle(claimedAgo(1000, 'another-pass'))] });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: true, billingId: 'cycle-april' });
		expect(outcome.message).toMatch(/Another billing pass is charging this cycle/);
		expect(fixture.orderCalls).toEqual([]);
		expect(fixture.cycle(APRIL)).toMatchObject({ chargeClaimToken: 'another-pass', attemptCount: 0 });
		expect(eventNames(fixture)).toEqual([]);
	});

	it('recovers a stale claim and charges under the attempt key the earlier call used', async () => {
		const fixture = subscriptionFixture({ billings: [aprilCycle(staleClaim())], orders: { paid: true, orderId: 'order-1' } });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1' });
		expect(fixture.orderCalls).toHaveLength(1);
		// Attempt 1, as the pass that died used: the order path answers that call's order, if it raised one.
		expect(fixture.orderCalls[0].idempotencyKey).toBe(`${SUBSCRIPTION}:${APRIL.toISOString()}:1`);
		expect(fixture.cycle(APRIL)).toMatchObject({ chargeClaimToken: null, chargeClaimedAt: null });
	});

	it('keeps the fence when the recovered attempt is still in flight at the order path, and records no failure', async () => {
		const fixture = subscriptionFixture({
			billings: [aprilCycle(staleClaim())],
			orders: () => {
				throw new Error('ORDER_SUBSCRIPTION_IN_FLIGHT: another attempt at this cycle holds its key and is still working.');
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });
		const cycle = fixture.cycle(APRIL)!;

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: true });
		// The attempt count is unchanged, so the next attempt keeps the order key the call still running holds.
		expect(cycle).toMatchObject({ status: SubscriptionBillingStatus.PENDING, attemptCount: 0 });
		expect(cycle.lastError ?? null).toBeNull();
		expect(eventNames(fixture)).not.toContain('subscription.payment-failed');
		// The recovering pass holds a fresh claim, so the operator still meets the fence.
		expect(cycle.chargeClaimToken).toEqual(expect.any(String));
		expect(cycle.chargeClaimToken).not.toBe('a-pass-that-died');
		await expect(fixture.service.payCycle(cycle.id)).rejects.toMatchObject(inFlight);
	});

	it('records nothing for an attempt that outlived its claim, leaving the cycle to the pass that recovered it', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: () => {
				// The call outlives the claim's window, and another pass recovers the cycle meanwhile.
				Object.assign(fixture.cycle(APRIL)!, { chargeClaimToken: 'recovering-pass', chargeClaimedAt: new Date() });

				throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the instrument was declined');
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: true });
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PENDING,
			attemptCount: 0,
			chargeClaimToken: 'recovering-pass'
		});
		expect(eventNames(fixture)).not.toContain('subscription.payment-failed');
	});

	it.each([
		['payment', true],
		['invoice', false]
	])(
		'records no %s whose claim another pass recovered, and leaves that pass to record it (paid: %s)',
		async (_outcome, paid) => {
			let fixture: ReturnType<typeof subscriptionFixture>;
			fixture = subscriptionFixture({
				orders: () => {
					// The call outlives the claim's window, and another pass recovers the cycle meanwhile.
					Object.assign(fixture.cycle(APRIL)!, { chargeClaimToken: 'recovering-pass', chargeClaimedAt: new Date() });

					return { orderId: 'order-1', paid };
				}
			});

			const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: true });
			expect(fixture.cycle(APRIL)).toMatchObject({
				status: SubscriptionBillingStatus.PENDING,
				chargeClaimToken: 'recovering-pass'
			});
			expect(fixture.cycle(APRIL)?.paidAt ?? null).toBeNull();
			expect(fixture.cycle(APRIL)?.orderId ?? null).toBeNull();
			expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });
			expect(eventNames(fixture)).toEqual([]);
		}
	);

	it.each([
		['payment', true],
		['invoice', false]
	])('records no second success for a late %s of a cycle the recovering pass already paid (paid: %s)', async (_outcome, paid) => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: () => {
				// The call outlives its claim; the pass that recovered the cycle is handed the order and records it first.
				Object.assign(fixture.cycle(APRIL)!, {
					status: SubscriptionBillingStatus.PAID,
					paidAt: new Date(APRIL),
					orderId: 'order-1',
					chargeClaimToken: null,
					chargeClaimedAt: null
				});

				return { orderId: 'order-1', paid };
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: true, orderId: 'order-1' });
		// The recovering pass finishes the cycle; the late pass neither moves the calendar nor tells a renewal.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });
		expect(eventNames(fixture)).toEqual([]);
	});

	it('does not write a late invoice over a cycle an operator paid once the claim went stale', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: () => {
				// The claim went stale during the call, and an operator recorded the payment.
				Object.assign(fixture.cycle(APRIL)!, {
					status: SubscriptionBillingStatus.PAID,
					paidAt: new Date(APRIL),
					chargeClaimToken: null,
					chargeClaimedAt: null
				});

				return { orderId: 'order-1', paid: false };
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PAID, paidAt: new Date(APRIL) });
		expect(eventNames(fixture)).not.toContain('subscription.payment-failed');
	});

	it('does not turn a failed bookkeeping write after the payment into a failed charge, so nothing charges it again', async () => {
		const fixture = subscriptionFixture({ plans: [planRow(PLAN, { setupFee: '25' }), planRow(BETTER_PLAN)] });

		// The write that remembers the setup fee the order carried (with the calendar, in one transaction) fails after the
		// payment is recorded.
		jest
			.spyOn((fixture.service as any).typeOrmSubscriptionRepository.manager, 'transaction')
			.mockRejectedValueOnce(new Error('the database went away'));

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// The money is recorded and nothing marks it failed: no attempt is counted and no retry is scheduled.
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PAID,
			orderId: 'order-1',
			attemptCount: 0,
			chargeClaimToken: null
		});
		expect(fixture.cycle(APRIL)?.nextRetryAt ?? null).toBeNull();
		expect(eventNames(fixture)).not.toContain('subscription.payment-failed');
		// The period's key is not completed on the error.
		expect(
			(await fixture.idempotencyService.findByKey('subscription.bill', `${SUBSCRIPTION}:${APRIL.toISOString()}`))?.status
		).toBe('IN_PROGRESS');

		// A later pass finishes the paid cycle and charges nothing.
		fixture.idempotencyService.advanceBy(3 * 60 * 1000);

		const replayed = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(replayed).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: true, orderId: 'order-1' });
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: monthAfter(APRIL), billingCycleCount: 1 });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);
	});
});

/**
 * A cycle the billing run charged is finished once (`finishCycle`).
 *
 * The run records the charge's outcome on the cycle, then finishes it: the subscription's bookkeeping (the setup fee
 * the order carried, the deferred credit it consumed) and its calendar, in one write, with the renewal told in that
 * write's transaction. A pass cut off between the outcome and the finish — a crash, a failed write, a payment whose
 * read-back threw — used to leave the cycle paid and the subscription on its period: every later pass replayed the
 * cycle, completed the period's key on it, and the subscription was never billed again nor its renewal told. Copilot's
 * review of #11570 (round 2) set what the finish must hold to, and each case below is one of them: the row's own
 * period, once across the run and a recovering pass, the consumed credit subtracted by its own amount, an invoiced
 * cycle's bookkeeping without its calendar, and a retryable state after a payment whose read failed.
 */
describe('SubscriptionService — a charged cycle is finished once, by whichever pass gets there (finishCycle)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const MAY = monthAfter(APRIL);
	const named = (fixture: ReturnType<typeof subscriptionFixture>, name: string) =>
		fixture.events.filter((event) => event.name === name);
	/** The subscription's transactions; the finish's write and the events it tells run in one. */
	const transactions = (fixture: ReturnType<typeof subscriptionFixture>) =>
		(fixture.service as any).typeOrmSubscriptionRepository.manager;
	/** The next finish's write fails, after the charge's outcome is recorded. */
	const failNextFinish = (fixture: ReturnType<typeof subscriptionFixture>) =>
		jest.spyOn(transactions(fixture), 'transaction').mockRejectedValueOnce(new Error('the database went away'));
	/** The status of the period's billing key. */
	const keyOf = async (fixture: ReturnType<typeof subscriptionFixture>, periodStart: Date = APRIL) =>
		(await fixture.idempotencyService.findByKey('subscription.bill', `${SUBSCRIPTION}:${periodStart.toISOString()}`))?.status;
	/** The period key's lease runs out, so the next pass takes the period over. */
	const leaseRunsOut = (fixture: ReturnType<typeof subscriptionFixture>) => fixture.idempotencyService.advanceBy(3 * 60 * 1000);
	/** Another write lands on the subscription, as a plan change would: the row moves on a version. */
	const writeSubscription = (fixture: ReturnType<typeof subscriptionFixture>, patch: Row) => {
		const row = fixture.subscription(SUBSCRIPTION)!;

		Object.assign(row, patch, { version: row.version + 1 });
	};

	it('finishes a paid cycle whose finish failed on the next pass, once, without charging it again', async () => {
		const fixture = subscriptionFixture({ plans: [planRow(PLAN, { setupFee: '25' }), planRow(BETTER_PLAN)] });

		failNextFinish(fixture);

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// The charge is recorded with what it left the subscription to record, and nothing else moved.
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PAID,
			orderId: 'order-1',
			metadata: expect.objectContaining({ cycleBookkeeping: { setupFeePlanId: PLAN } })
		});
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toBeUndefined();
		expect(fixture.events).toEqual([]);
		expect(await keyOf(fixture)).toBe('IN_PROGRESS');

		leaseRunsOut(fixture);

		const run = await fixture.service.runBilling({ asOf: APRIL });

		expect(run.results[0]).toMatchObject({
			status: SubscriptionBillingStatus.PAID,
			replayed: true,
			orderId: 'order-1',
			periodStart: APRIL,
			periodEnd: MAY
		});
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			currentPeriodStart: APRIL,
			currentPeriodEnd: MAY,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(named(fixture, 'subscription.renewed')[0].data).toMatchObject({
			billingId: fixture.cycle(APRIL)?.id,
			orderId: 'order-1',
			periodStart: APRIL,
			periodEnd: MAY,
			nextBillingAt: MAY
		});
		expect(await keyOf(fixture)).toBe('COMPLETED');

		// The next pass of the same day has nothing due, and the next period is billed as a renewal: one charge per
		// period, and the setup fee is not charged again.
		await fixture.service.runBilling({ asOf: APRIL });
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: MAY });

		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.orderCalls[1]).toMatchObject({ periodStart: MAY, firstCycle: false });
		expect(fixture.orderCalls[1].setupFee).toBeUndefined();
		expect(named(fixture, 'subscription.renewed')).toHaveLength(2);
		expect(fixture.subscription(SUBSCRIPTION)?.billingCycleCount).toBe(2);
	});

	it('leaves the period’s key open after a payment whose read-back threw, and the next pass finishes the cycle', async () => {
		const fixture = subscriptionFixture();
		const markPaid = fixture.billingService.markPaid.bind(fixture.billingService);

		// The payment's write commits, and reading the cycle back fails.
		jest.spyOn(fixture.billingService, 'markPaid').mockImplementationOnce(async (id, options) => {
			await markPaid(id, options);

			throw new Error('the connection dropped reading the cycle back');
		});

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow(
			'the connection dropped reading the cycle back'
		);

		// Not a failed charge: no attempt counted, no retry, no dunning. And not a settled replay: the key is open.
		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.PAID,
			orderId: 'order-1',
			attemptCount: 0,
			chargeClaimToken: null
		});
		expect(fixture.cycle(APRIL)?.nextRetryAt ?? null).toBeNull();
		expect(fixture.cycle(APRIL)?.lastError ?? null).toBeNull();
		expect(named(fixture, 'subscription.payment-failed')).toEqual([]);
		expect(await keyOf(fixture)).toBe('IN_PROGRESS');
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });

		leaseRunsOut(fixture);

		const finished = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(finished).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: true, orderId: 'order-1' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it('tells one renewal and moves the calendar once when a pass takes the key over while the charging pass finishes', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })]
		});
		const transaction = transactions(fixture).transaction;
		let interleaved: Awaited<ReturnType<SubscriptionService['billCycle']>> | undefined;

		// The charging pass has read the subscription and decided its finish; before its write lands, its key's lease
		// runs out and a second pass takes the period over and finishes the cycle first.
		jest.spyOn(transactions(fixture), 'transaction').mockImplementationOnce(async (run: any) => {
			leaseRunsOut(fixture);
			interleaved = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			return transaction(run);
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(interleaved).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: true, orderId: 'order-1' });
		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: false, orderId: 'order-1' });
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});
		expect(named(fixture, 'subscription.activated')).toHaveLength(1);
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it('leaves the calendar where it was when the renewal could not be told, and the next pass tells it once', async () => {
		const fixture = subscriptionFixture();
		const outbox = (fixture.service as any).outbox;
		const append = outbox.append.bind(outbox);
		let refused = false;

		// The first renewal is refused by the outbox, inside the transaction the calendar is written in.
		jest.spyOn(outbox, 'append').mockImplementation(async (manager: unknown, event: Row) => {
			if (event.name === 'subscription.renewed' && !refused) {
				refused = true;

				throw new Error('the outbox refused the event');
			}

			return append(manager, event);
		});

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the outbox refused the event');

		// The write the event was told with rolled back with it.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0, version: 1 });

		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it('finishes from the cycle’s own period after the subscription moved to a plan of another cadence', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN), planRow(BETTER_PLAN, { billingPeriod: SubscriptionBillingPeriod.YEARLY })]
		});

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// The customer moved to the yearly plan before the monthly cycle was finished.
		writeSubscription(fixture, { planId: BETTER_PLAN });
		leaseRunsOut(fixture);

		const finished = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// A month on, as the paid row covers, not a year on as the new cadence would compute.
		expect(finished).toMatchObject({ periodStart: APRIL, periodEnd: MAY, replayed: true });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			currentPeriodStart: APRIL,
			currentPeriodEnd: MAY,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});
		expect(named(fixture, 'subscription.renewed')[0].data).toMatchObject({ periodEnd: MAY, nextBillingAt: MAY });
	});

	it('subtracts the credit the cycle consumed and keeps a credit deferred after it, so neither is granted twice', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			]
		});

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		expect(fixture.orderCalls[0]).toMatchObject({ creditAmount: '-30.000000' });
		expect(fixture.cycle(APRIL)?.metadata?.['cycleBookkeeping']).toEqual({ credit: '-30.000000' });

		// Another downgrade defers 10 more before the cycle is finished; the carried credit accumulates (`applyChange`).
		writeSubscription(fixture, { metadata: { pendingCredit: { amount: '-40.000000', currency: 'USD' } } });
		leaseRunsOut(fixture);
		await fixture.service.runBilling({ asOf: APRIL });

		// The 30 the April order carried is spent; the 10 decided after it is owed to the next cycle.
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({
			amount: '-10.000000',
			currency: 'USD'
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: MAY });

		expect(fixture.orderCalls[1]).toMatchObject({ periodStart: MAY, creditAmount: '-10.000000' });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toBeUndefined();
		// 40 owed, 40 granted: 30 on April, 10 on May.
		expect(fixture.adjustmentsOf(fixture.cycle(APRIL)?.id).map((row) => row.amount)).toEqual(['-30.000000']);
		expect(fixture.adjustmentsOf(fixture.cycle(MAY)?.id).map((row) => row.amount)).toEqual(['-10.000000']);
	});

	it('keeps a credit deferred while the cycle was being charged, on the run’s own finish', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			],
			orders: () => {
				// A downgrade defers 10 more while the order path is taking the money.
				writeSubscription(fixture, { metadata: { pendingCredit: { amount: '-40.000000', currency: 'USD' } } });

				return { orderId: 'order-1', paid: true };
			}
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({ amount: '-10.000000' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
	});

	it('applies the credit the run consumed, not one a correction wrote into the cycle before it was charged', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			],
			billings: [
				{
					id: 'cycle-april',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: MAY,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PENDING,
					dueAt: new Date(APRIL),
					paidAt: null,
					attemptCount: 0,
					metadata: { cycleBookkeeping: { credit: '-1000.000000' } }
				}
			]
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.cycle(APRIL)?.metadata?.['cycleBookkeeping']).toEqual({ credit: '-30.000000' });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toBeUndefined();
	});

	it('applies an invoiced cycle’s bookkeeping on a later pass without moving its calendar, and its payment moves it once', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			plans: [planRow(PLAN, { setupFee: '25' }), planRow(BETTER_PLAN)],
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			]
		});

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		expect(fixture.cycle(APRIL)).toMatchObject({
			status: SubscriptionBillingStatus.INVOICED,
			metadata: expect.objectContaining({
				calendarDeferred: true,
				cycleBookkeeping: { credit: '-30.000000', setupFeePlanId: PLAN }
			})
		});

		leaseRunsOut(fixture);

		const replayed = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The credit already in the invoice is spent and the setup fee remembered; the calendar waits for the payment.
		expect(replayed).toMatchObject({ status: SubscriptionBillingStatus.INVOICED, replayed: true });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toBeUndefined();
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);
		expect(fixture.events).toEqual([]);
		expect(fixture.orderCalls).toHaveLength(1);

		// A downgrade defers a new credit while the invoice is open; the payment does not spend it again.
		writeSubscription(fixture, {
			metadata: { ...fixture.subscription(SUBSCRIPTION)?.metadata, pendingCredit: { amount: '-10.000000', currency: 'USD' } }
		});
		await fixture.service.payCycle(fixture.cycle(APRIL)!.id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({ amount: '-10.000000' });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it('applies an invoiced cycle’s left-over bookkeeping with the calendar its payment moves', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			]
		});

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// No pass reaches a subscription held by its open invoice (`findDue`); a downgrade adds 10 before the payment.
		writeSubscription(fixture, { metadata: { pendingCredit: { amount: '-40.000000', currency: 'USD' } } });
		await fixture.service.payCycle(fixture.cycle(APRIL)!.id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({ amount: '-10.000000' });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: MAY });

		expect(fixture.orderCalls[1]).toMatchObject({ periodStart: MAY, creditAmount: '-10.000000' });
	});

	it('finishes a cycle whose key an earlier build completed on a replay, charging nothing', async () => {
		const fixture = subscriptionFixture();

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// A build before this one met the paid cycle, replayed it as settled and completed the period's key on it.
		const key = fixture.idempotencyService.records.get(`subscription.bill:${SUBSCRIPTION}:${APRIL.toISOString()}`)!;

		await fixture.idempotencyService.complete(key, {
			responseStatus: 200,
			responseBody: { subscriptionId: SUBSCRIPTION, status: SubscriptionBillingStatus.PAID, replayed: true }
		});

		await fixture.service.runBilling({ asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.orderCalls).toHaveLength(1);

		// The subscription is no longer due on April, so the next pass of the day moves nothing again.
		const next = await fixture.service.runBilling({ asOf: APRIL });

		expect(next.examined).toBe(0);
		expect(fixture.subscription(SUBSCRIPTION)?.billingCycleCount).toBe(1);
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it('replays a cycle an operator paid without an order, as before', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-april',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: MAY,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					paidAt: new Date(APRIL),
					attemptCount: 0
				}
			]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: true, billingId: 'cycle-april' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: APRIL, billingCycleCount: 0 });
		expect(fixture.events).toEqual([]);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('does not bring back a subscription cancelled while its cycle was being charged', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: async () => {
				await fixture.service.cancel(SUBSCRIPTION, { reason: 'customer left', immediate: true });

				return { orderId: 'order-1', paid: true };
			}
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, replayed: false, orderId: 'order-1' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.CANCELED,
			nextBillingAt: null,
			billingCycleCount: 0
		});
		expect(named(fixture, 'subscription.renewed')).toEqual([]);
	});

	/**
	 * The order path's own idempotency (`SubscriptionOrderService`): one order per attempt key, replayed for the same
	 * request — subscription, cycle, amount, period start, lines — and refused for a different one.
	 */
	const idempotentOrders = () => {
		const placed = new Map<string, { hash: string; result: Row }>();

		return (request: Row) => {
			const hash = JSON.stringify({
				billingId: request.billingId,
				amount: request.amount,
				periodStart: new Date(request.periodStart).toISOString(),
				lines: request.lines
			});
			const earlier = placed.get(request.idempotencyKey);

			if (earlier && earlier.hash !== hash) {
				throw new Error(
					'ORDER_SUBSCRIPTION_KEY_REUSED: this key already raised an order for a different request, so it cannot raise another one.'
				);
			}

			if (earlier) {
				return earlier.result;
			}

			const result = { orderId: `order-${placed.size + 1}`, paid: true };

			placed.set(request.idempotencyKey, { hash, result });

			return result;
		};
	};

	it('resends a taken-over attempt’s own request, so its order is recorded once and nothing is charged twice', async () => {
		const fixture = subscriptionFixture({
			orders: idempotentOrders(),
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-30.000000', currency: 'USD' } } })
			]
		});

		// The order is raised and paid, and the write recording the payment fails before it lands.
		jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		const cycle = fixture.cycle(APRIL)!;

		expect(cycle).toMatchObject({ status: SubscriptionBillingStatus.PENDING, attemptCount: 0, chargeClaimToken: null });
		expect(cycle.metadata?.['attemptRequest']).toMatchObject({ attempt: 1, bookkeeping: { credit: '-30.000000' } });
		// The attempt may have an order, so the cycle is no longer a schedule entry a correction may rewrite.
		await expect(fixture.billingService.update(cycle.id, { amount: '1' })).rejects.toMatchObject({
			response: { code: 'SUBSCRIPTION_BILLING_SETTLED' }
		});

		// Before the next pass, the line's quantity changes and a downgrade defers 10 more.
		Object.assign(fixture.items()[0], { quantity: '2.000000' });
		writeSubscription(fixture, { metadata: { pendingCredit: { amount: '-40.000000', currency: 'USD' } } });
		leaseRunsOut(fixture);

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The same request under the same key: the order path answers with the attempt's order, not a refusal that would
		// be recorded as a failed charge and charged again under the next attempt's key.
		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.orderCalls[1]).toEqual(fixture.orderCalls[0]);
		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1', replayed: false });
		expect(fixture.cycle(APRIL)?.metadata?.['cycleBookkeeping']).toEqual({ credit: '-30.000000' });
		expect(fixture.cycle(APRIL)?.metadata?.['attemptRequest']).toBeUndefined();
		// The order carried 30, so 30 is spent and the 10 deferred since is kept.
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({ amount: '-10.000000' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.payment-failed')).toEqual([]);
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it.each([
		// Not cleared, and nothing deferred since: the carried credit is the consumed one, and it is spent.
		['carries the credit it consumed, unchanged since', { amount: '-30.000000', at: '2026-03-20T00:00:00.000Z' }, undefined],
		// Written after the consumption: a new credit after that build cleared the consumed one, or the consumed one with
		// more added. Nothing tells the two apart, so it is kept for reconciliation rather than guessed at.
		['carries a credit written after it consumed one', { amount: '-40.000000', at: '2026-04-02T00:00:00.000Z' }, '-40.000000'],
		// Cleared by that build.
		['no longer carries a credit', undefined, undefined]
	])(
		'finishes a cycle an earlier build recorded without its bookkeeping, when the subscription %s',
		async (_case, carried, left) => {
			const fixture = subscriptionFixture({
				subscriptions: [
					subscriptionRow(SUBSCRIPTION, { metadata: carried ? { pendingCredit: { ...carried, currency: 'USD' } } : {} })
				],
				billings: [
					{
						id: 'cycle-april',
						tenantId: TENANT,
						organizationId: ORG,
						subscriptionId: SUBSCRIPTION,
						periodStart: new Date(APRIL),
						periodEnd: MAY,
						amount: '120.000000',
						currency: 'USD',
						status: SubscriptionBillingStatus.PAID,
						paidAt: new Date(APRIL),
						orderId: 'order-1',
						attemptCount: 0,
						metadata: { gross: '120.000000', discount: '0.000000' }
					}
				]
			});

			// The adjustment the cycle consumed the credit under, which that build wrote before the order.
			fixture.adjustments.push({
				ownerType: AdjustmentOwnerType.SUBSCRIPTION_BILLING,
				ownerId: 'cycle-april',
				type: AdjustmentType.CREDIT,
				amount: '-30.000000',
				currency: 'USD',
				referenceType: 'subscription',
				referenceId: SUBSCRIPTION,
				description: 'Credit from an earlier plan change.',
				createdAt: new Date('2026-04-01T00:00:05.000Z')
			});

			await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
			expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']?.amount).toBe(left);
			expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
			expect(fixture.orderCalls).toEqual([]);
		}
	);

	it('finishes a cycle the run paid and an operator refunded before it was finished', async () => {
		const fixture = subscriptionFixture();

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');
		await fixture.billingService.markRefunded(fixture.cycle(APRIL)!.id, 'goodwill');
		leaseRunsOut(fixture);

		const finished = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(finished).toMatchObject({ status: SubscriptionBillingStatus.REFUNDED, replayed: true });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it('keeps the calendar on a cycle being charged when the subscription is paused and resumed meanwhile', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		fixture = subscriptionFixture({
			orders: async () => {
				// An operator pauses the subscription and resumes it an hour later, while the renewal is being charged.
				await fixture.service.pause(SUBSCRIPTION, { reason: 'customer asked' });
				await fixture.service.resume(SUBSCRIPTION, new Date(APRIL.getTime() + 60 * 60 * 1000));

				expect(fixture.subscription(SUBSCRIPTION)?.nextBillingAt).toEqual(APRIL);

				return { orderId: 'order-1', paid: true };
			}
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The paid period is counted, and the next period starts where it ends rather than an hour into it.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			currentPeriodStart: APRIL,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it('keeps the service’s own keys out of a cycle opened or corrected by hand', async () => {
		const fixture = subscriptionFixture();

		const opened = await fixture.billingService.createPending({
			subscriptionId: SUBSCRIPTION,
			periodStart: new Date(APRIL),
			periodEnd: MAY,
			amount: '120',
			currency: 'USD',
			metadata: { calendarSettledAt: '2026-01-01T00:00:00.000Z', note: 'backfill' }
		});

		expect(opened.metadata).toEqual({ note: 'backfill' });

		await fixture.billingService.update(opened.id, {
			metadata: { calendarDeferred: true, cycleBookkeeping: { credit: '-99.000000' }, note: 'corrected' }
		});

		expect(fixture.cycle(APRIL)?.metadata).toEqual({ note: 'corrected' });

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
	});

	it('moves the calendar for a cycle that carried a hand-written calendar marker from before, once the run pays it', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-april',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: MAY,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PENDING,
					dueAt: new Date(APRIL),
					paidAt: null,
					attemptCount: 0,
					metadata: { calendarSettledAt: '2026-01-01T00:00:00.000Z', rightsReleasedAt: '2026-01-01T00:00:00.000Z' }
				}
			]
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.cycle(APRIL)?.metadata?.['calendarSettledAt']).toBeUndefined();
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
	});

	it('writes no adjustment from the subscription as it now stands when it resends a frozen attempt', async () => {
		const fixture = subscriptionFixture({ orders: idempotentOrders() });

		// The attempt carries no credit, and the write recording its payment fails before it lands.
		jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// A downgrade defers a credit before the attempt is taken over.
		writeSubscription(fixture, { metadata: { pendingCredit: { amount: '-10.000000', currency: 'USD' } } });
		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The recovered order granted no credit, so the April cycle records none, and the credit is May's to grant.
		expect(fixture.orderCalls[1]).toEqual(fixture.orderCalls[0]);
		expect(fixture.adjustmentsOf(fixture.cycle(APRIL)?.id)).toEqual([]);
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['pendingCredit']).toMatchObject({ amount: '-10.000000' });

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: MAY });

		expect(fixture.orderCalls[2]).toMatchObject({ periodStart: MAY, creditAmount: '-10.000000' });
		expect(fixture.adjustmentsOf(fixture.cycle(MAY)?.id).map((row) => row.amount)).toEqual(['-10.000000']);
	});

	it('keeps the calendar on an attempt whose outcome was never recorded when the subscription is paused and resumed', async () => {
		const fixture = subscriptionFixture({ orders: idempotentOrders() });

		jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		// The claim is released; the frozen attempt is what shows its order may exist.
		expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PENDING, chargeClaimToken: null });

		await fixture.service.pause(SUBSCRIPTION, { reason: 'customer asked' });
		await fixture.service.resume(SUBSCRIPTION, new Date(APRIL.getTime() + 60 * 60 * 1000));

		expect(fixture.subscription(SUBSCRIPTION)?.nextBillingAt).toEqual(APRIL);

		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: new Date(APRIL.getTime() + 60 * 60 * 1000) });

		// The next pass recovers the attempt's order rather than opening a period an hour into the paid one.
		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.orderCalls[1]).toEqual(fixture.orderCalls[0]);
		expect(fixture.billings()).toHaveLength(1);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
	});

	it('keeps the opening period on its paid cycle when the subscription is paused and resumed before the cycle is finished', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { currentPeriodStart: new Date(APRIL), currentPeriodEnd: MAY, nextBillingAt: new Date(APRIL) })
			]
		});

		failNextFinish(fixture);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		await fixture.service.pause(SUBSCRIPTION, { reason: 'customer asked' });
		await fixture.service.resume(SUBSCRIPTION, new Date(APRIL.getTime() + 60 * 60 * 1000));

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ currentPeriodStart: APRIL, nextBillingAt: APRIL });
		expect(fixture.cycle(APRIL)?.periodStart).toEqual(APRIL);

		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: new Date(APRIL.getTime() + 60 * 60 * 1000) });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it('fences a cycle against the billing run while a correction writes it', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'cycle-april',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: MAY,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PENDING,
					dueAt: new Date(APRIL),
					paidAt: null,
					attemptCount: 0,
					metadata: { note: 'before' }
				}
			]
		});
		const claimCharge = fixture.billingService.claimCharge.bind(fixture.billingService);
		let interleaved: Awaited<ReturnType<SubscriptionService['billCycle']>> | undefined;

		// A billing pass reaches the cycle between the correction's read and its write.
		jest.spyOn(fixture.billingService, 'claimCharge').mockImplementationOnce(async (id) => {
			const fence = await claimCharge(id);

			interleaved = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			return fence;
		});

		await fixture.billingService.update('cycle-april', { metadata: { note: 'corrected' } });

		// The pass leaves the cycle to the correction: it freezes and charges nothing until the correction lands.
		expect(interleaved).toMatchObject({ status: SubscriptionBillingStatus.PENDING, replayed: true });
		expect(fixture.orderCalls).toEqual([]);
		expect(fixture.cycle(APRIL)).toMatchObject({ metadata: { note: 'corrected' }, chargeClaimToken: null });
	});

	it('refuses an operator’s payment or waiver of a cycle whose attempt may have an order, until a pass records it', async () => {
		const fixture = subscriptionFixture({ orders: idempotentOrders() });
		const inFlight = { response: { code: 'SUBSCRIPTION_BILLING_CHARGE_IN_FLIGHT' } };

		jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

		const cycleId = fixture.cycle(APRIL)!.id;

		// The claim is released, and the frozen attempt is what shows the order path may have taken the money.
		await expect(fixture.service.payCycle(cycleId)).rejects.toMatchObject(inFlight);
		await expect(fixture.billingService.markWaived(cycleId, { reason: 'goodwill' })).rejects.toMatchObject(inFlight);
		expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PENDING });

		// The next pass records the attempt's own order; nothing settled it by hand in between.
		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: MAY, billingCycleCount: 1 });
	});

	it.each([
		['pays', (fixture: ReturnType<typeof subscriptionFixture>) => fixture.service.payCycle('cycle-april')],
		['waives', (fixture: ReturnType<typeof subscriptionFixture>) => fixture.billingService.markWaived('cycle-april', { reason: 'goodwill' })]
	])(
		'refuses an operator who read the cycle before a pass froze an attempt and %s it after that pass was cut off',
		async (_action, settle) => {
			const fixture = subscriptionFixture({
				orders: idempotentOrders(),
				billings: [
					{
						id: 'cycle-april',
						tenantId: TENANT,
						organizationId: ORG,
						subscriptionId: SUBSCRIPTION,
						periodStart: new Date(APRIL),
						periodEnd: MAY,
						amount: '120.000000',
						currency: 'USD',
						status: SubscriptionBillingStatus.PENDING,
						dueAt: new Date(APRIL),
						paidAt: null,
						attemptCount: 0
					}
				]
			});
			const claimCharge = fixture.billingService.claimCharge.bind(fixture.billingService);

			// After the operator's read and before its write, a pass freezes an attempt, raises the order and is cut off
			// before recording it, releasing its claim.
			jest.spyOn(fixture.billingService, 'claimCharge').mockImplementationOnce(async (id) => {
				jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));
				await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow('the database went away');

				return claimCharge(id);
			});

			await expect(settle(fixture)).rejects.toMatchObject({ response: { code: 'SUBSCRIPTION_BILLING_CHARGE_IN_FLIGHT' } });
			expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PENDING, chargeClaimToken: null });

			// The next pass recovers the attempt's order.
			leaseRunsOut(fixture);
			await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

			expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.PAID, orderId: 'order-1' });
			expect(new Set(fixture.orderCalls.map((call) => call.idempotencyKey)).size).toBe(1);
		}
	);

	it('does not write a resume’s calendar back over the calendar a finish moved after the resume read it', async () => {
		let fixture: ReturnType<typeof subscriptionFixture>;
		let finished!: () => void;
		const finishing = new Promise<void>((resolve) => (finished = resolve));
		let resuming: Promise<unknown> | undefined;

		fixture = subscriptionFixture({
			orders: async () => {
				await fixture.service.pause(SUBSCRIPTION, { reason: 'customer asked' });

				// The resume reads the subscription — as of now, a snapshot as the database hands it — and decides to keep the
				// calendar on the cycle being charged; its write waits until that cycle's finish has moved the calendar.
				const read = fixture.service.findOneScoped.bind(fixture.service);
				const held = (fixture.service as any).calendarHeldByCycle.bind(fixture.service);

				jest.spyOn(fixture.service, 'findOneScoped').mockImplementationOnce(async (id) => ({ ...(await read(id)) }) as never);
				jest.spyOn(fixture.service as any, 'calendarHeldByCycle').mockImplementationOnce(async (subscription: unknown) => {
					const answer = await held(subscription);

					await finishing;

					return answer;
				});
				resuming = fixture.service.resume(SUBSCRIPTION, new Date(APRIL.getTime() + 60 * 60 * 1000));

				return { orderId: 'order-1', paid: true };
			}
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		// The finish moved the calendar and kept the pause.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.PAUSED, nextBillingAt: MAY });

		finished();
		await resuming;

		// The resume met the finish's write, read again and resumed onto the calendar as it now stands.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});

		leaseRunsOut(fixture);
		await fixture.service.runBilling({ asOf: new Date(APRIL.getTime() + 2 * 60 * 60 * 1000) });

		expect(fixture.subscription(SUBSCRIPTION)?.billingCycleCount).toBe(1);
		expect(named(fixture, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.orderCalls).toHaveLength(1);
	});

	it.each([
		['sent to the order path with its outcome never recorded', 'frozen'],
		['charged and not finished', 'unfinished']
	])('refuses to activate a pending subscription whose opening cycle was %s', async (_case, state) => {
		const fixture = subscriptionFixture({
			orders: idempotentOrders(),
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					status: SubscriptionStatus.PENDING,
					currentPeriodStart: new Date(APRIL),
					currentPeriodEnd: MAY,
					nextBillingAt: new Date(APRIL)
				})
			]
		});

		// An operator bills the pending subscription by hand, and the pass is cut off after the order.
		if (state === 'frozen') {
			jest.spyOn(fixture.billingService, 'markPaid').mockRejectedValueOnce(new Error('the database went away'));
		} else {
			failNextFinish(fixture);
		}

		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true })).rejects.toThrow(
			'the database went away'
		);

		// Activating it would start a period from now and leave the charge's finish pointing nowhere.
		await expect(fixture.service.activate(SUBSCRIPTION)).rejects.toMatchObject({
			message: expect.stringContaining('SUBSCRIPTION_OPENING_CYCLE_CHANGED')
		});
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.PENDING,
			currentPeriodStart: APRIL,
			nextBillingAt: APRIL
		});
		expect(fixture.cycle(APRIL)).toBeDefined();

		// The next pass recovers the charge, and the finish activates the subscription once.
		leaseRunsOut(fixture);
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: MAY,
			billingCycleCount: 1
		});
		expect(named(fixture, 'subscription.activated')).toHaveLength(1);
		expect(new Set(fixture.orderCalls.map((call) => call.idempotencyKey)).size).toBe(1);
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

	it('selects a trial whose end has passed, and leaves a pending subscription that has no trial alone', async () => {
		// **The defect this pins: no trial ever converted.** A trialing subscription is `PENDING` — the
		// status's own comment says that is what it covers — with `nextBillingAt` at the trial's end, and
		// the pass scanned `ACTIVE` and `PAUSED` only. The instant the trial ran out passed unnoticed, the
		// trial ran on for ever and nothing was charged, in every tenant, until a human called the
		// activate endpoint for each one.
		//
		// A `PENDING` subscription with no trial is a different thing — one nobody has started — and its
		// `nextBillingAt` is a period boundary that was never bought, so it stays where it is. The trial
		// end recorded at creation is what tells the two apart.
		const trialEnd = new Date('2026-03-12T00:00:00.000Z');
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('trial-over', {
					status: SubscriptionStatus.PENDING,
					nextBillingAt: trialEnd,
					currentPeriodEnd: trialEnd,
					metadata: { trialEndsAt: trialEnd.toISOString() }
				}),
				subscriptionRow('trial-running', {
					status: SubscriptionStatus.PENDING,
					nextBillingAt: new Date('2026-09-01T00:00:00.000Z'),
					currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
					metadata: { trialEndsAt: '2026-09-01T00:00:00.000Z' }
				}),
				subscriptionRow('never-activated', {
					status: SubscriptionStatus.PENDING,
					nextBillingAt: new Date('2026-03-01T00:00:00.000Z')
				})
			],
			items: [],
			billings: []
		});

		expect((await fixture.service.findDue(APRIL, 10)).map((row) => row.id)).toEqual(['trial-over']);
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

	/**
	 * R4-07: `PUT /subscriptions/:id` and `updateSubscription` both reach `applyChanges`, and it wrote whatever it was
	 * handed - `{status:"ACTIVE", nextBillingAt:"2020-01-01"}` reactivated a cancelled subscription for the next run to
	 * charge, `billingCycleCount: 0` re-charged the setup fee, a new `currency` desynchronised the items' prices. The
	 * edit moves the payer, the quantity and the metadata; the rest moves through the subscription's own actions.
	 */
	it.each([
		['status', SubscriptionStatus.ACTIVE],
		['nextBillingAt', new Date('2020-01-01T00:00:00.000Z')],
		['billingCycleCount', 0],
		['currency', 'EUR'],
		['customerId', 'another-customer'],
		['canceledAt', null]
	])('refuses to move %s through the edit, and leaves the row as it was', async (member, value) => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					status: SubscriptionStatus.CANCELED,
					canceledAt: new Date('2026-09-01T00:00:00.000Z'),
					billingCycleCount: 4
				})
			]
		});
		const before = { ...fixture.subscription(SUBSCRIPTION) };

		const refusal = await fixture.service
			.applyChanges(SUBSCRIPTION, { [member]: value } as never, asReadByTheCaller)
			.catch((error) => error);

		expect(refusal.response).toMatchObject({
			code: 'SUBSCRIPTION_FIELD_NOT_WRITABLE',
			details: { subscriptionId: SUBSCRIPTION, fields: [member] }
		});
		// The read the refusal is decided on attaches the relations to the fixture row; every stored column is as it was.
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject(before);
	});

	it('accepts a body that restates the lifecycle as stored, and writes the members it may', async () => {
		const fixture = subscriptionFixture();
		const stored = fixture.subscription(SUBSCRIPTION)!;

		const changed = await fixture.service.applyChanges(
			SUBSCRIPTION,
			{ status: stored.status, currency: stored.currency, quantity: '2', metadata: { seat: 'B' } } as never,
			asReadByTheCaller
		);

		expect(changed).toMatchObject({ status: stored.status, quantity: '2', metadata: { seat: 'B' } });
	});

	/**
	 * The restatement check compared any value as text, so every object read `'[object Object]'`: a body that CHANGED
	 * the items (read-only here; they move through the plan change) was taken for a restatement and silently dropped.
	 */
	it('refuses a body that changes a read-only object member, and accepts one that echoes it as read', async () => {
		const fixture = subscriptionFixture();
		const read = await fixture.service.findOneDetailed(SUBSCRIPTION);
		const items = JSON.parse(JSON.stringify(read.items)) as Array<Record<string, unknown>>;

		expect(items.length).toBeGreaterThan(0);

		const refusal = await fixture.service
			.applyChanges(
				SUBSCRIPTION,
				{ items: [{ ...items[0], quantity: '99' }, ...items.slice(1)], quantity: '2' } as never,
				asReadByTheCaller
			)
			.catch((error) => error);

		expect(refusal.response).toMatchObject({
			code: 'SUBSCRIPTION_FIELD_NOT_WRITABLE',
			details: { subscriptionId: SUBSCRIPTION, fields: ['items'] }
		});

		// The same items as they were read - members in another order, dates as ISO text - are a restatement.
		const echoed = items.map((item) => Object.fromEntries(Object.entries(item).reverse()));
		const changed = await fixture.service.applyChanges(
			SUBSCRIPTION,
			{ items: echoed, quantity: '2' } as never,
			asReadByTheCaller
		);

		expect(changed).toMatchObject({ quantity: '2' });
	});

	it('does not write a restated lifecycle member back over a cancellation that landed after the check (Greptile)', async () => {
		const fixture = subscriptionFixture();
		const stored = fixture.subscription(SUBSCRIPTION)!;

		// The edit was read and checked while ACTIVE; a cancellation lands before the statement runs.
		const original = fixture.service.findOneDetailed.bind(fixture.service);
		jest.spyOn(fixture.service, 'findOneDetailed').mockImplementationOnce(async (id: string) => {
			// What the check saw, as a snapshot: the row itself moves on after the read.
			const read = { ...(await original(id)) };
			stored.status = SubscriptionStatus.CANCELED;
			return read as never;
		});

		await fixture.service.applyChanges(SUBSCRIPTION, { status: SubscriptionStatus.ACTIVE, quantity: '2' } as never);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.CANCELED, quantity: '2' });
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
		// A cycle that resumes a pause that ran out writes the subscription twice: the resume, and the cycle it finishes
		// (the setup fee it remembers rides in that second write, `finishCycle`). The first carries the caller's version;
		// the second would be refused if it carried it too, because the row has moved on — by this request's own first
		// write.
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { setupFee: '30' }), planRow(BETTER_PLAN)],
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: new Date(APRIL) })]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true }, asReadByTheCaller);

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1,
			version: 3
		});
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);
	});

	it('remembers a cycle’s setup fee in the write that records the cycle, under the caller’s version', async () => {
		const fixture = subscriptionFixture({ plans: [planRow(PLAN, { setupFee: '30' }), planRow(BETTER_PLAN)] });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL, manual: true }, asReadByTheCaller);

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1,
			version: 2
		});
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['chargedSetupFeePlanIds']).toEqual([PLAN]);
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

describe('SubscriptionService — the opening period is billed, from creation to the first run', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('bills the period a subscription is created active with on the first run, setup fee included, on the cycle written at creation', async () => {
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { setupFee: '25' }), planRow(BETTER_PLAN)],
			subscriptions: [],
			items: [],
			billings: []
		});

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = created.currentPeriodStart as Date;
		const end = created.currentPeriodEnd as Date;
		const [opening] = fixture.billings(created.id);

		expect(opening).toMatchObject({
			status: SubscriptionBillingStatus.PENDING,
			periodStart: start,
			periodEnd: end
		});

		// The first run, at the instant the subscription started: the opening period is owed now.
		const run = await fixture.service.runBilling({ asOf: start });

		expect(run).toMatchObject({ examined: 1, billed: 1, failed: 0 });
		expect(run.results[0]).toMatchObject({ billingId: opening.id, periodStart: start, periodEnd: end });
		// One order, for the opening period, and the setup fee is charged with it: the first paid cycle.
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.orderCalls[0]).toMatchObject({ setupFee: '25.000000', firstCycle: true });
		// The cycle written at creation is the one settled: no second row, and none left pending.
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID })
		]);
		expect(fixture.subscription(created.id)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1,
			currentPeriodStart: start,
			currentPeriodEnd: end,
			nextBillingAt: end
		});
	});

	it('bills the period a later activation starts on the first run, on the cycle written at creation', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		// Read now: the fixture answers the stored row itself, which the activation then moves.
		const createdAt = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);

		expect(created.status).toBe(SubscriptionStatus.PENDING);
		expect(opening).toMatchObject({ status: SubscriptionBillingStatus.PENDING, periodStart: createdAt });

		// Activated later: the first period starts then, and the opening cycle moves with it.
		await new Promise((resolve) => setTimeout(resolve, 5));
		const activated = await fixture.service.activate(created.id);
		const start = activated.currentPeriodStart as Date;

		expect(start.getTime()).toBeGreaterThan(createdAt.getTime());
		expect(activated).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: start
		});
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({
				id: opening.id,
				status: SubscriptionBillingStatus.PENDING,
				periodStart: start,
				periodEnd: activated.currentPeriodEnd,
				dueAt: start
			})
		]);

		const run = await fixture.service.runBilling({ asOf: start });

		expect(run).toMatchObject({ examined: 1, billed: 1, failed: 0 });
		expect(run.results[0]).toMatchObject({ billingId: opening.id, periodStart: start });
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID, periodStart: start })
		]);
	});

	/**
	 * Two activations of one pending subscription, overlapping: the losing one read it `PENDING` too, and
	 * the winning one runs to completion between that read and the loser's own writes. The loser computes
	 * a later period than the one the winner activated.
	 *
	 * @param expectation The version the losing caller states.
	 * @returns The fixture, the subscription, the cycle written at creation and what the loser was answered.
	 */
	async function overlappingActivations(expectation?: IVersionExpectation) {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const [opening] = fixture.billings(created.id);
		const read = fixture.service.findOneScoped.bind(fixture.service);

		jest.spyOn(fixture.service, 'findOneScoped').mockImplementationOnce(async (id) => {
			// What the losing activation read: still `PENDING`.
			const seen = { ...(await read(id)) };

			await new Promise((resolve) => setTimeout(resolve, 5));
			await fixture.service.activate(id);
			await new Promise((resolve) => setTimeout(resolve, 5));

			return seen as never;
		});

		const answered = await fixture.service.activate(created.id, expectation).catch((error) => error);

		return { fixture, created, opening, answered };
	}

	it('refuses an overlapping activation before it moves the opening cycle off the period the winner activated', async () => {
		// Greptile on #10625: the opening cycle was moved before the subscription's versioned write, so the
		// loser moved the still-unbilled cycle to its own period and only then was refused — the subscription
		// stayed on the winner's period, the next run opened a second cycle for it, and the moved one was
		// never billed.
		const { fixture, created, opening, answered } = await overlappingActivations({ wildcard: false, versions: [1] });
		const stored = fixture.subscription(created.id) as Row;

		expect(answered).toBeInstanceOf(ApiException);
		expect(answered.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(stored).toMatchObject({ status: SubscriptionStatus.ACTIVE, version: 2 });
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({
				id: opening.id,
				status: SubscriptionBillingStatus.PENDING,
				periodStart: stored.currentPeriodStart,
				periodEnd: stored.currentPeriodEnd
			})
		]);

		// The first run bills that cycle, for the period the subscription is on, and opens no other.
		const run = await fixture.service.runBilling({ asOf: stored.currentPeriodStart as Date });

		expect(run).toMatchObject({ examined: 1, billed: 1, failed: 0 });
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID })
		]);
	});

	it('activates once when an overlapping activation states no version', async () => {
		// A scheduled pass states no version, and is predicated on the row's own: the subscription is
		// activated once, on one period, and its opening cycle sits on that period.
		const { fixture, created, opening, answered } = await overlappingActivations();
		const stored = fixture.subscription(created.id) as Row;

		expect(answered).toBeInstanceOf(ApiException);
		expect(answered.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(fixture.events.filter((event) => event.name === 'subscription.activated')).toHaveLength(1);
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, periodStart: stored.currentPeriodStart })
		]);
	});

	it('reads the opening cycle on the activation’s own transaction, not on a second connection', async () => {
		// Greptile on #10635: the activation holds a transaction connection while it moves the cycle; a read
		// through the service's default repository needs a second one, which a pool of one never frees.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const cycles = fixture.billingService.typeOrmSubscriptionBillingRepository as unknown as Row;
		const outside = [jest.spyOn(cycles, 'find'), jest.spyOn(cycles, 'findOne')];

		await new Promise((resolve) => setTimeout(resolve, 5));
		const activated = await fixture.service.activate(created.id);

		expect(outside.flatMap((spy) => spy.mock.calls)).toEqual([]);
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ periodStart: activated.currentPeriodStart, periodEnd: activated.currentPeriodEnd })
		]);
	});

	it('keeps the opening period owed when a subscription is paused and resumed before its first run', async () => {
		// Greptile on #10635: resuming set the next billing instant to the end of the current period, as if it
		// had been paid — the first run then billed the period after it and the opening cycle stayed pending.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);

		await fixture.service.pause(created.id, { reason: 'customer asked' });
		// Resumed ten days in: the opening period was not paid for, so it starts at the resume, as an
		// activation's would, and its cycle moves with it.
		const resumedAt = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
		const resumed = await fixture.service.resume(created.id, resumedAt);

		expect(resumed).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			currentPeriodStart: resumedAt,
			currentPeriodEnd: monthAfter(resumedAt),
			nextBillingAt: resumedAt
		});

		const run = await fixture.service.runBilling({ asOf: resumedAt });

		expect(run).toMatchObject({ examined: 1, billed: 1, failed: 0 });
		expect(run.results[0]).toMatchObject({ billingId: opening.id, periodStart: resumedAt });
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID, periodStart: resumedAt })
		]);
	});

	it('keeps a failed opening charge on its period and its retry when the subscription is paused and resumed', async () => {
		// Greptile and CodeRabbit on #10635: a failed first charge leaves the subscription never billed and
		// owed its opening period, and resuming restarted that period — the failed cycle could not move, so
		// the next run opened a new one, skipping the cycle's retry schedule and leaving it behind.
		let attempt = 0;
		const fixture = subscriptionFixture({
			subscriptions: [],
			items: [],
			billings: [],
			orders: () => {
				attempt += 1;

				if (attempt === 1) {
					throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
				}

				return { orderId: `order-${attempt}`, paid: true };
			}
		});
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);

		expect(await fixture.service.runBilling({ asOf: start })).toMatchObject({ billed: 0, failed: 1 });

		const failed = { ...fixture.billings(created.id)[0] };
		const retryAt = new Date(failed.nextRetryAt as Date);

		await fixture.service.pause(created.id, { reason: 'customer asked' });
		const resumed = await fixture.service.resume(created.id, new Date(start.getTime() + 60 * 60 * 1000));

		// Resuming lifts the pause and nothing else: the period, and the retry the failed cycle carries.
		expect(resumed).toMatchObject({ status: SubscriptionStatus.ACTIVE, currentPeriodStart: start, nextBillingAt: start });
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, periodStart: start, attemptCount: failed.attemptCount, nextRetryAt: failed.nextRetryAt })
		]);

		fixture.idempotencyService.advanceBy(retryAt.getTime() - start.getTime());
		const run = await fixture.service.runBilling({ asOf: retryAt });

		expect(run).toMatchObject({ billed: 1, failed: 0 });
		expect(run.results[0]).toMatchObject({ billingId: opening.id, periodStart: start });
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID })
		]);
	});

	it('advances past an opening cycle settled before the first run when the subscription is resumed', async () => {
		// Greptile on #10635: an opening cycle an operator recorded as paid is not a charge to retry —
		// keeping the next billing instant at its start would replay the settled cycle on every run.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const end = new Date(created.currentPeriodEnd as Date);
		const [opening] = fixture.billings(created.id);

		// Recorded by an operator, so without an order: only the billing run writes `orderId`, and a run-paid cycle the
		// run has not finished keeps the calendar instead ('keeps the opening period on its paid cycle …').
		await (fixture.billingService.typeOrmSubscriptionBillingRepository as unknown as Row).update(
			{ id: opening.id },
			{ status: SubscriptionBillingStatus.PAID, paidAt: start }
		);
		await fixture.service.pause(created.id, { reason: 'customer asked' });
		const resumed = await fixture.service.resume(created.id, new Date(start.getTime() + 60 * 60 * 1000));

		// The paid period runs out first: the next run bills the period after it.
		expect(resumed).toMatchObject({ status: SubscriptionStatus.ACTIVE, currentPeriodStart: start, nextBillingAt: end });
	});

	it('keeps the opening period when its charge is still running as the subscription is resumed', async () => {
		// Greptile on #10635: a charge still running has not recorded its order or attempt yet, so its cycle
		// reads untouched; moving it would let the returning charge settle a cycle on another period while
		// the subscription is written back onto the old one. The billing claim it holds is what shows it.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const end = new Date(created.currentPeriodEnd as Date);
		const [opening] = fixture.billings(created.id);
		const service = fixture.service as unknown as Row;
		const execute = service.executeCycle.bind(fixture.service);
		let resumed: Row | undefined;

		// CodeRabbit on #10635: the claim is the one a real billing pass takes — the pause and the resume land
		// while that pass holds it and its charge is running — and billing carries on after the resume.
		jest.spyOn(service as never, 'executeCycle' as never).mockImplementationOnce((async (...args: unknown[]) => {
			await fixture.service.pause(created.id, { reason: 'customer asked' });
			// A copy: the fixture answers the stored row itself, which the returning charge then advances.
			resumed = { ...(await fixture.service.resume(created.id, new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000))) } as never;

			return await execute(...args);
		}) as never);

		const run = await fixture.service.runBilling({ asOf: start });

		expect(resumed).toMatchObject({ status: SubscriptionStatus.ACTIVE, currentPeriodStart: start, nextBillingAt: start });
		expect(run).toMatchObject({ billed: 1, failed: 0 });
		expect(fixture.billings(created.id)).toEqual([
			expect.objectContaining({ id: opening.id, status: SubscriptionBillingStatus.PAID, periodStart: start })
		]);
		expect(fixture.subscription(created.id)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			currentPeriodStart: start,
			nextBillingAt: end,
			billingCycleCount: 1
		});
	});

	it('keeps the opening period while a pass holds its claim, even past the stale-lock window', async () => {
		// Greptile on #10635 ("Slow billing loses its protection"): a pass neither refreshes its claim nor stops
		// when the stale-lock window passes, so a claim's age cannot show that its charge stopped — moving the
		// cycle under a slow charge would put the order, the cycle and the subscription on different dates.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);

		await fixture.idempotencyService.claim({
			scope: 'subscription.bill',
			key: `${created.id}:${start.toISOString()}`,
			requestHash: 'a pass that stopped'
		});
		fixture.idempotencyService.advanceBy(3 * 60 * 1000);
		await fixture.service.pause(created.id, { reason: 'customer asked' });
		const resumedAt = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
		const resumed = await fixture.service.resume(created.id, resumedAt);

		expect(resumed).toMatchObject({ currentPeriodStart: start, nextBillingAt: start });
		expect(fixture.billings(created.id)).toEqual([expect.objectContaining({ id: opening.id, periodStart: start })]);
	});

	it('reads the running charge’s claim before the resume opens its transaction', async () => {
		// Greptile on #10635: the claim is read through the idempotency service's own connection, which a
		// pool of one cannot give while the resume holds its transaction's.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const manager = (fixture.service.typeOrmSubscriptionRepository as unknown as Row).manager;
		const transaction = manager.transaction;
		let open = false;
		const readInside: boolean[] = [];
		const findByKey = fixture.idempotencyService.findByKey;

		manager.transaction = async (run: (transactional: unknown) => Promise<unknown>) => {
			open = true;

			try {
				return await transaction(run);
			} finally {
				open = false;
			}
		};
		fixture.idempotencyService.findByKey = async (scope: string, key: string) => {
			readInside.push(open);

			return await findByKey(scope, key);
		};

		await fixture.service.pause(created.id, { reason: 'customer asked' });
		await fixture.service.resume(created.id);

		expect(readInside).toEqual([false]);
	});

	it('refuses the activation when the opening cycle was charged between its read and its move', async () => {
		// CodeRabbit on #10635: the move is predicated on the cycle still billing nothing, and a cycle that
		// lost that race stays put — committing the activation then would leave the subscription on a period
		// its cycle is not on.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const createdAt = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);
		const reschedule = fixture.billingService.reschedulePending.bind(fixture.billingService);

		jest.spyOn(fixture.billingService, 'reschedulePending').mockImplementationOnce(async (id, period, manager) => {
			// Another writer reaches the cycle after the activation read it.
			Object.assign(fixture.billings(created.id)[0], { orderId: 'order-raced', attemptCount: 1 });

			return await reschedule(id, period, manager);
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		const refusal = await fixture.service.activate(created.id).catch((error) => error);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(fixture.subscription(created.id)).toMatchObject({ status: SubscriptionStatus.PENDING, currentPeriodStart: createdAt });
		expect(fixture.billings(created.id)).toEqual([expect.objectContaining({ id: opening.id, periodStart: createdAt })]);
	});

	it('moves the cycle written for the opening period, not a later pending one', async () => {
		// CodeRabbit on #10635: the newest untouched pending cycle was taken for the opening one, so a later
		// cycle written through the billing-cycle route was moved instead, and the opening one stayed behind.
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const createdAt = new Date(created.currentPeriodStart as Date);
		const [opening] = fixture.billings(created.id);
		const later = new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000);

		// Written the way the billing-cycle route writes one: a row of its own, through the cycles' repository.
		await (fixture.billingService.typeOrmSubscriptionBillingRepository as unknown as Row).save({
			id: 'billing-later',
			tenantId: TENANT,
			organizationId: ORG,
			subscriptionId: created.id,
			periodStart: later,
			periodEnd: monthAfter(later),
			amount: '120.000000',
			currency: 'USD',
			status: SubscriptionBillingStatus.PENDING,
			dueAt: later,
			attemptCount: 0
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		const activated = await fixture.service.activate(created.id);

		expect(fixture.billings(created.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: opening.id, periodStart: activated.currentPeriodStart }),
				expect.objectContaining({ id: 'billing-later', periodStart: later, dueAt: later })
			])
		);
	});

	it('does not move a cycle that records an attempt', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'billing-attempted',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: MARCH,
					periodEnd: APRIL,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PENDING,
					dueAt: MARCH,
					attemptCount: 1
				}
			]
		});

		const answered = await fixture.billingService.reschedulePending('billing-attempted', {
			start: MID_MARCH,
			end: monthAfter(MID_MARCH)
		});

		expect(answered).toMatchObject({ periodStart: MARCH, periodEnd: APRIL, dueAt: MARCH });
		expect(fixture.billings()[0]).toMatchObject({ periodStart: MARCH, periodEnd: APRIL, dueAt: MARCH });
	});

	it('does not move a cycle a charge reached between the read and the write', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'billing-opening',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: MARCH,
					periodEnd: APRIL,
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PENDING,
					dueAt: MARCH,
					attemptCount: 0
				}
			]
		});
		const read = fixture.billingService.findOneScoped.bind(fixture.billingService);

		jest.spyOn(fixture.billingService, 'findOneScoped').mockImplementationOnce(async (id) => {
			// What the read saw, before the billing run raises the cycle's order right after it.
			const cycle = { ...(await read(id)) };

			Object.assign(fixture.billings()[0], { orderId: 'order-raced', attemptCount: 1 });

			return cycle;
		});

		const answered = await fixture.billingService.reschedulePending('billing-opening', {
			start: MID_MARCH,
			end: monthAfter(MID_MARCH)
		});

		expect(answered).toMatchObject({ orderId: 'order-raced', periodStart: MARCH, periodEnd: APRIL, dueAt: MARCH });
	});
});

describe('SubscriptionService → EntitlementGrantConsumer — the cancellation the consumer is sent', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * Hands an appended event to the entitlement package's real consumer, as the dispatcher would: in the
	 * envelope the outbox builds from its stored row (`EventOutboxService.toEnvelope`), whose payload went
	 * through a JSON column. The rights the subscription carries are one entitlement.
	 *
	 * @param appended The outbox row the subscription service appended.
	 * @returns The revocations the consumer made.
	 */
	async function deliver(appended: Row): Promise<unknown[][]> {
		const { EntitlementGrantConsumer } = jest.requireActual(
			'@gauzy/plugin-entitlement/src/lib/events/entitlement-grant.consumer'
		);
		const revoked: unknown[][] = [];
		const entitlementService = {
			find: async (options: Row) => [{ id: 'entitlement-1', subscriptionId: options.where.subscriptionId }],
			revoke: async (...args: unknown[]) => {
				revoked.push(args);
			}
		};

		await new EntitlementGrantConsumer(entitlementService).handle(
			{
				id: 'event-1',
				name: appended.name,
				tenantId: appended.tenantId,
				organizationId: appended.organizationId,
				aggregate: { type: appended.aggregateType, id: appended.aggregateId },
				data: JSON.parse(JSON.stringify(appended.data))
			},
			{ assertOrder: async () => undefined, alreadyDelivered: async () => false }
		);

		return revoked;
	}

	const canceled = (events: Row[]) => events.filter((event) => event.name === 'subscription.canceled');

	it('withdraws the rights of a subscription cancelled with immediate effect', async () => {
		const fixture = subscriptionFixture();

		await fixture.service.cancel(SUBSCRIPTION, { reason: 'customer left', immediate: true });

		expect(await deliver(canceled(fixture.events)[0])).toEqual([
			['entitlement-1', 'SUBSCRIPTION_ENDED', { tenantId: TENANT, organizationId: ORG }]
		]);
	});

	it('leaves them for the period paid for, and withdraws them when the billing run ends it', async () => {
		const fixture = subscriptionFixture();

		await fixture.service.cancel(SUBSCRIPTION, { reason: 'at the end of the month' });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.ACTIVE });
		expect(await deliver(canceled(fixture.events)[0])).toEqual([]);

		// The period runs out: the run cancels it with immediate effect, and that event ends the rights.
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.CANCELED });
		expect(await deliver(canceled(fixture.events)[1])).toEqual([
			['entitlement-1', 'SUBSCRIPTION_ENDED', { tenantId: TENANT, organizationId: ORG }]
		]);
	});
});


/**
 * The upcoming billing, previewed.
 *
 * The preview exists so a customer can be told what the next cycle will cost before it is charged, so
 * the one property that matters is that it is the charge: the suite drives the preview and then the
 * cycle itself over the same fixture and asserts that the cycle billed exactly what the preview said,
 * for exactly the period it said. The amount is computed by the one function the cycle bills with,
 * which is what makes that agreement structural rather than coincidental. The other two properties are
 * the ones a read has to have: it writes nothing — no key, no row, no adjustment, no order, no event —
 * and it reads nothing outside the caller's tenant and organization.
 */
describe('SubscriptionService — previewing the next billing', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const MAY = new Date('2026-05-01T00:00:00.000Z');

	/** Everything a preview could have written, so "it wrote nothing" is a comparison rather than a hope. */
	const everythingWritten = (fixture: ReturnType<typeof subscriptionFixture>) =>
		JSON.stringify({
			tables: fixture.tables,
			events: fixture.events,
			orderCalls: fixture.orderCalls,
			prorationCalls: fixture.prorationCalls,
			adjustments: fixture.adjustments,
			commits: fixture.commits,
			keys: [...fixture.idempotencyService.records.entries()]
		});

	it.each([
		['at the plan’s price', {}, '120.000000'],
		['with the plan’s discount', { plans: [planRow(PLAN, { discountPercentage: '0.1' }), planRow(BETTER_PLAN)] }, '108.000000'],
		[
			'with the discount the subscription was sold with',
			{ subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { discountPercentage: '0.25' } })] },
			'90.000000'
		],
		[
			'over two recurring lines',
			{
				items: [
					itemRow('item-1'),
					itemRow('item-2', { variantId: BETTER_VARIANT, quantity: '2.000000', unitPrice: '15.500000', position: 1 })
				]
			},
			'151.000000'
		]
	])('previews exactly what the cycle then bills — %s', async (_case, options, amount) => {
		const fixture = subscriptionFixture(options as Row);

		const preview = await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH);

		expect(preview).toEqual({
			subscriptionId: SUBSCRIPTION,
			amount,
			currency: 'USD',
			periodStart: APRIL,
			periodEnd: monthAfter(APRIL),
			nextBillingAt: APRIL
		});

		// The same state, billed at the instant the preview said the cycle is due.
		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: preview?.nextBillingAt });

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(outcome.amount).toBe(preview?.amount);
		expect(outcome.currency).toBe(preview?.currency);
		expect(new Date(outcome.periodStart as Date)).toEqual(preview?.periodStart);
		expect(new Date(outcome.periodEnd as Date)).toEqual(preview?.periodEnd);
		expect(fixture.orderCalls[0].amount).toBe(preview?.amount);
		expect(fixture.cycle(APRIL)?.amount).toBe(preview?.amount);
	});

	it('writes nothing at all', async () => {
		// A state with every write a cycle makes in reach: a discount to append, a credit to consume.
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { discountPercentage: '0.1', setupFee: '9.99' }), planRow(BETTER_PLAN)],
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: { amount: '-5.000000', currency: 'USD' } } })]
		});
		const before = everythingWritten(fixture);

		await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH);
		await fixture.service.previewNextBilling(SUBSCRIPTION, APRIL);

		expect(everythingWritten(fixture)).toBe(before);

		// The control: the cycle itself does write, so the comparison above can see a write when one happens.
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(everythingWritten(fixture)).not.toBe(before);
	});

	it('refuses a subscription of another tenant or another organization, as the cycle does', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('theirs', { tenantId: 'another-tenant' }),
				subscriptionRow('elsewhere', { organizationId: 'another-organization' })
			]
		});

		await expect(fixture.service.previewNextBilling('theirs', MID_MARCH)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.previewNextBilling('elsewhere', MID_MARCH)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.previewNextBilling('no-such-subscription', MID_MARCH)).rejects.toBeInstanceOf(
			NotFoundException
		);
		// The control: the cycle refuses the same row, so the preview is no wider than the bill.
		await expect(fixture.service.billCycle('theirs', { asOf: APRIL })).rejects.toBeInstanceOf(NotFoundException);
	});

	it.each([
		['cancelled', { subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.CANCELED })] }],
		['expired', { subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.EXPIRED })] }],
		['paused with no end', { subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED })] }],
		[
			'at its plan’s cycle ceiling',
			{
				plans: [planRow(PLAN, { maxBillingCycles: 3 }), planRow(BETTER_PLAN)],
				subscriptions: [subscriptionRow(SUBSCRIPTION, { billingCycleCount: 3 })]
			}
		],
		[
			'cancelled at the end of the period it would next bill',
			{ subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true } })] }
		]
	])('answers null for a subscription %s, and the cycle bills nothing either', async (_case, options) => {
		const fixture = subscriptionFixture(options as Row);

		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH)).toBeNull();

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.billings()).toEqual([]);
		expect(fixture.orderCalls).toEqual([]);
	});

	it('previews a paused subscription from the instant its pause ends, which is when the cycle bills it', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil: MAY })]
		});

		const preview = await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH);

		// The pause outlasts the period already paid for, so the next period starts when the pause ends.
		expect(preview).toMatchObject({ amount: '120.000000', periodStart: MAY, periodEnd: monthAfter(MAY), nextBillingAt: MAY });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: preview?.nextBillingAt });

		expect(outcome).toMatchObject({ status: SubscriptionBillingStatus.PAID, amount: preview?.amount });
		expect(new Date(outcome.periodStart as Date)).toEqual(MAY);
	});

	it('previews a pause that ends inside the paid period from the end of that period', async () => {
		const pausedUntil = new Date('2026-03-20T00:00:00.000Z');
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PAUSED, pausedUntil })]
		});

		const preview = await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH);

		expect(preview).toMatchObject({ periodStart: APRIL, nextBillingAt: APRIL });

		// The run takes it when the pause ends, resumes it and bills the period after the one already paid for.
		const run = await fixture.service.runBilling({ asOf: pausedUntil });

		expect(run).toMatchObject({ examined: 1, billed: 1 });
		expect(new Date(run.results[0].periodStart as Date)).toEqual(APRIL);
		expect(run.results[0].amount).toBe(preview?.amount);
	});

	it('previews a paused subscription that still owes its opening period from the instant it resumes', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);
		const pausedUntil = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);

		await fixture.service.pause(created.id, { until: pausedUntil, reason: 'customer asked' });
		const before = everythingWritten(fixture);

		const preview = await fixture.service.previewNextBilling(created.id, new Date(start.getTime() + 60 * 60 * 1000));

		// The opening period was never paid for, so it restarts at the resume — not at the end of the period
		// the subscription was opened on, which is what the rule for a paid period would have answered.
		// (The period's end is compared with the bill's below rather than computed here: the run's own month
		// arithmetic clamps at a month's end, which a fixed offset from the wall clock can land on.)
		expect(preview).toMatchObject({ amount: '120.000000', periodStart: pausedUntil, nextBillingAt: pausedUntil });
		expect(preview?.periodEnd.getTime()).toBeGreaterThan(pausedUntil.getTime());
		expect(everythingWritten(fixture)).toBe(before);

		const run = await fixture.service.runBilling({ asOf: pausedUntil });

		expect(run).toMatchObject({ examined: 1, billed: 1 });
		expect(run.results[0]).toMatchObject({ amount: preview?.amount });
		expect(new Date(run.results[0].periodStart as Date)).toEqual(preview?.periodStart);
		expect(new Date(run.results[0].periodEnd as Date)).toEqual(preview?.periodEnd);
	});

	it('previews a failed opening charge on its own period when the subscription is paused', async () => {
		let attempt = 0;
		const fixture = subscriptionFixture({
			subscriptions: [],
			items: [],
			billings: [],
			orders: () => {
				attempt += 1;

				if (attempt === 1) {
					throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
				}

				return { orderId: `order-${attempt}`, paid: true };
			}
		});
		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			activate: true,
			items: [{ variantId: VARIANT, unitPrice: '120' }]
		});
		const start = new Date(created.currentPeriodStart as Date);

		expect(await fixture.service.runBilling({ asOf: start })).toMatchObject({ billed: 0, failed: 1 });

		const pausedUntil = new Date(start.getTime() + 2 * 60 * 60 * 1000);

		await fixture.service.pause(created.id, { until: pausedUntil, reason: 'customer asked' });

		// The charged cycle keeps its period and its retries, so the period the preview names is the one it is on,
		// billed when its retry comes rather than when the pause ends.
		const retryAt = new Date(fixture.billings(created.id)[0].nextRetryAt as Date);

		expect(retryAt.getTime()).toBeGreaterThan(pausedUntil.getTime());
		expect(await fixture.service.previewNextBilling(created.id, new Date(start.getTime() + 60 * 60 * 1000))).toMatchObject({
			periodStart: start,
			periodEnd: new Date(created.currentPeriodEnd as Date),
			nextBillingAt: retryAt
		});
	});

	it('previews a trial from the instant it ends, which is when the run converts it', async () => {
		// A trialing subscription is `PENDING` with its billing instant at the trial's end (`createSubscription`), and
		// the run selects it by the trial end its metadata records (`findDue`).
		const trialEndsAt = new Date('2026-03-20T00:00:00.000Z');
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					status: SubscriptionStatus.PENDING,
					nextBillingAt: trialEndsAt,
					currentPeriodEnd: trialEndsAt,
					metadata: { trialEndsAt: trialEndsAt.toISOString() }
				})
			]
		});

		const preview = await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH);

		expect(preview).toEqual({
			subscriptionId: SUBSCRIPTION,
			amount: '120.000000',
			currency: 'USD',
			periodStart: trialEndsAt,
			periodEnd: monthAfter(trialEndsAt),
			nextBillingAt: trialEndsAt
		});

		const run = await fixture.service.runBilling({ asOf: trialEndsAt });

		expect(run).toMatchObject({ examined: 1, billed: 1 });
		expect(run.results[0]).toMatchObject({ status: SubscriptionBillingStatus.PAID, amount: preview?.amount });
		expect(new Date(run.results[0].periodStart as Date)).toEqual(preview?.periodStart);
		expect(new Date(run.results[0].periodEnd as Date)).toEqual(preview?.periodEnd);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.ACTIVE });
	});

	it.each([
		['pending and never activated', { status: SubscriptionStatus.PENDING }],
		['failed, its retries spent', { status: SubscriptionStatus.FAILED, nextBillingAt: null }]
	])('answers null for a subscription %s, which no billing run takes', async (_case, overrides) => {
		const fixture = subscriptionFixture({ subscriptions: [subscriptionRow(SUBSCRIPTION, overrides)] });

		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH)).toBeNull();

		// The control: a run long after every instant the row carries still examines nothing.
		expect(await fixture.service.runBilling({ asOf: monthAfter(monthAfter(APRIL)) })).toMatchObject({ examined: 0 });
		expect(fixture.orderCalls).toEqual([]);
	});

	it('answers null when the period it would bill is already settled, as the cycle bills nothing for it', async () => {
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

		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH)).toBeNull();

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(outcome).toMatchObject({ replayed: true, billingId: 'cycle-settled' });
		expect(fixture.orderCalls).toEqual([]);
	});

	it('previews the retry after a failed charge: its period, at the retry instant, for what the retry charges', async () => {
		// Greptile on #10650: after a failed charge the subscription stays `ACTIVE` with its billing instant on the
		// failed period's start, and the cycle row carries the dunning schedule's next attempt. No run charges the
		// period before that attempt (`executeCycle`), so the preview's billing instant is the retry, not a date
		// already past.
		let attempt = 0;
		const fixture = subscriptionFixture({
			orders: () => {
				attempt += 1;

				if (attempt === 1) {
					throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
				}

				return { orderId: `order-${attempt}`, paid: true };
			}
		});

		expect(await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).toMatchObject({
			status: SubscriptionBillingStatus.FAILED
		});

		const failed = { ...fixture.cycle(APRIL) } as Row;
		const retryAt = new Date(failed.nextRetryAt as Date);

		expect(retryAt.getTime()).toBeGreaterThan(APRIL.getTime());

		// The retry re-prices: it charges the lines as they stand when it runs, not the amount the failed
		// attempt recorded. A line repriced while the cycle waits is what tells the two apart.
		fixture.tables.subscription_item[0].unitPrice = '150.000000';

		const asked = new Date(APRIL.getTime() + 60 * 60 * 1000);
		const before = everythingWritten(fixture);
		const preview = await fixture.service.previewNextBilling(SUBSCRIPTION, asked);

		expect(preview).toEqual({
			subscriptionId: SUBSCRIPTION,
			amount: '150.000000',
			currency: 'USD',
			periodStart: APRIL,
			periodEnd: monthAfter(APRIL),
			nextBillingAt: retryAt
		});
		expect(everythingWritten(fixture)).toBe(before);

		// The control, before the retry instant: a run charges nothing.
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: asked });

		expect(fixture.orderCalls).toHaveLength(1);

		// At the retry instant (the failed attempt's claim aged out by then), the cycle charges what the preview said.
		fixture.idempotencyService.advanceBy(retryAt.getTime() - APRIL.getTime());
		const retried = await fixture.service.billCycle(SUBSCRIPTION, { asOf: retryAt });

		expect(retried).toMatchObject({ status: SubscriptionBillingStatus.PAID, billingId: failed.id });
		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.orderCalls[1].amount).toBe(preview?.amount);
		expect(new Date(fixture.orderCalls[1].periodStart)).toEqual(preview?.periodStart);
		expect(failed.amount).toBe('120.000000');
	});

	it('answers null when a cancellation at the period end takes effect before the retry', async () => {
		// A daily plan's opening period ends before the dunning schedule's first retry, a day after the failure.
		// Every run reads the cancellation before it reaches the retry, so the retry never charges.
		const dayAfter = new Date(MARCH.getTime() + 24 * 60 * 60 * 1000);
		let attempt = 0;
		const fixture = subscriptionFixture({
			plans: [planRow(PLAN, { billingPeriod: SubscriptionBillingPeriod.DAILY }), planRow(BETTER_PLAN)],
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					currentPeriodStart: new Date(MARCH),
					currentPeriodEnd: dayAfter,
					nextBillingAt: new Date(MARCH)
				})
			],
			orders: () => {
				attempt += 1;

				throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
			}
		});

		expect(await fixture.service.billCycle(SUBSCRIPTION, { asOf: MARCH })).toMatchObject({
			status: SubscriptionBillingStatus.FAILED
		});

		const retryAt = new Date(fixture.cycle(MARCH)?.nextRetryAt as Date);

		expect(retryAt.getTime()).toBeGreaterThanOrEqual(dayAfter.getTime());

		await fixture.service.cancel(SUBSCRIPTION, { reason: 'customer asked' });

		const asked = new Date(MARCH.getTime() + 60 * 60 * 1000);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			metadata: { cancelAtPeriodEnd: true }
		});
		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, asked)).toBeNull();

		// The control: the run at the retry instant cancels instead of charging.
		fixture.idempotencyService.advanceBy(retryAt.getTime() - MARCH.getTime());
		await fixture.service.billCycle(SUBSCRIPTION, { asOf: retryAt });

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ status: SubscriptionStatus.CANCELED });
		expect(attempt).toBe(1);
	});

	it('answers null once the retries are spent, because the run never takes a failed subscription', async () => {
		const fixture = subscriptionFixture({
			orders: () => {
				throw new Error('SUBSCRIPTION_CHARGE_DECLINED: the card was declined');
			}
		});
		let asOf = APRIL;

		// Every attempt the dunning schedule allows, each at its own retry instant.
		for (let attempts = 0; fixture.subscription(SUBSCRIPTION)?.status !== SubscriptionStatus.FAILED; attempts++) {
			expect(attempts).toBeLessThan(10);
			fixture.idempotencyService.advanceBy(10 * 60 * 1000);
			await fixture.service.billCycle(SUBSCRIPTION, { asOf });
			asOf = new Date((fixture.cycle(APRIL)?.nextRetryAt as Date) ?? asOf);
		}

		expect(fixture.cycle(APRIL)).toMatchObject({ status: SubscriptionBillingStatus.FAILED, nextRetryAt: null });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ nextBillingAt: null });
		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, monthAfter(APRIL))).toBeNull();

		// The control: a run long after the last attempt examines nothing; only an operator bills it again.
		const calls = fixture.orderCalls.length;

		expect(await fixture.service.runBilling({ asOf: monthAfter(monthAfter(APRIL)) })).toMatchObject({ examined: 0 });
		expect(fixture.orderCalls).toHaveLength(calls);
	});

	it('refuses to preview a subscription with no recurring lines, as the cycle refuses to bill it', async () => {
		const fixture = subscriptionFixture({ items: [] });

		await expect(fixture.service.previewNextBilling(SUBSCRIPTION, MID_MARCH)).rejects.toThrow(/SUBSCRIPTION_ITEMS_REQUIRED/);
		await expect(fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL })).rejects.toThrow(/SUBSCRIPTION_ITEMS_REQUIRED/);
	});
});

/**
 * SEC-B-03: subscription `metadata` was a billing-control channel an editor could write on both protocols. The billing
 * run reads `discountPercentage` (a per-subscription discount override, never range-checked), `pendingCredit` (a
 * credit appended to the next cycle), `chargedSetupFeePlanIds` (which suppresses setup fees) and `trialEndsAt` (when
 * billing starts) from it. Those keys are the service's own: a caller's metadata can neither set nor erase them, and a
 * discount is a fraction between 0 and 1 wherever it comes from.
 */
describe('SubscriptionService — the metadata billing trusts is the service’s own (SEC-B-03)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const planted = {
		discountPercentage: '1',
		pendingCredit: { amount: '100000', currency: 'USD' },
		chargedSetupFeePlanIds: [],
		trialEndsAt: '2099-01-01T00:00:00.000Z',
		note: 'kept'
	};

	it('an edit keeps the caller’s own keys, and neither sets nor erases the reserved ones', async () => {
		// The failure scenario: `updateSubscription(id, { metadata: { discountPercentage: "1" } })` billed every later
		// cycle at 0, and `pendingCredit` credited the next one.
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { chargedSetupFeePlanIds: [PLAN] } })]
		});

		await fixture.service.applyChanges(SUBSCRIPTION, { metadata: planted } as never);

		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toEqual({ chargedSetupFeePlanIds: [PLAN], note: 'kept' });
	});

	it('a creation keeps the caller’s own keys and none of the reserved ones', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		const created = await fixture.service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }],
			metadata: planted
		} as never);

		expect(created.metadata).toEqual({ note: 'kept' });
	});

	it('refuses a creation discount that is not a fraction between 0 and 1, and stores one that is', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const input = (discountPercentage: string) =>
			({
				planId: PLAN,
				customerId: CUSTOMER,
				paymentAccountHolderId: HOLDER,
				paymentMethodTokenId: TOKEN,
				items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }],
				discountPercentage
			}) as never;

		await expect(fixture.service.createSubscription(input('2'))).rejects.toMatchObject({
			message: expect.stringContaining('SUBSCRIPTION_DISCOUNT_OUT_OF_RANGE')
		});

		const created = await fixture.service.createSubscription(input('0.25'));
		expect(Number(created.metadata?.['discountPercentage'])).toBe(0.25);
	});

	it('bills a stored discount outside 0..1 — written before this fix — at the plan’s own terms, never a negative net', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { discountPercentage: '2' } })]
		});

		const outcome = await fixture.service.billCycle(SUBSCRIPTION, { asOf: new Date(APRIL.getTime() + 60_000) });

		expect(outcome).toMatchObject({ amount: '120.000000' });
	});

	it('reserves the proration threshold and the cancellation at the period end too (CodeRabbit)', async () => {
		// `{ minimumProrationCharge: "1000000" }` waived every upgrade's charge, and `{ cancelAtPeriodEnd: true }`
		// cancelled the subscription at the next run with no cancellation, reason or event — or, erased, revived one
		// the customer had cancelled.
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true, minimumProrationCharge: '5' } })
			]
		});

		await fixture.service.applyChanges(SUBSCRIPTION, {
			metadata: { minimumProrationCharge: '1000000', note: 'kept' }
		} as never);

		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toEqual({
			cancelAtPeriodEnd: true,
			minimumProrationCharge: '5',
			note: 'kept'
		});

		const created = await subscriptionFixture({
			subscriptions: [],
			items: [],
			billings: []
		}).service.createSubscription({
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }],
			metadata: { minimumProrationCharge: '1000000', cancelAtPeriodEnd: true, note: 'kept' }
		} as never);

		expect(created.metadata).toEqual({ note: 'kept' });
	});

	it('refuses a creation discount one digit past 1, which rounds to 1 as a double (CodeRabbit)', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });

		await expect(
			fixture.service.createSubscription({
				planId: PLAN,
				customerId: CUSTOMER,
				paymentAccountHolderId: HOLDER,
				paymentMethodTokenId: TOKEN,
				items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }],
				discountPercentage: '1.00000000000000001'
			} as never)
		).rejects.toMatchObject({ message: expect.stringContaining('SUBSCRIPTION_DISCOUNT_OUT_OF_RANGE') });
		expect(fixture.tables.subscription).toEqual([]);
	});
});

/**
 * Greptile and CodeRabbit on #10655: an edit carries the reserved keys over from the read it makes before the write.
 * With `If-Match: *` (or no caller) the write was predicated on whatever version the row held when the statement ran,
 * so a billing pass that consumed `pendingCredit` between that read and the write had the credit written back, and
 * the next cycle applied it again. The write is now predicated on the version the read saw: a wildcard re-reads and
 * rebuilds the merge, and a caller's stated version keeps its meaning.
 */
describe('SubscriptionService — an edit never writes back the credit a billing pass consumed', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const credit = { amount: '30.000000', currency: 'USD' };

	/**
	 * A fixture whose billing pass lands between the edit's first read and its write: the read is a snapshot, then the
	 * pass consumes the carried credit and moves the row one version on.
	 */
	function racedByABillingPass() {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { pendingCredit: credit, chargedSetupFeePlanIds: [PLAN] } })
			]
		});
		const original = fixture.service.findOneDetailed.bind(fixture.service);

		jest.spyOn(fixture.service, 'findOneDetailed').mockImplementationOnce(async (id: string) => {
			const read = { ...(await original(id)) };
			const row = fixture.subscription(SUBSCRIPTION)!;

			// The pass's own write: the credit is consumed and the row is one version further on.
			row.metadata = { chargedSetupFeePlanIds: [PLAN] };
			row.version = 2;

			return read as never;
		});

		return fixture;
	}

	it('rebuilds a wildcard edit from the row as the pass left it', async () => {
		const fixture = racedByABillingPass();

		const changed = await fixture.service.applyChanges(SUBSCRIPTION, { metadata: { note: 'kept' } } as never);

		expect(changed.metadata).toEqual({ chargedSetupFeePlanIds: [PLAN], note: 'kept' });
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({ version: 3 });
	});

	it('rebuilds an edit whose caller accepted both versions, from the later one', async () => {
		const fixture = racedByABillingPass();

		await fixture.service.applyChanges(SUBSCRIPTION, { metadata: { note: 'kept' } } as never, {
			wildcard: false,
			versions: [1, 2]
		});

		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toEqual({ chargedSetupFeePlanIds: [PLAN], note: 'kept' });
	});

	it('refuses an edit stated at a version the read did not see, rather than writing the read’s credit at it', async () => {
		// `If-Match: "2"` while the read saw 1: predicated on the caller's version, the write landed once the pass
		// moved the row to 2 — with the credit the pass had just consumed.
		const fixture = racedByABillingPass();

		const refusal = await fixture.service
			.applyChanges(SUBSCRIPTION, { metadata: { note: 'kept' } } as never, { wildcard: false, versions: [2] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			metadata: { chargedSetupFeePlanIds: [PLAN] },
			version: 2
		});
	});

	it('keeps a caller’s stated version: an edit read at the version the pass moved past is a conflict', async () => {
		const fixture = racedByABillingPass();

		const refusal = await fixture.service
			.applyChanges(SUBSCRIPTION, { metadata: { note: 'kept' } } as never, { wildcard: false, versions: [1] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.getStatus()).toBe(409);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			metadata: { chargedSetupFeePlanIds: [PLAN] },
			version: 2
		});
	});
});

/**
 * Q16 (4): `cancel({ immediate: false })` records `cancelAtPeriodEnd`, a key the service owns (SEC-B-03, #10655) —
 * a caller's metadata can neither set nor erase it — and no action withdrew it, so a customer who changed their mind
 * could only let the subscription end and start another. `undoCancellation` is that action.
 */
describe('SubscriptionService — undoing a cancellation at the end of the period (Q16)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('withdraws the deferred cancellation and keeps the period the customer paid for', async () => {
		const fixture = subscriptionFixture();

		await fixture.service.cancel(SUBSCRIPTION, { reason: 'too expensive' });

		const kept = await fixture.service.undoCancellation(SUBSCRIPTION);

		expect(kept).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			nextBillingAt: APRIL,
			currentPeriodEnd: APRIL
		});
		expect(kept.canceledAt).toBeNull();
		expect(kept.cancelReason).toBeNull();
		expect(kept.metadata?.['cancelAtPeriodEnd']).toBeUndefined();
		expect(fixture.events.map((event) => event.name)).toEqual([
			'subscription.canceled',
			'subscription.cancellation-undone'
		]);
	});

	it('keeps the caller’s own metadata and the service’s other keys', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, { metadata: { note: 'kept', chargedSetupFeePlanIds: [PLAN] } })
			]
		});

		await fixture.service.cancel(SUBSCRIPTION);
		await fixture.service.undoCancellation(SUBSCRIPTION);

		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toEqual({ note: 'kept', chargedSetupFeePlanIds: [PLAN] });
	});

	it('bills the next period instead of cancelling once the cancellation is undone', async () => {
		const fixture = subscriptionFixture();

		await fixture.service.cancel(SUBSCRIPTION, { reason: 'customer asked' });
		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, MARCH)).toBeNull();

		await fixture.service.undoCancellation(SUBSCRIPTION);

		expect(await fixture.service.previewNextBilling(SUBSCRIPTION, MARCH)).not.toBeNull();
	});

	it('answers a live subscription with no deferred cancellation with itself, and appends nothing', async () => {
		const fixture = subscriptionFixture();

		await expect(fixture.service.undoCancellation(SUBSCRIPTION)).resolves.toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			version: 1
		});
		expect(fixture.events).toEqual([]);
	});

	it('refuses a cancellation that already took effect, which is reactivated as a new subscription', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('canceled', {
					status: SubscriptionStatus.CANCELED,
					metadata: { cancelAtPeriodEnd: true }
				}),
				subscriptionRow('expired', { status: SubscriptionStatus.EXPIRED })
			]
		});

		await expect(fixture.service.undoCancellation('canceled')).rejects.toThrow(/cannot be changed/);
		await expect(fixture.service.undoCancellation('expired')).rejects.toThrow(/cannot be changed/);
		expect(fixture.subscription('canceled')).toMatchObject({
			status: SubscriptionStatus.CANCELED,
			metadata: { cancelAtPeriodEnd: true }
		});
	});

	it('does not overwrite the billing run that ended the period between the read and the write', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true }, canceledAt: MARCH })]
		});
		const original = fixture.service.findOneScoped.bind(fixture.service);

		jest.spyOn(fixture.service, 'findOneScoped').mockImplementationOnce(async (id: string) => {
			const read = { ...(await original(id)) };
			const row = fixture.subscription(SUBSCRIPTION)!;

			// The run's own write: the period ran out and the subscription is cancelled, one version further on.
			row.status = SubscriptionStatus.CANCELED;
			row.nextBillingAt = null;
			row.version = 2;

			return read as never;
		});

		await expect(fixture.service.undoCancellation(SUBSCRIPTION)).rejects.toThrow(/cannot be changed/);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.CANCELED,
			version: 2,
			metadata: { cancelAtPeriodEnd: true }
		});
		expect(fixture.events).toEqual([]);
	});

	it('does not cancel at the period end after an undo that landed while the billing run was deciding (Greptile)', async () => {
		// The run reads the marker, the undo commits, then the run cancels: predicated on whatever version the row held,
		// the cancellation landed over the undo the customer had just been told succeeded.
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true }, canceledAt: MARCH })]
		});
		const original = fixture.service.findOneScoped.bind(fixture.service);

		jest.spyOn(fixture.service, 'findOneScoped').mockImplementationOnce(async (id: string) => {
			const read = { ...(await original(id)) };

			await fixture.service.undoCancellation(id);

			return read as never;
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)?.status).not.toBe(SubscriptionStatus.CANCELED);
		expect(fixture.subscription(SUBSCRIPTION)?.metadata?.['cancelAtPeriodEnd']).toBeUndefined();
		expect(fixture.events.map((event) => event.name)).not.toContain('subscription.canceled');
	});

	it('CONTROL: still cancels at the period end when nothing undid the cancellation', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true }, canceledAt: MARCH })]
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: APRIL });

		expect(fixture.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.CANCELED);
	});

	it('refuses a stated version the subscription has moved past', async () => {
		const fixture = subscriptionFixture({
			subscriptions: [subscriptionRow(SUBSCRIPTION, { metadata: { cancelAtPeriodEnd: true }, version: 3 })]
		});

		const refusal = await fixture.service
			.undoCancellation(SUBSCRIPTION, { wildcard: false, versions: [2] })
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toEqual({ cancelAtPeriodEnd: true });
	});
});

/**
 * R4-05 (interim): an unpaid `INVOICED` cycle was counted as settled.
 *
 * The run raised the cycle's order, the order was not paid, the cycle was recorded `INVOICED` — and
 * `recordSuccess` then emitted `subscription.renewed` (which the entitlement package extends every right on)
 * and, for a trial, `subscription.activated`, exactly as for a paid cycle. Rights were extended for a period
 * nobody had paid. They now wait for the cycle's payment, which releases them once.
 */
describe('SubscriptionService — an invoiced cycle is not a settled one (R4-05)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const named = (events: Row[], name: string) => events.filter((event) => event.name === name);

	it('raises the order but holds back the rights of a period nobody has paid for', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION);

		expect(outcome.status).toBe(SubscriptionBillingStatus.INVOICED);
		expect(outcome.message).toMatch(/rights of its period are put in force when its payment is recorded/);
		expect(fixture.orderCalls).toHaveLength(1);
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(0);
		expect(fixture.cycle(APRIL)?.metadata).toMatchObject({ rightsDeferred: true });
	});

	it('does not activate a trial on an unpaid invoice', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })]
		});

		await fixture.service.billCycle(SUBSCRIPTION);

		expect(named(fixture.events, 'subscription.activated')).toHaveLength(0);
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(0);
		expect(fixture.cycle(APRIL)?.metadata).toMatchObject({ rightsDeferred: true, activationDeferred: true });
	});

	it('puts the held-back rights in force when the invoiced cycle is paid, and only once', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })]
		});

		await fixture.service.billCycle(SUBSCRIPTION);

		const cycle = fixture.cycle(APRIL) as Row;
		const paid = await fixture.service.payCycle(cycle.id, { paidAt: new Date('2026-04-03T00:00:00.000Z') });

		expect(paid.status).toBe(SubscriptionBillingStatus.PAID);
		expect(
			fixture.events
				.map((event) => event.name)
				.filter((name) => name === 'subscription.activated' || name === 'subscription.renewed')
		).toEqual(['subscription.activated', 'subscription.renewed']);
		expect(named(fixture.events, 'subscription.renewed')[0].data).toMatchObject({
			subscriptionId: SUBSCRIPTION,
			billingId: cycle.id,
			periodStart: cycle.periodStart,
			periodEnd: cycle.periodEnd
		});
		expect(fixture.cycle(APRIL)?.metadata?.rightsDeferred).toBeUndefined();
		expect(fixture.cycle(APRIL)?.metadata?.rightsReleasedAt).toEqual(expect.any(String));

		// Paying it again is the ledger's no-op, and releases nothing a second time.
		await fixture.service.payCycle(cycle.id);

		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(named(fixture.events, 'subscription.activated')).toHaveLength(1);
	});

	it('releases once when two payments of the invoiced cycle race', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);

		const cycle = fixture.cycle(APRIL) as Row;

		await Promise.all([fixture.service.payCycle(cycle.id), fixture.service.payCycle(cycle.id)]);

		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.cycle(APRIL)?.status).toBe(SubscriptionBillingStatus.PAID);
	});

	it('finishes the release when a payment is retried on a paid cycle whose rights are still held', async () => {
		// The payment was recorded and the release did not get as far as clearing the flags: a retry of the
		// payment finds the cycle paid and must not return before the rights are in force.
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'billing-half-released',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(MARCH),
					periodEnd: new Date(APRIL),
					dueAt: new Date(MARCH),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.PAID,
					paidAt: new Date(APRIL),
					orderId: 'order-0',
					attemptCount: 1,
					metadata: { rightsDeferred: true }
				}
			]
		});

		await fixture.service.payCycle('billing-half-released');

		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(named(fixture.events, 'subscription.renewed')[0].data).toMatchObject({
			billingId: 'billing-half-released',
			periodEnd: new Date(APRIL)
		});
	});

	it('releases no rights when the subscription ended while its invoice was open', async () => {
		// Review note (px-refunds): a late payment of a cancelled, expired or failed subscription's invoice is
		// recorded, and extends nothing for a subscription that is over.
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		Object.assign(fixture.subscription(SUBSCRIPTION) as Row, { status: SubscriptionStatus.CANCELED });

		const paid = await fixture.service.payCycle((fixture.cycle(APRIL) as Row).id);

		expect(paid.status).toBe(SubscriptionBillingStatus.PAID);
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(0);
		expect(fixture.cycle(APRIL)?.metadata).toMatchObject({ rightsWithheldFor: SubscriptionStatus.CANCELED });
		expect(fixture.cycle(APRIL)?.metadata?.rightsDeferred).toBeUndefined();
	});

	it('still renews on the spot a cycle whose order was paid', async () => {
		const fixture = subscriptionFixture({ orders: { paid: true } });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION);

		expect(outcome.status).toBe(SubscriptionBillingStatus.PAID);
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(fixture.cycle(APRIL)?.metadata?.rightsDeferred).toBeUndefined();
	});

	it('releases nothing when a cycle invoiced before this change is paid: its rights were extended then', async () => {
		const fixture = subscriptionFixture({
			billings: [
				{
					id: 'billing-legacy',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(MARCH),
					periodEnd: new Date(APRIL),
					dueAt: new Date(MARCH),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.INVOICED,
					orderId: 'order-0',
					attemptCount: 1,
					metadata: {}
				}
			]
		});

		const paid = await fixture.service.payCycle('billing-legacy');

		expect(paid.status).toBe(SubscriptionBillingStatus.PAID);
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(0);
	});
});

/**
 * Q7-W4: the calendar waits for an invoiced cycle's payment.
 *
 * R4-05 held back the rights of an `INVOICED` cycle, but `recordSuccess` still rolled the calendar: the
 * subscription moved onto the unpaid period, counted it as a billed cycle, and the next pass invoiced the
 * period after it — a customer who never paid kept being invoiced on time, and a plan's cycle ceiling was
 * reached on invoices nobody paid. The calendar now stays on the open invoice (every later pass replays it
 * and raises nothing), and the cycle's payment is what moves it, exactly once.
 */
describe('SubscriptionService — the calendar waits for an invoiced cycle’s payment (Q7-W4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const named = (events: Row[], name: string) => events.filter((event) => event.name === name);

	it('keeps the calendar on an invoice nobody has paid', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		const outcome = await fixture.service.billCycle(SUBSCRIPTION);

		expect(outcome.status).toBe(SubscriptionBillingStatus.INVOICED);
		expect(outcome.message).toMatch(/calendar/);
		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 0,
			currentPeriodStart: MARCH,
			currentPeriodEnd: APRIL,
			nextBillingAt: APRIL
		});
		expect(fixture.cycle(APRIL)?.metadata).toMatchObject({ rightsDeferred: true, calendarDeferred: true });
	});

	it('raises no second order and bills no later period while the invoice is open', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		// Two periods later, the run reaches the subscription again: it is still on the open invoice.
		const later = await fixture.service.billCycle(SUBSCRIPTION, { asOf: monthAfter(monthAfter(APRIL)) });

		expect(later.billingId).toBe((fixture.cycle(APRIL) as Row).id);
		expect(fixture.orderCalls).toHaveLength(1);
		expect(fixture.cycle(monthAfter(APRIL))).toBeUndefined();
		expect(fixture.subscription(SUBSCRIPTION)?.nextBillingAt).toEqual(APRIL);
	});

	it('moves the calendar onto the paid period when the invoice is paid, and the next pass bills the period after it', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		await fixture.service.payCycle((fixture.cycle(APRIL) as Row).id, {
			paidAt: new Date('2026-04-03T00:00:00.000Z')
		});

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1,
			currentPeriodStart: APRIL,
			currentPeriodEnd: monthAfter(APRIL),
			nextBillingAt: monthAfter(APRIL)
		});
		expect(fixture.cycle(APRIL)?.metadata?.calendarDeferred).toBeUndefined();
		expect(named(fixture.events, 'subscription.renewed')[0].data).toMatchObject({
			nextBillingAt: monthAfter(APRIL)
		});

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: monthAfter(APRIL) });

		expect(fixture.orderCalls).toHaveLength(2);
		expect(fixture.cycle(monthAfter(APRIL))).toBeDefined();
	});

	it('converts a trial only when its first invoice is paid', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			subscriptions: [subscriptionRow(SUBSCRIPTION, { status: SubscriptionStatus.PENDING })]
		});

		await fixture.service.billCycle(SUBSCRIPTION);

		expect(fixture.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.PENDING);

		await fixture.service.payCycle((fixture.cycle(APRIL) as Row).id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.ACTIVE,
			billingCycleCount: 1
		});
		expect(named(fixture.events, 'subscription.activated')).toHaveLength(1);
	});

	it('expires the subscription on the payment that reaches the plan’s ceiling, and still renews the paid period', async () => {
		const fixture = subscriptionFixture({
			orders: { paid: false },
			plans: [planRow(PLAN, { maxBillingCycles: 1 }), planRow(BETTER_PLAN)]
		});

		await fixture.service.billCycle(SUBSCRIPTION);

		expect(fixture.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.ACTIVE);

		const cycle = fixture.cycle(APRIL) as Row;

		await fixture.service.payCycle(cycle.id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.EXPIRED,
			billingCycleCount: 1,
			nextBillingAt: null
		});
		// The expiry records the cycle that caused it, in the same write.
		expect(fixture.subscription(SUBSCRIPTION)?.metadata).toMatchObject({ expiredByCycle: cycle.id });
		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(named(fixture.events, 'subscription.expired')).toHaveLength(1);
		// Renewed before expired, the order a cycle paid on the spot writes them in (Greptile): told the other way
		// round, the entitlement package expired the rights and the renewal put them back in force without their keys.
		const names = fixture.events.map((event) => event.name);

		expect(names.indexOf('subscription.renewed')).toBeLessThan(names.indexOf('subscription.expired'));
		expect(fixture.cycle(APRIL)?.metadata?.rightsWithheldFor).toBeUndefined();
	});

	it('tells the expiry of a payment interrupted after the expiry was written, on its retry and once', async () => {
		// Greptile: the expiry was saved before its event was written, and a retry found the subscription expired,
		// moved nothing and told nobody.
		const fixture = subscriptionFixture({
			orders: { paid: false },
			plans: [planRow(PLAN, { maxBillingCycles: 1 }), planRow(BETTER_PLAN)]
		});

		await fixture.service.billCycle(SUBSCRIPTION);

		const cycle = fixture.cycle(APRIL) as Row;

		// The process stops after the payment expired the subscription, before the rights were released.
		jest.spyOn(fixture.service as any, 'releaseHeldRights').mockRejectedValueOnce(new Error('the process stopped'));

		await expect(fixture.service.payCycle(cycle.id)).rejects.toThrow('the process stopped');

		expect(fixture.subscription(SUBSCRIPTION)?.status).toBe(SubscriptionStatus.EXPIRED);
		expect(named(fixture.events, 'subscription.expired')).toHaveLength(0);

		await fixture.service.payCycle(cycle.id);
		await fixture.service.payCycle(cycle.id);

		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(1);
		expect(named(fixture.events, 'subscription.expired')).toHaveLength(1);
	});

	it('withholds the rights of a subscription expired some other way while its opening invoice was open', async () => {
		// Greptile: an opening invoice shares the subscription's period before it is paid, so a matching period does
		// not show that the payment is what expired the subscription.
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		Object.assign(fixture.subscription(SUBSCRIPTION) as Row, {
			status: SubscriptionStatus.EXPIRED,
			currentPeriodStart: new Date(APRIL),
			nextBillingAt: null
		});

		await fixture.service.payCycle((fixture.cycle(APRIL) as Row).id);

		expect(named(fixture.events, 'subscription.renewed')).toHaveLength(0);
		expect(fixture.cycle(APRIL)?.metadata).toMatchObject({ rightsWithheldFor: SubscriptionStatus.EXPIRED });
	});

	it('keeps the period of a paid cycle whose payment stopped before it moved the calendar, across a resume', async () => {
		// Greptile: the resume read only an `INVOICED` cycle as holding the period, so a payment interrupted after the
		// cycle was recorded paid let the resume move past it, and the retry then never counted the paid period.
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		await fixture.service.pause(SUBSCRIPTION);

		const cycle = fixture.cycle(APRIL) as Row;

		// The payment was recorded and the process stopped before the calendar moved.
		await fixture.billingService.markPaid(cycle.id);
		await fixture.service.resume(SUBSCRIPTION, new Date('2026-05-15T00:00:00.000Z'));

		expect(fixture.subscription(SUBSCRIPTION)?.nextBillingAt).toEqual(APRIL);

		await fixture.service.payCycle(cycle.id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			billingCycleCount: 1,
			currentPeriodStart: APRIL,
			nextBillingAt: monthAfter(APRIL)
		});
	});

	it('does not let subscriptions waiting on an open invoice take the slots of one that is due', async () => {
		// CodeRabbit: an open invoice keeps its subscription's billing instant in the past, so an oldest-first scan
		// cut at the pass's limit read only those subscriptions, and one due on time behind them was never billed.
		const openInvoice = (subscriptionId: string): Row => ({
			id: `billing-${subscriptionId}`,
			tenantId: TENANT,
			organizationId: ORG,
			subscriptionId,
			periodStart: new Date(APRIL),
			periodEnd: monthAfter(APRIL),
			dueAt: new Date(APRIL),
			amount: '120.000000',
			currency: 'USD',
			status: SubscriptionBillingStatus.INVOICED,
			orderId: `order-${subscriptionId}`,
			attemptCount: 1,
			metadata: { rightsDeferred: true, calendarDeferred: true }
		});
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow('waiting-1'),
				subscriptionRow('waiting-2'),
				// A cancellation at the end of the period is still the pass's to carry out.
				subscriptionRow('waiting-cancel', { metadata: { cancelAtPeriodEnd: true } }),
				subscriptionRow('due', { nextBillingAt: new Date(APRIL.getTime() + 60 * 60 * 1000) })
			],
			billings: [openInvoice('waiting-1'), openInvoice('waiting-2'), openInvoice('waiting-cancel')]
		});

		const due = await fixture.service.findDue(new Date(APRIL.getTime() + 2 * 60 * 60 * 1000), 2);

		expect(due.map((row) => row.id)).toEqual(['waiting-cancel', 'due']);
	});

	it('moves the calendar once when two payments of the invoice race', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);

		const cycle = fixture.cycle(APRIL) as Row;

		await Promise.all([fixture.service.payCycle(cycle.id), fixture.service.payCycle(cycle.id)]);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			billingCycleCount: 1,
			nextBillingAt: monthAfter(APRIL)
		});
	});

	it('leaves the calendar of a subscription that ended while its invoice was open', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		Object.assign(fixture.subscription(SUBSCRIPTION) as Row, {
			status: SubscriptionStatus.CANCELED,
			nextBillingAt: null
		});

		await fixture.service.payCycle((fixture.cycle(APRIL) as Row).id);

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			status: SubscriptionStatus.CANCELED,
			billingCycleCount: 0,
			currentPeriodStart: MARCH
		});
		expect(fixture.cycle(APRIL)?.metadata?.calendarDeferred).toBeUndefined();
	});

	it('does not move the calendar again for a cycle invoiced before the calendar waited', async () => {
		// Invoiced by a build that rolled the calendar on the invoice: the subscription is already on that period.
		const fixture = subscriptionFixture({
			subscriptions: [
				subscriptionRow(SUBSCRIPTION, {
					currentPeriodStart: new Date(APRIL),
					currentPeriodEnd: monthAfter(APRIL),
					nextBillingAt: monthAfter(APRIL),
					billingCycleCount: 1
				})
			],
			billings: [
				{
					id: 'billing-legacy',
					tenantId: TENANT,
					organizationId: ORG,
					subscriptionId: SUBSCRIPTION,
					periodStart: new Date(APRIL),
					periodEnd: monthAfter(APRIL),
					dueAt: new Date(APRIL),
					amount: '120.000000',
					currency: 'USD',
					status: SubscriptionBillingStatus.INVOICED,
					orderId: 'order-0',
					attemptCount: 1,
					metadata: { rightsDeferred: true }
				}
			]
		});

		await fixture.service.payCycle('billing-legacy');

		expect(fixture.subscription(SUBSCRIPTION)).toMatchObject({
			billingCycleCount: 1,
			nextBillingAt: monthAfter(APRIL)
		});
	});

	it('resumes a paused subscription onto its open invoice rather than past it', async () => {
		const fixture = subscriptionFixture({ orders: { paid: false } });

		await fixture.service.billCycle(SUBSCRIPTION);
		await fixture.service.pause(SUBSCRIPTION);
		await fixture.service.resume(SUBSCRIPTION, new Date('2026-05-15T00:00:00.000Z'));

		// Resuming on the 15th of May must not start a period there: April is invoiced and waits for its payment.
		expect(fixture.subscription(SUBSCRIPTION)?.nextBillingAt).toEqual(APRIL);

		await fixture.service.billCycle(SUBSCRIPTION, { asOf: new Date('2026-05-16T00:00:00.000Z') });

		expect(fixture.orderCalls).toHaveLength(1);
	});
});

describe('SubscriptionService — the ids a subscription names (subscription.references.ts)', () => {
	const refuse = async () => {
		throw new Error('A related record belongs to another tenant');
	};

	beforeEach(() => {
		mockAssertReferences.mockClear();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('checks a new subscription’s customer, order and payer, and writes nothing when one is refused', async () => {
		const fixture = subscriptionFixture({ subscriptions: [], items: [], billings: [] });
		const input = {
			planId: PLAN,
			customerId: CUSTOMER,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: TOKEN,
			items: [{ variantId: VARIANT, quantity: '1', unitPrice: '120' }]
		};
		mockAssertReferences.mockImplementationOnce(refuse);

		await expect(fixture.service.createSubscription(input)).rejects.toThrow('another tenant');

		expect(mockAssertReferences.mock.calls[0].slice(1)).toEqual([input, SUBSCRIPTION_REFERENCES, TENANT]);
		expect(fixture.tables.subscription).toHaveLength(0);
	});

	it('checks a payer an edit moves before writing it', async () => {
		const fixture = subscriptionFixture();
		const before = { ...fixture.subscription(SUBSCRIPTION) };
		mockAssertReferences.mockImplementationOnce(refuse);

		await expect(
			fixture.service.applyChanges(SUBSCRIPTION, { paymentMethodTokenId: 'token-of-tenant-b' } as never)
		).rejects.toThrow('another tenant');

		expect(mockAssertReferences.mock.calls[0].slice(1, 3)).toEqual([
			{ paymentMethodTokenId: 'token-of-tenant-b' },
			SUBSCRIPTION_REFERENCES
		]);
		expect(fixture.subscription(SUBSCRIPTION)).toEqual(before);
	});

	it('states the customer, the order and the payer', () => {
		expect(SUBSCRIPTION_REFERENCES).toEqual({
			customerId: 'organization_contact',
			originOrderId: 'order',
			paymentAccountHolderId: 'payment_account_holder',
			paymentMethodTokenId: 'payment_method_token'
		});
	});
});
