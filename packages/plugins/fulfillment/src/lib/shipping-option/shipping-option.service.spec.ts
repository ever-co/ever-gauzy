/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a delivery choice needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * sibling packages' service specs do, and **the service under test is the real one**: only the CRUD
 * base class, the request context and the entity base classes are substituted.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller, and one of those places is the subject of two cases below: a lookup that
 * matches nothing **raises `NotFoundException`** rather than answering `null`
 * (`packages/core/src/lib/core/crud/crud.service.ts`, the `if (!record)` branch of
 * `findOneByWhereOptions` and of `findOneByIdString` — both reached through
 * `TenantAwareCrudService`). That is the contract for reading a resource by id. The read a caller
 * uses when absence is an ordinary answer is the `findOneOrFailBy*` pair, whose `ITryRequest` reports
 * `success: false` instead of raising, and the double states that pair too because the code guard
 * below is built from it.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	// The kernel's conditional write is pulled through the seam rather than re-implemented: the edit
	// cases below are about what the platform's `UPDATE … WHERE id = :id AND version = :expected` does
	// with a version that moved on, and a stand-in here would assert this suite's own idea of a lock.
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

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

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
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

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		/**
		 * The platform's absence-is-an-answer read: a miss is reported as `success: false` instead of
		 * being raised, which is what `CrudService.findOneOrFailByWhereOptions` does with TypeORM's
		 * `findOneByOrFail` (`packages/core/src/lib/core/crud/crud.service.ts`).
		 */
		async findOneOrFailByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			return record ? { success: true, record } : { success: false };
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		TenantAwareCrudService,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		VERSION_EXPECTATION_PROPERTY: 'versionExpectation',
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShippingPriceType } from '@gauzy/contracts';
import { ShippingOptionService } from './shipping-option.service';

/**
 * The configured, sellable delivery choices.
 *
 * Three price shapes are expressible and each is held to its own rule, because an option that states
 * no amount, states no currency or names no strategy is not a configuration with a defect — it is an
 * option that would silently charge zero or fail at checkout (doc 09 §12.2). The properties this suite
 * pins are:
 *
 * - a **flat** option carries an amount and a currency, a **calculated** option names the registered
 *   strategy that prices it, and a **free** option carries neither (doc 09 §12.2, §12.3);
 * - an option states a price type this platform prices: the guard reads the value as text precisely
 *   because "no price type" and "a price type nobody prices" are not expressible in the entity's own
 *   enumerated type, and both reach the service at runtime;
 * - a delivery estimate never ends before it starts, which is the constraint the table itself carries
 *   (`CHK_shipping_option_days`, the migration of this package), and equal bounds are legal;
 * - a code is unique inside the organization (`UQ_shipping_option_org_code`);
 * - eligibility is decided by the option's own physical limits and its channel, region and profile
 *   scope (doc 09 §12.4) — and an ineligible option is answered *with its reason* rather than dropped,
 *   because "why is there no express delivery to my address?" is a question whose answer is the reason;
 * - a free option costs zero, a flat option costs what it states, and a calculated option's price is
 *   named as the strategy's job rather than invented here (doc 09 §12.3).
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states — including the code lookup the uniqueness guard is built from —
 * because a double that matched every row regardless would make the refusals below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL_WEB = '00000000-0000-4000-8000-0000000000c1';
const CHANNEL_STORE = '00000000-0000-4000-8000-0000000000c2';
const REGION_EU = '00000000-0000-4000-8000-0000000000d1';
const REGION_US = '00000000-0000-4000-8000-0000000000d2';
const PROFILE_COLD = '00000000-0000-4000-8000-0000000000e1';
const PROFILE_BULK = '00000000-0000-4000-8000-0000000000e2';
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	shipping_option: Row[];
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
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});
	const ordered = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
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

				return (Number(left[column]) > Number(right[column]) ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: Row = {}) =>
			ordered(
				rows().filter((row) => matches(row, options.where)),
				options.order
			),
		findOne: async (options: Row = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// The table's own defaults, as the migration declares them.
			const created = {
				id: `${String(tableName)}-new-${++sequence}`,
				isActive: true,
				isTaxInclusive: false,
				priority: 0,
				requiresShippingAddress: true,
				allowPickup: false,
				version: 1,
				priceType: ShippingPriceType.FLAT,
				...entity
			};

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row —
		// and which applies the WHOLE criteria it was handed rather than the id alone. The version the
		// conditional write predicates its statement on is part of that criteria, so a double that matched
		// on the id only would report a stale write as a successful one and make the concurrency case
		// below vacuous.
		update: async (criteria: any, partial: Row) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const index = rows().findIndex((row) =>
				Object.entries(where).every(([field, expected]) => expected === undefined || same(row[field], expected))
			);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `shipping_option` row. */
const option = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Option ${id}`,
	code: id.toUpperCase(),
	priceType: ShippingPriceType.FLAT,
	amount: 4.99,
	currency: 'EUR',
	isActive: true,
	isTaxInclusive: false,
	priority: 0,
	requiresShippingAddress: true,
	allowPickup: false,
	version: 1,
	...overrides
});

/**
 * Builds the option service over one in-memory `shipping_option` table.
 *
 * @param rows The options the fixture starts with.
 */
function optionFixture(rows: Row[] = []) {
	const tables: ITables = { shipping_option: [...rows] };
	const service = new ShippingOptionService(
		repository(tables, 'shipping_option') as never,
		{} as never
	);

	return {
		service,
		tables,
		row: (id: string) => tables.shipping_option.find((row) => row.id === id),
		byCode: (code: string) => tables.shipping_option.find((row) => row.code === code)
	};
}

/** A flat option, as a caller states it. */
const flatOption = (overrides: Row = {}) => ({
	name: 'Standard delivery',
	code: 'STANDARD',
	priceType: ShippingPriceType.FLAT,
	amount: 4.99,
	currency: 'EUR',
	...overrides
});

describe('ShippingOptionService — the shape a price type allows (doc 09 §12.2, §12.3)', () => {
	it('refuses a flat option that states no amount', async () => {
		const fixture = optionFixture();

		await expect(fixture.service.create(flatOption({ amount: null }) as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID', details: { priceType: ShippingPriceType.FLAT } }
		});
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('refuses a flat option that states no currency, and one that states neither', async () => {
		const fixture = optionFixture();

		await expect(fixture.service.create(flatOption({ currency: undefined }) as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID' }
		});
		await expect(
			fixture.service.create(flatOption({ amount: undefined, currency: undefined }) as never)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_INVALID' } });
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('accepts the shapes its price types allow, up to the code guard that then refuses them', async () => {
		// Control for the three refusals above, and the technique the control cases in this file share:
		// the fixture already holds the code, so the refusal that comes back is the *code* guard — which
		// proves the shape guard let the payload through. It reads the same before and after the defect
		// recorded at the bottom of this block, which is why the shapes are pinned this way.
		const fixture = optionFixture([
			option('taken-flat', { code: 'ZERO-FLAT' }),
			option('taken-free', { code: 'FREE-OVER' }),
			option('taken-rated', { code: 'RATED' })
		]);

		await expect(
			fixture.service.create(flatOption({ code: 'ZERO-FLAT', amount: 0 }) as never)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_CODE_TAKEN' } });
		await expect(
			fixture.service.create({ name: 'Free over 50', code: 'FREE-OVER', priceType: ShippingPriceType.FREE } as never)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_CODE_TAKEN' } });
		await expect(
			fixture.service.create({
				name: 'Rated',
				code: 'RATED',
				priceType: ShippingPriceType.CALCULATED,
				providerKey: 'registered-rate-strategy'
			} as never)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_CODE_TAKEN' } });
	});

	it('refuses a calculated option that names no strategy to price it', async () => {
		const fixture = optionFixture();

		await expect(
			fixture.service.create({
				name: 'Rated delivery',
				code: 'RATED',
				priceType: ShippingPriceType.CALCULATED
			} as never)
		).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID', details: { priceType: ShippingPriceType.CALCULATED } }
		});
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('refuses an option that states no price type at all', async () => {
		// Not expressible in the entity's own type, and reachable at runtime: the GraphQL mutation asserts
		// the input's type instead of checking it, and a service call need not come through the REST DTO.
		const fixture = optionFixture();

		await expect(
			fixture.service.create({ name: 'Mystery', code: 'MYSTERY', amount: 1, currency: 'EUR' } as never)
		).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID', details: { priceType: undefined } }
		});
	});

	it('refuses a price type this platform does not price', async () => {
		const fixture = optionFixture();

		await expect(
			fixture.service.create({ name: 'By weight', code: 'BY-WEIGHT', priceType: 'BY_WEIGHT' } as never)
		).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID', details: { priceType: 'BY_WEIGHT' } }
		});
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('refuses a delivery estimate that ends before it starts', async () => {
		const fixture = optionFixture();

		await expect(
			fixture.service.create(flatOption({ estimatedMinDays: 5, estimatedMaxDays: 3 }) as never)
		).rejects.toMatchObject({
			response: {
				code: 'SHIPPING_OPTION_INVALID',
				details: { estimatedMinDays: 5, estimatedMaxDays: 3 }
			}
		});
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('accepts an estimate whose bounds are equal or half-stated, up to the code guard that refuses them', async () => {
		// Control for the refusal above, read the same way as the price-shape control: both of these are
		// what the table's own constraint allows — `min <= max`, with either side absent — so the code
		// guard is what answers.
		const fixture = optionFixture([
			option('taken-same-day', { code: 'SAME-DAY' }),
			option('taken-from', { code: 'FROM-THREE' })
		]);

		await expect(
			fixture.service.create(
				flatOption({ code: 'SAME-DAY', estimatedMinDays: 2, estimatedMaxDays: 2 }) as never
			)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_CODE_TAKEN' } });
		await expect(
			fixture.service.create(flatOption({ code: 'FROM-THREE', estimatedMinDays: 3 }) as never)
		).rejects.toMatchObject({ response: { code: 'SHIPPING_OPTION_CODE_TAKEN' } });
	});

	it('refuses an option that states no code', async () => {
		const fixture = optionFixture();

		await expect(fixture.service.create(flatOption({ code: undefined }) as never)).rejects.toThrow(
			/SHIPPING_OPTION_CODE_REQUIRED/
		);
		expect(fixture.tables.shipping_option).toEqual([]);
	});

	it('refuses a code another option of the organization already holds', async () => {
		const fixture = optionFixture([option('standard', { code: 'STANDARD' })]);

		await expect(fixture.service.create(flatOption() as never)).rejects.toMatchObject({
			response: {
				code: 'SHIPPING_OPTION_CODE_TAKEN',
				details: { code: 'STANDARD', optionId: 'standard' }
			}
		});
		expect(fixture.tables.shipping_option).toHaveLength(1);
	});

	// The defect: `assertCodeIsFree` reads a missing row through `findOneByWhereOptions`
	// (`shipping-option.service.ts`, line 262) and treats a miss as `null` — but the platform's CRUD
	// base *throws* `NotFoundException` when nothing matches
	// (`packages/core/src/lib/core/crud/crud.service.ts`, lines 465–467, under a doc comment that still
	// claims it answers null). The consequence is not a wrong answer but a total one: a create whose
	// code is free — the first option of an organization, and every subsequent one — raises a 404 and
	// writes nothing, so `shipping_option` can never be populated through this service. `POST
	// /api/shipping-options` answers "The requested record was not found" for every valid request.
	it('[DEFECT] creates a shipping option whose code no other option holds', async () => {
		const fixture = optionFixture();

		const created = await fixture.service.create(flatOption() as never);

		expect(created).toMatchObject({ name: 'Standard delivery', code: 'STANDARD', priceType: ShippingPriceType.FLAT });
		expect(fixture.byCode('STANDARD')).toBeDefined();
		expect(fixture.tables.shipping_option).toHaveLength(1);
	});
});

describe('ShippingOptionService — who may be offered the option (doc 09 §12.4)', () => {
	it('offers an unscoped option everywhere, and an inactive one nowhere', async () => {
		// The two ends of the option's own state: no channel, no region and no profile means every cart;
		// `isActive = false` means none, whatever the cart looks like.
		const fixture = optionFixture([option('anywhere'), option('retired', { isActive: false })]);

		const results = await fixture.service.findEligible({ channelId: CHANNEL_WEB, regionId: REGION_EU });

		expect(results.find((result) => result.option.id === 'anywhere')).toMatchObject({ eligible: true });
		expect(results.find((result) => result.option.id === 'retired')).toMatchObject({
			eligible: false,
			reason: 'SHIPPING_OPTION_INACTIVE'
		});
	});

	it('refuses an option scoped to another channel and offers the one that matches', async () => {
		const fixture = optionFixture([
			option('web-only', { channelId: CHANNEL_WEB }),
			option('counter-only', { channelId: CHANNEL_STORE })
		]);

		const results = await fixture.service.findEligible({ channelId: CHANNEL_WEB });

		expect(results.find((result) => result.option.id === 'web-only')).toMatchObject({ eligible: true });
		expect(results.find((result) => result.option.id === 'counter-only')).toMatchObject({
			eligible: false,
			reason: 'SHIPPING_OPTION_CHANNEL_MISMATCH'
		});
	});

	it('offers a scoped option when the caller states no scope at all', async () => {
		// The service reads an unstated scope as "no opinion" rather than as a scope of null, so an
		// option restricted to a channel is offered to a context that names none. The documented context
		// always carries a channel (doc 09 §12.3), so this branch guards a caller that omits one rather
		// than describing a cart.
		const fixture = optionFixture([option('web-only', { channelId: CHANNEL_WEB })]);

		const results = await fixture.service.findEligible({});

		expect(results[0]).toMatchObject({ eligible: true });
	});

	it('refuses an option that serves another region', async () => {
		const fixture = optionFixture([option('eu-only', { regionId: REGION_EU })]);

		const results = await fixture.service.findEligible({ regionId: REGION_US });

		expect(results[0]).toMatchObject({ eligible: false, reason: 'SHIPPING_OPTION_REGION_MISMATCH' });
	});

	it('refuses an option whose profile is not the profile of anything in the cart', async () => {
		const fixture = optionFixture([option('cold-chain', { profileId: PROFILE_COLD })]);

		const results = await fixture.service.findEligible({ profileIds: [PROFILE_BULK] });

		expect(results[0]).toMatchObject({ eligible: false, reason: 'SHIPPING_OPTION_PROFILE_MISMATCH' });
	});

	it('offers a profile-scoped option when one of the cart’s variants is in that profile', async () => {
		const fixture = optionFixture([option('cold-chain', { profileId: PROFILE_COLD })]);

		const results = await fixture.service.findEligible({ profileIds: [PROFILE_BULK, PROFILE_COLD] });

		expect(results[0]).toMatchObject({ eligible: true });
	});

	it('refuses an option past its weight ceiling and offers it exactly at the ceiling', async () => {
		// The boundary of `maxWeight`: the comparison is "above the ceiling", so a cart that weighs
		// exactly the limit still ships.
		const fixture = optionFixture([option('up-to-30', { maxWeight: 30 })]);

		expect((await fixture.service.findEligible({ totalWeight: 30 }))[0]).toMatchObject({ eligible: true });
		expect((await fixture.service.findEligible({ totalWeight: 30.0001 }))[0]).toMatchObject({
			eligible: false,
			reason: 'SHIPPING_OPTION_WEIGHT_EXCEEDED'
		});
	});

	it('offers an option with a weight ceiling when the caller states no weight', async () => {
		const fixture = optionFixture([option('up-to-30', { maxWeight: 30 })]);

		expect((await fixture.service.findEligible({ itemCount: 1 }))[0]).toMatchObject({ eligible: true });
	});

	it('refuses an option past its item-count ceiling and offers it exactly at the ceiling', async () => {
		const fixture = optionFixture([option('up-to-50', { maxItemCount: 50 })]);

		expect((await fixture.service.findEligible({ itemCount: 50 }))[0]).toMatchObject({ eligible: true });
		expect((await fixture.service.findEligible({ itemCount: 51 }))[0]).toMatchObject({
			eligible: false,
			reason: 'SHIPPING_OPTION_ITEM_COUNT_EXCEEDED'
		});
	});

	it('answers an inactive option with the inactivity rather than with the scope it also fails', async () => {
		// The reason a caller is shown is the first one that applies, and the order is the option's own
		// state before its scope: an operator who retired the option should not be told to widen it.
		const fixture = optionFixture([
			option('retired', { isActive: false, channelId: CHANNEL_STORE, regionId: REGION_US })
		]);

		const results = await fixture.service.findEligible({ channelId: CHANNEL_WEB, regionId: REGION_EU });

		expect(results[0]).toMatchObject({ eligible: false, reason: 'SHIPPING_OPTION_INACTIVE' });
	});

	it('answers every option of the organization, ineligible ones included and in priority order', async () => {
		// The caller decides what to show: an ineligible option is returned with its reason rather than
		// dropped, because the reason is the answer to "why is there no express delivery?".
		const fixture = optionFixture([
			option('later', { priority: 5 }),
			option('first', { priority: 1 }),
			option('middle', { priority: 3, maxItemCount: 1 })
		]);

		const results = await fixture.service.findEligible({ itemCount: 4 });

		expect(results.map((result) => result.option.id)).toEqual(['first', 'middle', 'later']);
		expect(results.map((result) => result.eligible)).toEqual([true, false, true]);
		expect(results[1].reason).toBe('SHIPPING_OPTION_ITEM_COUNT_EXCEEDED');
	});

	it('answers an empty list for an organization that has configured no option', async () => {
		const fixture = optionFixture();

		expect(await fixture.service.findEligible({ channelId: CHANNEL_WEB })).toEqual([]);
	});
});

describe('ShippingOptionService — what an option costs (doc 09 §12.3)', () => {
	it('prices a flat option at the amount it states, unchanged', async () => {
		// The amount is a `numeric(20,6)` and arrives as a number through the entity's transformer; what
		// a caller is quoted is the amount itself, with no rounding of this service's own.
		const fixture = optionFixture([option('standard', { amount: '12.345678', currency: 'EUR' })]);

		expect(await fixture.service.calculate('standard', { channelId: CHANNEL_WEB })).toEqual({
			amount: 12.345678,
			currency: 'EUR',
			eligible: true
		});
	});

	it('prices a flat option whose amount is zero at zero in its own currency', async () => {
		const fixture = optionFixture([option('standard', { amount: 0, currency: 'EUR' })]);

		expect(await fixture.service.calculate('standard', {})).toEqual({ amount: 0, currency: 'EUR', eligible: true });
	});

	it('prices a free option at zero', async () => {
		const fixture = optionFixture([
			option('free-over-50', { priceType: ShippingPriceType.FREE, amount: null, currency: 'EUR' })
		]);

		expect(await fixture.service.calculate('free-over-50', {})).toEqual({
			amount: 0,
			currency: 'EUR',
			eligible: true
		});
	});

	it('names the strategy a calculated option must be priced by instead of inventing a price', async () => {
		// The service answers the option's own answer and names the strategy the checkout has to call,
		// so that a rate is never guessed from a configuration that carries none (doc 09 §12.3).
		const fixture = optionFixture([
			option('rated', {
				priceType: ShippingPriceType.CALCULATED,
				amount: null,
				providerKey: 'registered-rate-strategy',
				currency: 'EUR'
			})
		]);

		expect(await fixture.service.calculate('rated', { totalWeight: 4 })).toEqual({
			amount: 0,
			currency: 'EUR',
			providerKey: 'registered-rate-strategy',
			eligible: true,
			reason: 'CALCULATED_BY_STRATEGY'
		});
	});

	it('quotes nothing for an option the cart cannot choose, and says why', async () => {
		const fixture = optionFixture([option('counter-only', { channelId: CHANNEL_STORE, amount: 9.5 })]);

		expect(await fixture.service.calculate('counter-only', { channelId: CHANNEL_WEB })).toEqual({
			amount: 0,
			currency: 'EUR',
			eligible: false,
			reason: 'SHIPPING_OPTION_CHANNEL_MISMATCH'
		});
	});

	it('refuses to price an option that does not exist', async () => {
		const fixture = optionFixture();

		await expect(fixture.service.calculate(UNKNOWN, {})).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('ShippingOptionService — editing an option (doc 09 §12.2)', () => {
	// This case pinned the previous shape, where the service read the row, computed `version + 1` in
	// JavaScript and wrote both columns unconditionally, and it asserted the raw `UpdateResult` that
	// produced. That write was the read-then-write window the optimistic lock exists to close, so the
	// case now asserts the corrected contract: the version is set by the statement that checks it, and
	// the answer is the version the row now holds.
	it('writes an edit that keeps the shape and lets the conditional write set the next version', async () => {
		const fixture = optionFixture([option('standard', { amount: 4.99, version: 3 })]);

		const answered = await fixture.service.update('standard', { name: 'Standard (2–4 days)', amount: 5.5 } as never);

		expect(answered).toMatchObject({ version: 4 });
		expect(fixture.row('standard')).toMatchObject({ name: 'Standard (2–4 days)', amount: 5.5, version: 4 });
	});

	it('predicates the edit on the version the row held, so a lost update is a conflict', async () => {
		// Two operators editing one option from the same screen both read version 3. Written
		// unconditionally, both wrote version 4 and the second silently replaced the first with nothing
		// to show that anything was lost. The statement now names the version among its criteria, so the
		// row the second write is predicated on no longer exists and the platform answers the conflict.
		const fixture = optionFixture([option('standard', { amount: 4.99, version: 3 })]);
		const stale = { ...fixture.row('standard') };

		await fixture.service.update('standard', { name: 'First edit' } as never);

		// The second writer still holds version 3, which is what the kernel is handed here in place of
		// the re-read the wildcard would otherwise perform.
		await expect(
			(fixture.service as never as { update(id: unknown, entity: unknown): Promise<unknown> }).update(
				{ id: 'standard', version: stale.version },
				{ name: 'Second edit', version: Number(stale.version) + 1 }
			)
		).resolves.toMatchObject({ affected: 0 });
		expect(fixture.row('standard')).toMatchObject({ name: 'First edit', version: 4 });
	});

	it('states the option’s own tenant and organization in the conditional write', async () => {
		// An option id travels, so criteria that name only the row are criteria another tenant's
		// identifier can satisfy. The scope comes from the row this call read.
		const fixture = optionFixture([option('standard', { amount: 4.99, version: 2 })]);
		// `as never` on the receiver makes the spy itself `never`, so its recorded calls cannot be
		// read back. The receiver is widened instead of erased: the spy keeps a usable type and the
		// assertions below can still name the criteria the conditional write stated.
		const update = jest.spyOn(fixture.service as unknown as { update: (...args: unknown[]) => unknown }, 'update');

		await fixture.service.update('standard', { name: 'Standard delivery' } as never);

		expect(
			update.mock.calls
				.map(([criteria]) => criteria)
				.filter((criteria) => criteria !== null && typeof criteria === 'object')
		).toContainEqual({ id: 'standard', tenantId: TENANT, organizationId: ORG, version: 2 });

		update.mockRestore();
	});

	it('refuses an edit that would leave a flat option without an amount', async () => {
		// The merged shape is what is validated, so an edit is held to the same rule as a creation and
		// cannot be used to reach a configuration the create path refuses.
		const fixture = optionFixture([option('standard', { amount: 4.99, currency: 'EUR' })]);

		await expect(fixture.service.update('standard', { amount: null } as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID' }
		});
		expect(fixture.row('standard')).toMatchObject({ amount: 4.99, version: 1 });
	});

	it('refuses an edit that would turn a flat option into a calculated one without a strategy', async () => {
		const fixture = optionFixture([option('standard', { amount: 4.99 })]);

		await expect(
			fixture.service.update('standard', { priceType: ShippingPriceType.CALCULATED } as never)
		).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID', details: { priceType: ShippingPriceType.CALCULATED } }
		});
	});

	it('accepts an edit that keeps the option’s own code', async () => {
		// The guard excludes the row being written, so re-stating a code in an edit that also changes
		// something else cannot collide with itself.
		const fixture = optionFixture([option('standard', { code: 'STANDARD' })]);

		await fixture.service.update('standard', { code: 'STANDARD', name: 'Standard delivery' } as never);

		expect(fixture.row('standard')).toMatchObject({ code: 'STANDARD', name: 'Standard delivery' });
	});

	it('refuses an edit that claims another option’s code', async () => {
		const fixture = optionFixture([
			option('standard', { code: 'STANDARD' }),
			option('express', { code: 'EXPRESS' })
		]);

		await expect(fixture.service.update('standard', { code: 'EXPRESS' } as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_CODE_TAKEN', details: { code: 'EXPRESS', optionId: 'express' } }
		});
		expect(fixture.row('standard')).toMatchObject({ code: 'STANDARD' });
	});

	// The defect: the same `assertCodeIsFree` call, reached from the update path
	// (`shipping-option.service.ts`, line 84 → line 262). Re-coding an option to a code no other option
	// holds — the ordinary way an operator renames `STANDARD` to `GROUND` — raises the base class's 404
	// instead of writing the row.
	it('[DEFECT] accepts an edit that gives an option a code no other option holds', async () => {
		const fixture = optionFixture([option('standard', { code: 'STANDARD' })]);

		await fixture.service.update('standard', { code: 'GROUND' } as never);

		expect(fixture.row('standard')).toMatchObject({ code: 'GROUND' });
	});

	it('refuses an edit on an option that does not exist', async () => {
		const fixture = optionFixture();

		await expect(fixture.service.update(UNKNOWN, { name: 'Nowhere' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('refuses an edit that states no price type on an option that has none', async () => {
		// The other half of the shape guard on the edit path: a row whose stored price type is not one
		// this platform prices cannot be edited into one either.
		const fixture = optionFixture([option('legacy', { priceType: 'BY_WEIGHT' })]);

		await expect(fixture.service.update('legacy', { name: 'Legacy' } as never)).rejects.toMatchObject({
			response: { code: 'SHIPPING_OPTION_INVALID' }
		});
		expect(fixture.row('legacy')).toMatchObject({ name: 'Option legacy' });
	});

	it('refuses an edit that would make the delivery estimate end before it starts', async () => {
		const fixture = optionFixture([option('standard', { estimatedMinDays: 1, estimatedMaxDays: 4 })]);

		await expect(
			fixture.service.update('standard', { estimatedMaxDays: 0 } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.row('standard')).toMatchObject({ estimatedMaxDays: 4 });
	});
});
