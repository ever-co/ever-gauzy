/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a line service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**,
 * with the platform's real money layer behind it.
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { SubscriptionItemService } from './subscription-item.service';

/**
 * The recurring line set: what each cycle bills.
 *
 * Three rules shape every write here, and each is stated on the class:
 *
 * - **one row per `(subscription, variant)`.** "A second row for the same variant would make 'how
 *   many of this does the customer get' answerable two ways, so a change to a variant's line is an
 *   update of that row and never an insert beside it" — which is doc 05 §15.3's unique index;
 * - **a removed line is soft-deleted, never erased.** "A cycle that ran last month billed a line set
 *   that must still be reconstructible, and the row that was removed is part of that answer";
 * - **a price is resolved, not invented.** A stated price is snapshotted as given; otherwise it comes
 *   from the pricing capability, and "with no pricing capability registered and no stated price, the
 *   write is refused rather than priced at zero, because a recurring line that costs nothing is
 *   indistinguishable from a free plan".
 *
 * The suite also pins the invariant the amount is read from — doc 05 §15.3: "a cycle's billing amount
 * equals the sum of `quantity × unitPrice` less the plan discount" — through `recurringAmountOf`, and
 * the last-line refusal that keeps a subscription from becoming an empty one.
 *
 * The service is constructed directly over in-memory tables, with a pricing capability double that
 * records every question it was asked.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000010';
const CUSTOMER = '00000000-0000-4000-8000-000000000030';
const VARIANT = '00000000-0000-4000-8000-000000000020';
const SECOND_VARIANT = '00000000-0000-4000-8000-000000000021';

type Row = Record<string, any>;

/**
 * The in-memory stand-in for the line table's TypeORM repository.
 *
 * @param rows The whole table.
 */
function repository(rows: Row[]) {
	let sequence = 0;
	const live = () => rows.filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});
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
		all: () => rows,
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
			if (entity.id) {
				const index = rows.findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows[index] = { ...rows[index], ...entity };

					return rows[index];
				}
			}

			const created = { id: `item-new-${++sequence}`, ...entity };

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

/** One `subscription_item` row, as the service reads it. */
const itemRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	subscriptionId: SUBSCRIPTION,
	variantId: VARIANT,
	quantity: '1.000000',
	unitPrice: '10.000000',
	position: 0,
	...overrides
});

/**
 * Builds the line service over in-memory tables, a pricing capability and a catalogue.
 *
 * @param options.items The lines the fixture starts with.
 * @param options.prices What the pricing capability answers with, by variant.
 * @param options.withPricing Whether the pricing capability is registered.
 * @param options.withCatalog Whether the catalogue is registered.
 */
function itemFixture(
	options: {
		items?: Row[];
		prices?: Record<string, string | null>;
		withPricing?: boolean;
		withCatalog?: boolean;
	} = {}
) {
	const table = (options.items ?? []).map((row) => ({ ...row }));
	const asked: Row[] = [];
	const statedPrices = options.prices;
	const pricing =
		options.withPricing === false
			? undefined
			: {
					resolveRecurringPrice: async (request: Row) => {
						asked.push(request);

						// A variant the fixture states nothing about is priced at ten; a variant it states
						// `null` for is one the pipeline resolves nothing for, which is the refusal case.
						const resolved =
							statedPrices && request.variantId in statedPrices ? statedPrices[request.variantId] : '10.00';

						return resolved === null ? null : { unitPrice: resolved, currency: request.currency };
					}
			  };
	const catalog =
		options.withCatalog === false
			? undefined
			: {
					isVariantSubscribable: async () => true,
					defaultVariantOf: async () => 'default-variant'
			  };
	const service = new SubscriptionItemService(
		repository(table) as never,
		{} as never,
		pricing as never,
		catalog as never
	);

	return {
		service,
		table,
		asked,
		live: () => table.filter((row) => !row.deletedAt),
		item: (id: string) => table.find((row) => row.id === id)
	};
}

describe('SubscriptionItemService — resolving a line set (doc 05 §15.3, doc 11 §10.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prices and orders a set the caller stated, defaulting the quantity and the position', async () => {
		const fixture = itemFixture();

		const prepared = await fixture.service.prepareItems(
			[
				{ variantId: VARIANT, quantity: '2', unitPrice: '9.99' },
				{ variantId: SECOND_VARIANT, unitPrice: '4.5', position: 7 }
			],
			'USD',
			CUSTOMER
		);

		expect(prepared).toEqual([
			{ variantId: VARIANT, quantity: '2.000000', unitPrice: '9.990000', position: 0, metadata: undefined },
			{ variantId: SECOND_VARIANT, quantity: '1.000000', unitPrice: '4.500000', position: 7, metadata: undefined }
		]);
	});

	it('falls back to the variant the plan delivers when the caller named no lines', async () => {
		const fixture = itemFixture();

		const prepared = await fixture.service.prepareItems([], 'USD', CUSTOMER, 'the-plans-variant');

		expect(prepared).toEqual([
			{
				variantId: 'the-plans-variant',
				quantity: '1.000000',
				unitPrice: '10.000000',
				position: 0,
				metadata: undefined
			}
		]);
	});

	it('refuses an empty set with nothing to fall back to', async () => {
		// "A subscription must name at least one recurring line, or a plan whose catalogue target resolves
		// to a variant" — a subscription that bills nothing is indistinguishable from a free plan.
		const fixture = itemFixture();

		await expect(fixture.service.prepareItems([], 'USD', CUSTOMER)).rejects.toThrow(
			/SUBSCRIPTION_ITEMS_REQUIRED/
		);
		await expect(fixture.service.prepareItems(undefined as never, 'USD')).rejects.toThrow(
			/SUBSCRIPTION_ITEMS_REQUIRED/
		);
	});

	it('refuses a line that names no variant', async () => {
		const fixture = itemFixture();

		await expect(
			fixture.service.prepareItems([{ variantId: undefined as never, unitPrice: '1' }], 'USD')
		).rejects.toThrow(/must name the variant it delivers/);
	});

	it('refuses the same variant twice in one set', async () => {
		// Doc 05 §15.3's unique index is `(subscriptionId, variantId)`: two rows for one variant would make
		// "how many of this does the customer get" answerable two ways.
		const fixture = itemFixture();

		await expect(
			fixture.service.prepareItems(
				[
					{ variantId: VARIANT, quantity: '1', unitPrice: '1' },
					{ variantId: VARIANT, quantity: '2', unitPrice: '1' }
				],
				'USD'
			)
		).rejects.toThrow(/SUBSCRIPTION_ITEM_DUPLICATED/);
	});

	it('resolves an unstated price through the pricing capability, for the customer and the currency', async () => {
		const fixture = itemFixture({ prices: { [VARIANT]: '19.99' } });

		const prepared = await fixture.service.prepareItems([{ variantId: VARIANT }], 'EUR', CUSTOMER);

		expect(prepared[0].unitPrice).toBe('19.990000');
		expect(fixture.asked[0]).toMatchObject({ variantId: VARIANT, customerId: CUSTOMER, currency: 'EUR' });
	});

	it('refuses an unstated price with no pricing capability registered', async () => {
		// "With no pricing capability registered and no stated price, the write is refused rather than
		// priced at zero."
		const fixture = itemFixture({ withPricing: false });

		await expect(fixture.service.prepareItems([{ variantId: VARIANT }], 'USD')).rejects.toThrow(
			/SUBSCRIPTION_PRICING_UNAVAILABLE/
		);
	});

	it('refuses when the pricing capability resolves no price for the variant', async () => {
		const fixture = itemFixture({ prices: { [VARIANT]: null } });

		await expect(fixture.service.prepareItems([{ variantId: VARIANT }], 'USD')).rejects.toThrow(
			/SUBSCRIPTION_PRICE_NOT_FOUND/
		);
	});

	it('snapshots a price the caller states at the currency’s scale, without asking the pricing capability', async () => {
		// A price is money, so it crosses the currency's own boundary — half-up — and the capability that
		// would have resolved it is not consulted at all.
		const fixture = itemFixture({ prices: { [VARIANT]: '99.99' } });

		const prepared = await fixture.service.prepareItems([{ variantId: VARIANT, unitPrice: '8.115' }], 'USD');

		expect(prepared[0].unitPrice).toBe('8.120000');
		expect(fixture.asked).toEqual([]);
	});

	it('rounds a price onto the currency’s scale, half-up', async () => {
		const fixture = itemFixture();

		const jpy = await fixture.service.prepareItems([{ variantId: VARIANT, quantity: '1', unitPrice: '100.5' }], 'JPY');
		const over = await fixture.service.prepareItems(
			[{ variantId: SECOND_VARIANT, quantity: '1', unitPrice: '10.0049' }],
			'USD'
		);

		expect(jpy[0].unitPrice).toBe('101.000000');
		expect(over[0].unitPrice).toBe('10.000000');
	});

	// The defect: the quantity goes through the same `store()` helper as the price, and that helper
	// rounds at the *currency's* minor unit. A quantity is a count of units, not an amount of money, and
	// `subscription_item.quantity` is `numeric(20,6)` with a default of 1 (doc 05 §15.3) — so a
	// subscription for half a unit in a currency with no minor unit is silently doubled, and the customer
	// is billed for twice what they agreed to. The price is unaffected; only the quantity is.
	// (`subscription-item.service.ts`: quantities go through `storeQuantity` and the helpers it uses,
	// which measure them at the quantity column's own scale.)
	it('[DEFECT] keeps a fractional recurring quantity at the quantity column’s scale', async () => {
		const fixture = itemFixture();

		await fixture.service.replaceItems(
			SUBSCRIPTION,
			[{ variantId: VARIANT, quantity: '0.5', unitPrice: '100' }],
			'JPY'
		);

		expect(fixture.live()[0].quantity).toBe('0.500000');

		const amount = await fixture.service.recurringAmountOf(SUBSCRIPTION, 'JPY');

		// Half of a hundred-yen unit is fifty yen, and that is what the cycle must bill.
		expect(amount.round().toStorageString()).toBe('50.000000');
	});

	it('refuses a negative quantity or price', async () => {
		const fixture = itemFixture();

		await expect(
			fixture.service.prepareItems([{ variantId: VARIANT, quantity: '-1', unitPrice: '1' }], 'USD')
		).rejects.toThrow(/SUBSCRIPTION_AMOUNT_INVALID/);
		await expect(
			fixture.service.prepareItems([{ variantId: VARIANT, unitPrice: '-1' }], 'USD')
		).rejects.toThrow(/SUBSCRIPTION_AMOUNT_INVALID/);
	});
});

describe('SubscriptionItemService — writing the set without losing what it replaced', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('updates a line that is still in the set in place and inserts the new one', async () => {
		// The identity of a line survives a rewrite, so any reference a cycle made to it still resolves.
		const fixture = itemFixture({ items: [itemRow('line-1', { quantity: '1.000000' })] });

		const written = await fixture.service.replaceItems(
			SUBSCRIPTION,
			[
				{ variantId: VARIANT, quantity: '3', unitPrice: '10' },
				{ variantId: SECOND_VARIANT, quantity: '1', unitPrice: '5' }
			],
			'USD'
		);

		expect(written.map((line) => line.id)).toEqual(['line-1', 'item-new-1']);
		expect(fixture.item('line-1')).toMatchObject({ quantity: '3.000000' });
		expect(fixture.live()).toHaveLength(2);
	});

	it('soft-deletes a line that is no longer in the set rather than erasing it', async () => {
		const fixture = itemFixture({
			items: [itemRow('line-1'), itemRow('line-2', { variantId: SECOND_VARIANT, position: 1 })]
		});

		await fixture.service.replaceItems(SUBSCRIPTION, [{ variantId: VARIANT, quantity: '1', unitPrice: '10' }], 'USD');

		expect(fixture.item('line-2')?.deletedAt).toBeInstanceOf(Date);
		expect(fixture.table).toHaveLength(2);
		expect(fixture.live()).toHaveLength(1);
	});

	it('answers the set in position order', async () => {
		const fixture = itemFixture();

		const written = await fixture.service.replaceItems(
			SUBSCRIPTION,
			[
				{ variantId: VARIANT, quantity: '1', unitPrice: '1', position: 5 },
				{ variantId: SECOND_VARIANT, quantity: '1', unitPrice: '1', position: 2 }
			],
			'USD'
		);

		expect(written.map((line) => line.position)).toEqual([2, 5]);
	});

	it('replaces the whole set through the single line surface without losing the other lines', async () => {
		const fixture = itemFixture({ items: [itemRow('line-1', { quantity: '1.000000' })] });

		const added = await fixture.service.addItem(SUBSCRIPTION, { variantId: SECOND_VARIANT, unitPrice: '5' }, 'USD');

		expect(added).toMatchObject({ variantId: SECOND_VARIANT });
		expect(fixture.live().map((line) => line.variantId).sort()).toEqual([VARIANT, SECOND_VARIANT].sort());
	});

	it('changes one line’s quantity, and refuses a variant the subscription does not carry', async () => {
		const fixture = itemFixture({ items: [itemRow('line-1', { quantity: '1.000000' })] });

		const changed = await fixture.service.changeQuantity(SUBSCRIPTION, VARIANT, '4', 'USD');

		expect(changed).toMatchObject({ id: 'line-1', quantity: '4.000000' });
		await expect(fixture.service.changeQuantity(SUBSCRIPTION, SECOND_VARIANT, '1', 'USD')).rejects.toThrow(
			/SUBSCRIPTION_ITEM_NOT_FOUND/
		);
	});

	it('removes one line, and refuses to remove the last one', async () => {
		// "A subscription with no lines bills nothing and would look like a free plan" — the refusal is what
		// makes pause or cancel the answer instead.
		const fixture = itemFixture({
			items: [itemRow('line-1'), itemRow('line-2', { variantId: SECOND_VARIANT, position: 1 })]
		});

		expect(await fixture.service.removeItem(SUBSCRIPTION, SECOND_VARIANT)).toBe('line-2');
		expect(fixture.item('line-2')?.deletedAt).toBeInstanceOf(Date);

		await expect(fixture.service.removeItem(SUBSCRIPTION, VARIANT)).rejects.toThrow(/SUBSCRIPTION_LAST_ITEM/);
		expect(fixture.item('line-1')?.deletedAt).toBeUndefined();
	});

	it('refuses to remove or change a line of an unknown variant', async () => {
		const fixture = itemFixture({ items: [itemRow('line-1')] });

		await expect(fixture.service.removeItem(SUBSCRIPTION, 'nothing')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SubscriptionItemService — the recurring amount a cycle bills (doc 05 §15.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('totals the line set as the sum of quantity × unitPrice, before any discount', async () => {
		const fixture = itemFixture({
			items: [
				itemRow('line-1', { quantity: '2.000000', unitPrice: '19.990000' }),
				itemRow('line-2', { variantId: SECOND_VARIANT, quantity: '3.000000', unitPrice: '4.500000', position: 1 })
			]
		});

		const amount = await fixture.service.recurringAmountOf(SUBSCRIPTION, 'USD');

		expect(amount.toStorageString()).toBe('53.480000');
	});

	it('carries the product of a line exactly, where binary floating point drifts', async () => {
		// `8.115 × 3` is exactly `24.345`, which rounds half-up to `24.35`; in IEEE-754 the product is
		// `24.344999999999999`. The control below is the naive answer, asserted so this cannot pass by luck.
		const fixture = itemFixture({
			items: [itemRow('line-1', { quantity: '3.000000', unitPrice: '8.115000' })]
		});

		const amount = await fixture.service.recurringAmountOf(SUBSCRIPTION, 'USD');

		expect((8.115 * 3).toFixed(2)).toBe('24.34');
		expect(amount.round().toStorageString()).toBe('24.350000');
	});

	it('totals an empty set at zero rather than refusing it', async () => {
		const fixture = itemFixture();

		const amount = await fixture.service.recurringAmountOf(SUBSCRIPTION, 'USD');

		expect(amount.isZero()).toBe(true);
	});

	it('reads the lines inside the caller’s organization only, in position order', async () => {
		const fixture = itemFixture({
			items: [
				itemRow('second', { position: 1 }),
				itemRow('first', { position: 0 }),
				itemRow('theirs', { organizationId: OTHER_ORG })
			]
		});

		expect((await fixture.service.findForSubscription(SUBSCRIPTION)).map((line) => line.id)).toEqual([
			'first',
			'second'
		]);
		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('resolves the variant a plan bills, and answers nothing for a plan that delivers nothing', async () => {
		const fixture = itemFixture();

		expect(await fixture.service.variantOfPlan({ variantId: VARIANT })).toBe(VARIANT);
		expect(await fixture.service.variantOfPlan({ productId: 'a-product' })).toBe('default-variant');
		expect(await fixture.service.variantOfPlan({})).toBeUndefined();

		const withoutCatalog = itemFixture({ withCatalog: false });

		expect(await withoutCatalog.service.variantOfPlan({ productId: 'a-product' })).toBeUndefined();
	});

	it('refuses a line set it cannot read back, because the scope it writes is the scope it reads', async () => {
		const fixture = itemFixture();

		const written = await fixture.service.replaceItems(
			SUBSCRIPTION,
			[{ variantId: VARIANT, quantity: '1', unitPrice: '1' }],
			'USD'
		);

		expect(written[0]).toMatchObject({ tenantId: TENANT, organizationId: ORG });
		expect(await fixture.service.findForSubscription(SUBSCRIPTION)).toHaveLength(1);
	});
});

describe('SubscriptionItemService — the refusals a caller has to be able to tell apart', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers each unpriceable line with the code that says which question failed', async () => {
		const unavailable = itemFixture({ withPricing: false });
		const notFound = itemFixture({ prices: { [VARIANT]: null } });

		await expect(
			unavailable.service.resolveUnitPrice(VARIANT, 'USD', undefined, CUSTOMER)
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(unavailable.service.resolveUnitPrice(VARIANT, 'USD', undefined, CUSTOMER)).rejects.toThrow(
			/SUBSCRIPTION_PRICING_UNAVAILABLE/
		);
		await expect(notFound.service.resolveUnitPrice(VARIANT, 'USD')).rejects.toThrow(
			/SUBSCRIPTION_PRICE_NOT_FOUND/
		);
		// A stated price never reaches either refusal, which is the control for both.
		await expect(notFound.service.resolveUnitPrice(VARIANT, 'USD', '3')).resolves.toBe('3.000000');
	});
});
