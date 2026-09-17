/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a plan service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**:
 * only the base CRUD class, the request context, the entity base classes and the platform's money
 * layer are involved, and `isUniqueViolation` is the platform's own — the whole point of the race case
 * below is which errors it recognises.
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

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { SubscriptionBillingPeriod, SubscriptionStatus } from '../subscription.types';
import { SubscriptionPlanService } from './subscription-plan.service';

/**
 * Plans: what can be subscribed to, and on what terms.
 *
 * Doc 11 §10.3 fixes the configuration, and the service owns three rules the table alone cannot state
 * (its own summary, and doc 05 §15.1's invariants):
 *
 * - **a code is a promise.** `code` is unique per organization and "immutable after first
 *   subscription", because "a customer, an invoice and an import all quote the code" — and the same
 *   code claimed twice is a `409 SUBSCRIPTION_PLAN_CODE_TAKEN`, whether the loser of the race is
 *   refused by the service or by the database's own unique index;
 * - **a plan that is in use is not deactivated silently.** `isActive = false` with live subscriptions
 *   still billing is refused with `409 SUBSCRIPTION_PLAN_HAS_SUBSCRIBERS` "rather than being
 *   deactivated silently" (doc 11 §10.3, verbatim);
 * - **a plan's target must be sellable on a recurring basis**, and the catalogue — not this table —
 *   answers that question: "a subscription is sellable only when its plan is `isActive = true` and the
 *   underlying variant has `product_variant_setting.isSubscription = true`" (doc 05 §15.1).
 *
 * The suite also pins the value ranges §10.3 states (`billingInterval >= 1`, `maxBillingCycles` a
 * whole number of cycles, `trialDays` a whole number of days, `setupFee >= 0`, `discountPercentage`
 * a fraction in `[0, 1]`), the cadence refusal that keeps `ONE_TIME` out of a recurring contract, and
 * the field selection an update writes.
 *
 * The service is constructed directly over in-memory tables. The doubles state the `where` and the
 * operators the service states — equality and `In` — because a double that returned every row
 * regardless would make the uniqueness, live-subscriber and organization-scope cases vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000020';

type Row = Record<string, any>;

interface ITables {
	subscription_plan: Row[];
	subscription: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param options.onSave What the write does instead of succeeding, when a case is about a race.
 */
function repository(tables: ITables, tableName: keyof ITables, options: { onSave?: (entity: Row) => void } = {}) {
	let sequence = 0;
	const live = () => tables[tableName].filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matchesValue = (value: unknown, expected: unknown): boolean => {
		if (expected instanceof FindOperator) {
			if (expected.type === 'in') {
				return (expected.value ?? []).some((candidate: unknown) => same(value, candidate));
			}

			throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
		}

		// TypeORM drops an `undefined` member from the condition rather than matching nothing.
		if (expected === undefined) {
			return true;
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
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows: live,
		find: async (options: any = {}) => sorted(live().filter((row) => matches(row, options.where)), options.order),
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
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[tableName].findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(tables[tableName][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			const matching = tables[tableName].filter((row) => matches(row, criteria));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One `subscription_plan` row, as the service reads it. */
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
	...overrides
});

/** One `subscription` row, as the liveness count reads it. */
const subscriptionRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	planId: 'plan-1',
	status: SubscriptionStatus.ACTIVE,
	...overrides
});

/**
 * Builds the plan service over in-memory tables and one catalogue.
 *
 * @param options.plans The plans the fixture starts with.
 * @param options.subscriptions The subscriptions the fixture starts with.
 * @param options.catalog The catalogue, or `false` for a tenant that has none.
 * @param options.uniqueViolationOnSave Whether the write loses a race against another writer's insert.
 */
function planFixture(
	options: {
		plans?: Row[];
		subscriptions?: Row[];
		catalog?: { subscribable?: Record<string, boolean>; defaultVariant?: Record<string, string | null> } | false;
		uniqueViolationOnSave?: boolean;
	} = {}
) {
	const tables: ITables = {
		subscription_plan: [...(options.plans ?? [planRow('plan-1')])],
		subscription: [...(options.subscriptions ?? [])]
	};
	const patches: Row[] = [];
	const planRepository = repository(tables, 'subscription_plan', {
		onSave: () => {
			if (options.uniqueViolationOnSave) {
				const error = new Error('duplicate key value violates unique constraint "UQ_subscription_plan_org_code"');

				(error as Row).code = '23505';

				throw error;
			}
		}
	});
	const patchRecorder = {
		...planRepository,
		update: async (criteria: any, partial: any) => {
			patches.push(partial);

			return planRepository.update(criteria, partial);
		}
	};
	const configured = options.catalog === false ? undefined : options.catalog;
	const catalog =
		options.catalog === false
			? undefined
			: {
					isVariantSubscribable: async (variantId: string) => configured?.subscribable?.[variantId] ?? true,
					defaultVariantOf: async (productId: string) => {
						// A product the fixture states nothing about has a default variant; a product it states
						// `null` for is one the catalogue answers with nothing, which is the refusal case.
						const stated = configured?.defaultVariant;

						return stated && productId in stated ? stated[productId] : VARIANT;
					}
			  };
	const service = new SubscriptionPlanService(
		patchRecorder as never,
		{} as never,
		repository(tables, 'subscription') as never,
		catalog as never
	);

	return {
		service,
		tables,
		patches,
		plan: (id: string) => tables.subscription_plan.find((row) => row.id === id)
	};
}

describe('SubscriptionPlanService — writing a plan (doc 11 §10.3, doc 05 §15.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a plan with its cadence, its amounts and its scope normalised', async () => {
		const fixture = planFixture({ plans: [] });

		const created = await fixture.service.create({
			name: 'Pro',
			code: 'PRO',
			currency: 'USD',
			billingPeriod: SubscriptionBillingPeriod.MONTHLY,
			billingInterval: 3,
			maxBillingCycles: 12,
			trialDays: 14,
			setupFee: '49.5',
			discountPercentage: '0.1'
		});

		expect(created).toMatchObject({
			name: 'Pro',
			code: 'PRO',
			billingInterval: 3,
			maxBillingCycles: 12,
			trialDays: 14,
			// A money column is written at the storage scale; a discount is a fraction, not a percentage.
			setupFee: '49.500000',
			discountPercentage: '0.1',
			tenantId: TENANT,
			organizationId: ORG
		});
	});

	it('refuses a plan with no name, no code or no currency', async () => {
		const fixture = planFixture({ plans: [] });

		await expect(fixture.service.create({ code: 'X', currency: 'USD' } as never)).rejects.toThrow(
			/must have a name/
		);
		await expect(fixture.service.create({ name: 'X', currency: 'USD' } as never)).rejects.toThrow(
			/must have a code/
		);
		await expect(fixture.service.create({ name: 'X', code: 'X' } as never)).rejects.toThrow(
			/must state the currency/
		);
		expect(fixture.tables.subscription_plan).toEqual([]);
	});

	it('refuses a code the organization already holds', async () => {
		// Doc 11 §10.3: "`code` unique per organization; immutable after first subscription". The check is
		// made before the write so the caller is told which promise it broke.
		const fixture = planFixture({ plans: [planRow('pro', { code: 'PRO' })] });

		await expect(
			fixture.service.create({ name: 'Other', code: 'PRO', currency: 'USD' } as never)
		).rejects.toBeInstanceOf(ConflictException);
		expect(fixture.tables.subscription_plan).toHaveLength(1);
	});

	it('answers the same conflict when the database is the one that refuses the duplicate', async () => {
		// Two writers can pass the service's own check at the same instant; the unique index is what
		// actually decides, and the loser has to be told the same thing rather than handed a driver error.
		const fixture = planFixture({ plans: [], uniqueViolationOnSave: true });

		await expect(
			fixture.service.create({ name: 'Pro', code: 'PRO', currency: 'USD' } as never)
		).rejects.toBeInstanceOf(ConflictException);
		await expect(
			fixture.service.create({ name: 'Pro', code: 'PRO', currency: 'USD' } as never)
		).rejects.toThrow(/SUBSCRIPTION_PLAN_CODE_TAKEN/);
	});

	it('accepts the same code in another organization', async () => {
		// Control: the promise is scoped to the organization, so a second tenant's catalogue is its own.
		const fixture = planFixture({ plans: [planRow('pro', { code: 'PRO' })] });

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		const created = await fixture.service.create({ name: 'Pro', code: 'PRO', currency: 'USD' } as never);

		expect(created.organizationId).toBe(OTHER_ORG);
		expect(fixture.tables.subscription_plan).toHaveLength(2);
	});

	it('refuses a plan attached to both a product and a variant', async () => {
		// Doc 05 §15.1 states the invariant as a check constraint: "exactly one of `productId` /
		// `variantId` is set". The third shape — neither — is the pure service entitlement of §10.3.
		const fixture = planFixture({ plans: [] });

		await expect(
			fixture.service.create({ name: 'Both', code: 'BOTH', currency: 'USD', productId: PRODUCT, variantId: VARIANT } as never)
		).rejects.toThrow(/SUBSCRIPTION_PLAN_TARGET_AMBIGUOUS/);
		expect(fixture.tables.subscription_plan).toEqual([]);
	});

	it('accepts a plan attached to neither, which is a pure service entitlement', async () => {
		const fixture = planFixture({ plans: [] });

		const created = await fixture.service.create({ name: 'Support', code: 'SUPPORT', currency: 'USD' });

		expect(created.productId).toBeUndefined();
		expect(created.variantId).toBeUndefined();
	});

	it('refuses a cadence that cannot be billed: an interval below one, or a fraction of a period', async () => {
		const fixture = planFixture({ plans: [] });

		for (const billingInterval of [0, -1, 1.5]) {
			await expect(
				fixture.service.create({ name: 'X', code: `X${billingInterval}`, currency: 'USD', billingInterval } as never)
			).rejects.toThrow(/SUBSCRIPTION_INTERVAL_INVALID/);
		}
		expect(fixture.tables.subscription_plan).toEqual([]);
	});

	it('refuses a cycle ceiling or a trial that is not a whole number of units', async () => {
		const fixture = planFixture({ plans: [] });

		await expect(
			fixture.service.create({ name: 'X', code: 'X', currency: 'USD', maxBillingCycles: 0 } as never)
		).rejects.toThrow(/SUBSCRIPTION_MAX_CYCLES_INVALID/);
		await expect(
			fixture.service.create({ name: 'X', code: 'X', currency: 'USD', trialDays: -1 } as never)
		).rejects.toThrow(/SUBSCRIPTION_TRIAL_INVALID/);
		expect(fixture.tables.subscription_plan).toEqual([]);
	});

	it('refuses a negative setup fee, at the currency’s scale', async () => {
		// Doc 11 §10.3 states `setupFee >= 0`; the check is made on the amount as the currency will store
		// it, so a fee of minus half a cent in a currency with no minor unit is a fee of zero.
		const fixture = planFixture({ plans: [] });

		await expect(
			fixture.service.create({ name: 'X', code: 'X', currency: 'USD', setupFee: '-1' } as never)
		).rejects.toThrow(/SUBSCRIPTION_AMOUNT_INVALID/);
		await expect(
			fixture.service.create({ name: 'X', code: 'X', currency: 'JPY', setupFee: '-0.4' } as never)
		).resolves.toMatchObject({ setupFee: '0.000000' });
	});

	it('rounds a setup fee onto the currency’s scale, half-up', async () => {
		const fixture = planFixture({ plans: [] });

		const up = await fixture.service.create({ name: 'Yen', code: 'YEN', currency: 'JPY', setupFee: '100.5' });
		const down = await fixture.service.create({ name: 'Dinar', code: 'DINAR', currency: 'KWD', setupFee: '1.2345' });

		expect(up.setupFee).toBe('101.000000');
		expect(down.setupFee).toBe('1.235000');
	});

	it('refuses a discount that is not a fraction between zero and one', async () => {
		// Doc 11 §10.3 states `discountPercentage` "validated to `[0, 100)`" and doc 05 §15.1 states the
		// column's own rule: "`discountPercentage` in `[0,1]` when set". Ten per cent is `0.1`; a caller
		// that sends `10` is sent back with the difference named.
		const fixture = planFixture({ plans: [] });

		await expect(
			fixture.service.create({ name: 'X', code: 'X', currency: 'USD', discountPercentage: '1.5' } as never)
		).rejects.toThrow(/not a fraction between 0 and 1/);

		const boundary = await fixture.service.create({
			name: 'Boundary',
			code: 'BOUNDARY',
			currency: 'USD',
			discountPercentage: '1'
		});

		// The two edges of the range are inside it: a free plan and a full-price plan are both expressible.
		expect(boundary.discountPercentage).toBe('1');
		await expect(
			fixture.service.create({ name: 'Free', code: 'FREE', currency: 'USD', discountPercentage: '0' })
		).resolves.toMatchObject({ discountPercentage: '0' });
	});
});

describe('SubscriptionPlanService — amending a plan that is already in use (doc 11 §10.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('amends the terms of a plan nobody is subscribed to', async () => {
		const fixture = planFixture({ plans: [planRow('plan-1')] });

		const updated = await fixture.service.updatePlan('plan-1', { setupFee: '9.99', trialDays: 7 });

		expect(updated).toMatchObject({ setupFee: '9.990000', trialDays: 7 });
	});

	it('refuses to recode a plan that has live subscriptions', async () => {
		// "The code is what a customer and an invoice quote": renaming it under a running agreement would
		// make every document that quotes it wrong at once.
		const fixture = planFixture({
			plans: [planRow('plan-1', { code: 'PRO' })],
			subscriptions: [subscriptionRow('sub-1', { status: SubscriptionStatus.ACTIVE })]
		});

		await expect(fixture.service.updatePlan('plan-1', { code: 'PROFESSIONAL' })).rejects.toThrow(
			/SUBSCRIPTION_PLAN_CODE_IMMUTABLE/
		);
		expect(fixture.plan('plan-1')).toMatchObject({ code: 'PRO' });
	});

	it('recodes a plan whose subscriptions have all ended, and refuses a code another plan holds', async () => {
		// Control for the refusal above: only a *live* subscriber freezes the code.
		const fixture = planFixture({
			plans: [planRow('plan-1', { code: 'PRO' }), planRow('plan-2', { code: 'TEAM' })],
			subscriptions: [
				subscriptionRow('sub-1', { planId: 'plan-1', status: SubscriptionStatus.CANCELED }),
				subscriptionRow('sub-2', { planId: 'plan-1', status: SubscriptionStatus.EXPIRED })
			]
		});

		await expect(fixture.service.updatePlan('plan-1', { code: 'PROFESSIONAL' })).resolves.toMatchObject({
			code: 'PROFESSIONAL'
		});
		await expect(fixture.service.updatePlan('plan-1', { code: 'TEAM' })).rejects.toBeInstanceOf(ConflictException);
		expect(fixture.plan('plan-1')).toMatchObject({ code: 'PROFESSIONAL' });
	});

	it('refuses to deactivate a plan that still has live subscriptions', async () => {
		// Doc 11 §10.3, verbatim: "A plan with `isActive = false` that has active subscriptions returns
		// `409 SUBSCRIPTION_PLAN_HAS_SUBSCRIBERS` rather than being deactivated silently."
		const fixture = planFixture({
			plans: [planRow('plan-1')],
			subscriptions: [subscriptionRow('sub-1', { status: SubscriptionStatus.PAUSED })]
		});

		await expect(fixture.service.updatePlan('plan-1', { isActive: false })).rejects.toThrow(
			/SUBSCRIPTION_PLAN_HAS_SUBSCRIBERS/
		);
		expect(fixture.plan('plan-1')?.isActive).toBe(true);
	});

	it('deactivates a plan once nothing live depends on it, and refuses an unknown or foreign plan', async () => {
		const fixture = planFixture({
			plans: [planRow('plan-1'), planRow('theirs', { organizationId: OTHER_ORG })],
			subscriptions: [subscriptionRow('sub-1', { status: SubscriptionStatus.CANCELED })]
		});

		await expect(fixture.service.updatePlan('plan-1', { isActive: false })).resolves.toMatchObject({
			isActive: false
		});
		await expect(fixture.service.updatePlan('theirs', { isActive: false })).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.updatePlan('no-such-plan', { isActive: false })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('writes only the fields a plan may change, never its identity or its lifecycle columns', async () => {
		// A spread of the loaded entity would write `deletedAt: null` back over a soft-deleted plan and
		// un-delete it as a side effect of editing a price; the selection is what prevents that.
		const fixture = planFixture({
			plans: [{ ...planRow('plan-1'), deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z' }]
		});

		await fixture.service.updatePlan('plan-1', { setupFee: '5' });

		const written = fixture.patches[0];

		expect(written).toMatchObject({ setupFee: '5.000000' });
		// The plan's own terms travel with the write, and nothing that belongs to the row's identity or its
		// lifecycle does.
		expect(Object.keys(written)).toEqual(
			expect.arrayContaining(['name', 'code', 'billingPeriod', 'billingInterval', 'currency', 'isActive'])
		);
		for (const column of ['id', 'tenantId', 'organizationId', 'deletedAt', 'createdAt', 'updatedAt']) {
			expect(written).not.toHaveProperty(column);
		}
	});
});

describe('SubscriptionPlanService — the cadence and the sellability the catalogue decides', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads the cadence a cycle is computed from', () => {
		const fixture = planFixture();

		expect(
			fixture.service.cadenceOf({
				billingPeriod: SubscriptionBillingPeriod.QUARTERLY,
				billingInterval: 2
			} as never)
		).toEqual({ period: SubscriptionBillingPeriod.QUARTERLY, interval: 2 });
		// An unstated interval is one period, which is what the column's default says.
		expect(
			fixture.service.cadenceOf({ billingPeriod: SubscriptionBillingPeriod.MONTHLY } as never)
		).toEqual({ period: SubscriptionBillingPeriod.MONTHLY, interval: 1 });
	});

	it('refuses a period that is not a recurring one', async () => {
		// Doc 11 §10.3: "`ONE_TIME` is not a subscription period and is rejected here" — a one-off sale
		// written as a subscription would bill the customer again at the end of the period.
		const fixture = planFixture();

		expect(() => fixture.service.cadenceOf({ billingPeriod: 'ONE_TIME' } as never)).toThrow(
			/SUBSCRIPTION_PERIOD_UNSUPPORTED/
		);
		expect(() => fixture.service.cadenceOf({} as never)).toThrow(/SUBSCRIPTION_PERIOD_UNSUPPORTED/);
		expect(() =>
			fixture.service.cadenceOf({ billingPeriod: SubscriptionBillingPeriod.MONTHLY, billingInterval: 0 } as never)
		).toThrow(/SUBSCRIPTION_INTERVAL_INVALID/);
	});

	it('reads a plan a subscription may be created from, once the catalogue agrees', async () => {
		const fixture = planFixture({ plans: [planRow('plan-1', { variantId: VARIANT })] });

		await expect(fixture.service.assertSubscribeable('plan-1')).resolves.toMatchObject({ id: 'plan-1' });
	});

	it('refuses an inactive plan, which no new subscription may be created from', async () => {
		const fixture = planFixture({ plans: [planRow('plan-1', { isActive: false })] });

		await expect(fixture.service.assertSubscribeable('plan-1')).rejects.toThrow(/SUBSCRIPTION_PLAN_INACTIVE/);
	});

	it('refuses a plan whose variant the catalogue does not mark as sellable on a recurring basis', async () => {
		// Doc 05 §15.1: a subscription is sellable only when the variant has
		// `product_variant_setting.isSubscription = true`, and the catalogue — not this table — answers it.
		const fixture = planFixture({
			plans: [planRow('plan-1', { variantId: VARIANT })],
			catalog: { subscribable: { [VARIANT]: false } }
		});

		await expect(fixture.service.assertSubscribeable('plan-1')).rejects.toThrow(
			/SUBSCRIPTION_VARIANT_NOT_SELLABLE/
		);
	});

	it('refuses a product-level plan whose default variant the catalogue does not return', async () => {
		const fixture = planFixture({
			plans: [planRow('plan-1', { productId: PRODUCT })],
			catalog: { defaultVariant: { [PRODUCT]: null } }
		});

		await expect(fixture.service.assertSubscribeable('plan-1')).rejects.toThrow(
			/SUBSCRIPTION_PLAN_TARGET_UNRESOLVED/
		);
	});

	it('asserts nothing when no catalogue is registered, and nothing for a plan attached to nothing', async () => {
		// Control: "a tenant that sells plans attached to nothing runs the lifecycle on its items alone",
		// so neither the entitlement case nor the catalogue-less tenant has anything to refuse.
		const withoutCatalog = planFixture({ plans: [planRow('plan-1', { variantId: VARIANT })], catalog: false });
		const entitlement = planFixture({ plans: [planRow('plan-1')] });

		await expect(withoutCatalog.service.assertSubscribeable('plan-1')).resolves.toMatchObject({ id: 'plan-1' });
		await expect(entitlement.service.assertSubscribeable('plan-1')).resolves.toMatchObject({ id: 'plan-1' });
	});

	it('resolves the variant a plan delivers, and answers nothing for an entitlement', async () => {
		const fixture = planFixture({
			plans: [
				planRow('named', { variantId: VARIANT }),
				planRow('product', { productId: PRODUCT }),
				planRow('entitlement')
			],
			catalog: { defaultVariant: { [PRODUCT]: 'product-default' } }
		});

		expect(await fixture.service.resolveVariantId(fixture.plan('named') as never)).toBe(VARIANT);
		expect(await fixture.service.resolveVariantId(fixture.plan('product') as never)).toBe('product-default');
		expect(await fixture.service.resolveVariantId(fixture.plan('entitlement') as never)).toBeUndefined();
	});
});

describe('SubscriptionPlanService — the reads a listing and a guard are built from', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('counts only the subscribers that would keep billing', async () => {
		// The four live statuses are the ones that would keep billing if the plan were left alone, which is
		// what makes the count the right answer to "may this plan be deactivated".
		const fixture = planFixture({
			subscriptions: [
				subscriptionRow('pending', { status: SubscriptionStatus.PENDING }),
				subscriptionRow('active', { status: SubscriptionStatus.ACTIVE }),
				subscriptionRow('paused', { status: SubscriptionStatus.PAUSED }),
				subscriptionRow('failed', { status: SubscriptionStatus.FAILED }),
				subscriptionRow('canceled', { status: SubscriptionStatus.CANCELED }),
				subscriptionRow('expired', { status: SubscriptionStatus.EXPIRED })
			]
		});

		expect(await fixture.service.countLiveSubscriptions('plan-1')).toBe(4);
		expect(await fixture.service.hasLiveSubscriptions('plan-1')).toBe(true);
	});

	it('counts only the caller’s own subscriptions on the plan', async () => {
		const fixture = planFixture({
			subscriptions: [
				subscriptionRow('mine', { status: SubscriptionStatus.ACTIVE }),
				subscriptionRow('theirs', { status: SubscriptionStatus.ACTIVE, organizationId: OTHER_ORG }),
				subscriptionRow('other-plan', { status: SubscriptionStatus.ACTIVE, planId: 'plan-2' })
			]
		});

		expect(await fixture.service.countLiveSubscriptions('plan-1')).toBe(1);
		expect(await fixture.service.countLiveSubscriptions('plan-3')).toBe(0);
		expect(await fixture.service.hasLiveSubscriptions('plan-3')).toBe(false);
	});

	it('lists the sellable plans of the organization, by name', async () => {
		const fixture = planFixture({
			plans: [
				planRow('b', { name: 'Beta' }),
				planRow('a', { name: 'Alpha' }),
				planRow('off', { name: 'Zeta', isActive: false }),
				planRow('theirs', { name: 'Theirs', organizationId: OTHER_ORG })
			]
		});

		expect((await fixture.service.listSellable()).map((plan) => plan.name)).toEqual(['Alpha', 'Beta']);
	});

	it('reads a plan by the code the organization knows it by, and refuses a foreign one by id', async () => {
		const fixture = planFixture({ plans: [planRow('plan-1', { code: 'PRO' }), planRow('theirs', { organizationId: OTHER_ORG })] });

		expect(await fixture.service.findByCode('PRO')).toMatchObject({ id: 'plan-1' });
		expect(await fixture.service.findByCode('NOPE')).toBeNull();
		await expect(fixture.service.findOneScoped('plan-1')).resolves.toMatchObject({ id: 'plan-1' });
		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});
