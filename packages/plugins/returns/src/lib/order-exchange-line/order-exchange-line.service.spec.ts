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

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
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
		Warehouse: class Warehouse {},
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
import { OrderExchangeStatus } from '../returns.types';
import { OrderExchangeLineService } from './order-exchange-line.service';

/**
 * The outbound half of an exchange, and the prices the difference is computed from.
 *
 * The rule is stated on the class and is a rule about **when a price may be invented**: a replacement
 * is priced once, when the line is written, and the price is kept — `differenceDue` is
 * `outbound − inbound` and the customer is charged or credited exactly that, so re-resolving the price
 * later would rewrite what somebody already paid. Hence:
 *
 * - a replacement of a variant that was **on the order** is priced from the order's own unit price,
 *   which is the price the customer already agreed to (doc 10 §12.4: replacements enter the order "at
 *   the exchange line's `unitPrice` (default: the current resolved price...)");
 * - a replacement the caller states a price for is snapshotted as given, at the currency's scale;
 * - a replacement that neither the order nor the caller prices is **refused** rather than written at
 *   zero (`EXCHANGE_PRICE_UNAVAILABLE`), because a zero-priced replacement is indistinguishable from a
 *   free one;
 * - a set is written **all or nothing**: one line that cannot be priced leaves the exchange's existing
 *   lines exactly as they were.
 *
 * The service is constructed directly with in-memory doubles of its repositories.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const OTHER_ORDER_LINE = '00000000-0000-4000-8000-000000000021';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const SECOND_VARIANT = '00000000-0000-4000-8000-000000000031';

type Row = Record<string, any>;

interface ITables {
	order_exchange: Row[];
	order_exchange_line: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const live = () => tables[tableName].filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});

	return {
		rows: live,
		find: async (options: any = {}) => live().filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => live().find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = live().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes —
			// `TenantAwareCrudService.create` reads `RequestContext.currentTenantId()` — and every read below
			// filters by it. A double that did not would make "write a line and read it straight back"
			// impossible, which is what a set rewrite does.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
		save: async (entity: any) => {
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

/** One `order_exchange` row, as the service reads it. */
const exchangeRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `EXC-${id}`,
	status: OrderExchangeStatus.OPEN,
	currency: 'USD',
	returnId: 'return-1',
	...overrides
});

/**
 * Builds the exchange-line service over in-memory tables and one order capability.
 *
 * @param options.exchanges The exchanges the fixture starts with.
 * @param options.lines The outbound lines the fixture starts with.
 * @param options.fulfilled What the order domain reports as fulfilled.
 * @param options.withFulfillment Whether the order capability is registered.
 */
function exchangeLineFixture(
	options: {
		exchanges?: Row[];
		lines?: Row[];
		fulfilled?: Array<{ orderLineId: string; fulfilledQuantity: string; variantId?: string; unitPrice?: string }>;
		withFulfillment?: boolean;
	} = {}
) {
	const tables: ITables = {
		order_exchange: [...(options.exchanges ?? [exchangeRow('exchange-1')])],
		order_exchange_line: [...(options.lines ?? [])]
	};
	const fulfillment =
		options.withFulfillment === false
			? undefined
			: {
					getFulfilledLines: async () =>
						options.fulfilled ?? [
							{ orderLineId: ORDER_LINE, fulfilledQuantity: '2.000000', variantId: VARIANT, unitPrice: '19.99' },
							{
								orderLineId: OTHER_ORDER_LINE,
								fulfilledQuantity: '1.000000',
								variantId: SECOND_VARIANT,
								unitPrice: '4.50'
							}
						]
			  };
	const service = new OrderExchangeLineService(
		repository(tables, 'order_exchange_line') as never,
		{} as never,
		repository(tables, 'order_exchange') as never,
		fulfillment as never
	);

	return {
		service,
		tables,
		live: () => tables.order_exchange_line.filter((row) => !row.deletedAt),
		line: (id: string) => tables.order_exchange_line.find((row) => row.id === id)
	};
}

describe('OrderExchangeLineService — where a replacement’s price comes from (doc 10 §12.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prices a replacement of an ordered variant at the price the customer already agreed to', async () => {
		const fixture = exchangeLineFixture();

		const [written] = await fixture.service.replaceLines('exchange-1', [
			{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '2' }
		]);

		expect(written).toMatchObject({
			exchangeId: 'exchange-1',
			orderLineId: ORDER_LINE,
			variantId: VARIANT,
			quantity: '2.000000',
			unitPrice: '19.990000'
		});
	});

	it('snapshots a price the caller states, which outranks the order’s own', async () => {
		// A staff member who negotiated a different replacement price states it; the line keeps it, and
		// that is what the difference is computed from afterwards.
		const fixture = exchangeLineFixture();

		const [written] = await fixture.service.replaceLines('exchange-1', [
			{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1', unitPrice: '12.3456' }
		]);

		expect(written.unitPrice).toBe('12.350000');
	});

	it('prices an additional variant the caller states a price for, even though it was never on the order', async () => {
		const fixture = exchangeLineFixture();

		const [written] = await fixture.service.replaceLines('exchange-1', [
			{ variantId: 'a-variant-never-ordered', quantity: '1', unitPrice: '7' }
		]);

		expect(written).toMatchObject({ variantId: 'a-variant-never-ordered', unitPrice: '7.000000' });
	});

	it('refuses a replacement nothing can price, and writes nothing', async () => {
		// "The service refuses the line rather than inventing a price from nothing": a replacement written
		// at zero would make the exchange's difference a lie and ship goods for nothing.
		const fixture = exchangeLineFixture({ lines: [{ id: 'existing', exchangeId: 'exchange-1' }] });

		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: 'a-variant-never-ordered', quantity: '1' }])
		).rejects.toThrow(/EXCHANGE_PRICE_UNAVAILABLE/);

		// All or nothing: the set that was there is untouched and nothing new was written.
		expect(fixture.line('existing')?.deletedAt).toBeUndefined();
		expect(fixture.tables.order_exchange_line).toHaveLength(1);
	});

	it('refuses a replacement whose order line carries no price at all', async () => {
		const fixture = exchangeLineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '2.000000', variantId: VARIANT }]
		});

		await expect(
			fixture.service.replaceLines('exchange-1', [{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1' }])
		).rejects.toThrow(/EXCHANGE_PRICE_UNAVAILABLE/);
	});

	it('refuses to resolve any price with no order capability registered', async () => {
		const fixture = exchangeLineFixture({ withFulfillment: false });

		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: VARIANT, quantity: '1' }])
		).rejects.toThrow(/EXCHANGE_FULFILLMENT_UNAVAILABLE/);
		expect(fixture.live()).toEqual([]);

		// A stated price still needs no order, but the set as a whole is resolved through it, so the
		// refusal is the same: the capability is what the whole write is validated against.
		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }])
		).rejects.toThrow(/EXCHANGE_FULFILLMENT_UNAVAILABLE/);
	});
});

describe('OrderExchangeLineService — the lines a set may and may not hold (doc 10 §12.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a line that ships no quantity, at the storage boundary', async () => {
		const fixture = exchangeLineFixture();

		for (const quantity of ['0', '-1', '0.0000004']) {
			await expect(
				fixture.service.replaceLines('exchange-1', [{ variantId: VARIANT, quantity, unitPrice: '1' }])
			).rejects.toThrow(/must ship a positive quantity/);
		}
		expect(fixture.live()).toEqual([]);
	});

	it('refuses a line that names no replacement variant', async () => {
		const fixture = exchangeLineFixture();

		await expect(
			fixture.service.replaceLines('exchange-1', [{ quantity: '1', unitPrice: '1' } as never])
		).rejects.toThrow(/must name the replacement variant/);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses an empty outbound set', async () => {
		const fixture = exchangeLineFixture();

		await expect(fixture.service.replaceLines('exchange-1', [])).rejects.toThrow(/at least one outbound line/);
	});

	it('refuses to rewrite the lines of an exchange that has been resolved', async () => {
		const fixture = exchangeLineFixture({
			exchanges: [exchangeRow('exchange-1', { status: OrderExchangeStatus.APPROVED })],
			lines: [{ id: 'line-1', exchangeId: 'exchange-1' }]
		});

		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }])
		).rejects.toThrow(/cannot be changed; only an open or requested exchange can be edited/);
		expect(fixture.line('line-1')?.deletedAt).toBeUndefined();
	});

	it('refuses to write lines against an exchange of another organization', async () => {
		const fixture = exchangeLineFixture({
			exchanges: [exchangeRow('exchange-1', { organizationId: OTHER_ORG })]
		});

		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.live()).toEqual([]);
	});

	it('replaces the set rather than adding to it, and writes every line of the new one', async () => {
		const fixture = exchangeLineFixture({ lines: [{ id: 'stale', exchangeId: 'exchange-1' }] });

		const written = await fixture.service.replaceLines('exchange-1', [
			{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1' },
			{ orderLineId: OTHER_ORDER_LINE, variantId: SECOND_VARIANT, quantity: '1' }
		]);

		expect(written).toHaveLength(2);
		expect(fixture.line('stale')?.deletedAt).toBeInstanceOf(Date);
		expect(fixture.live()).toHaveLength(2);
	});

	it('reads an exchange’s outbound lines inside the caller’s organization only', async () => {
		const fixture = exchangeLineFixture({
			lines: [
				{ id: 'line-1', tenantId: TENANT, organizationId: ORG, exchangeId: 'exchange-1' },
				{ id: 'line-2', tenantId: TENANT, organizationId: ORG, exchangeId: 'another-exchange' },
				{ id: 'line-3', tenantId: TENANT, organizationId: OTHER_ORG, exchangeId: 'exchange-1' }
			]
		});

		expect((await fixture.service.findForExchange('exchange-1')).map((line) => line.id)).toEqual(['line-1']);
	});
});

describe('OrderExchangeLineService — valuing a set of lines (doc 10 §12.5)', () => {
	const line = (unitPrice: string, quantity: string) => ({ unitPrice, quantity });

	it('values a set exactly, at the currency’s scale', () => {
		// `exchangeCharge(exchangeLine) = round(exchangeLine.unitPrice * exchangeLine.quantity)` is the
		// outbound half of the difference, so a value that drifts is a customer charged the drift.
		const fixture = exchangeLineFixture();

		expect(fixture.service.valueOf([line('19.99', '2.000000')] as never, 'USD')).toBe('39.980000');
		expect(
			fixture.service.valueOf([line('19.99', '3.000000'), line('4.50', '2.000000')] as never, 'USD')
		).toBe('68.970000');
	});

	it('values a line whose price carries more precision than the currency, once, at the end', () => {
		// A third of a cent three times is a cent: the parts are exact and the total crosses one boundary.
		const fixture = exchangeLineFixture();

		expect(fixture.service.valueOf([line('0.01', '0.333333')] as never, 'USD')).toBe('0.000000');
		expect(
			fixture.service.valueOf([line('10.00', '0.333333'), line('10.00', '0.333333'), line('10.00', '0.333334')] as never, 'USD')
		).toBe('10.000000');
	});

	it('values an empty set at zero rather than refusing it', () => {
		// A set that has not been written yet is worth nothing, which is what the difference of an
		// exchange with no outbound lines has to be before its approval refuses it.
		const fixture = exchangeLineFixture();

		expect(fixture.service.valueOf([] as never, 'USD')).toBe('0.000000');
	});

	it('rounds a product that binary floating point resolves downward in the other direction', () => {
		// The case that makes the money layer worth having. `8.115 × 3` is exactly `24.345`, which rounds
		// half-up to `24.35`; in IEEE-754 the product is `24.344999999999999`, which rounds to `24.34`. The
		// customer's replacement price is one cent different depending on which arithmetic is used — and
		// the control below is that naive answer, asserted so this case cannot pass by accident.
		const fixture = exchangeLineFixture();

		const naive = (8.115 * 3).toFixed(2);

		expect(naive).toBe('24.34');
		expect(fixture.service.valueOf([line('8.115', '3.000000')] as never, 'USD')).toBe('24.350000');
		// The value is carried at the storage scale of a money column, whatever the caller typed.
		expect(fixture.service.valueOf([line('8.115', '3.000000')] as never, 'USD')).toMatch(/^\d+\.\d{6}$/);
	});
});
