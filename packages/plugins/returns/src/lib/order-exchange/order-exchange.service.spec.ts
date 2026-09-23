/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an exchange service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the exchange service and the two line services it prices through, with the
 * platform's real money layer behind them.
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
		VersionedColumn: decorator,
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
import { OrderExchangeLineService } from '../order-exchange-line/order-exchange-line.service';
import { OrderReturnLineService } from '../order-return-line/order-return-line.service';
import { OrderExchangeService } from './order-exchange.service';

/**
 * A return that immediately becomes a new shipment.
 *
 * The domain exists for one number. Doc 10 §12.5 states it:
 *
 * ```
 * exchangeCharge(exchangeLine)  = round(exchangeLine.unitPrice * exchangeLine.quantity)
 * returnCredit(orderLine, qty)  = perUnitRefundable(orderLine) * qty
 * differenceDue                 = Σ exchangeCharge - Σ returnCredit
 * ```
 *
 * and the section that introduces it states why it is snapshotted rather than recomputed: "computing
 * it after the fact from live prices would mean the customer pays a number nobody quoted them". The
 * suite pins that, plus the two-sidedness of the document:
 *
 * - an exchange needs **both halves** — outbound lines to ship and an inbound return with lines to
 *   price against — and approving one without the other is refused, "because a one-sided exchange is
 *   either a sale or a return";
 * - the difference is **signed**: positive when the customer owes money, negative when the tenant does;
 * - the inbound side is priced at the order's own unit prices for the returned quantities, which is
 *   what the customer originally paid, and a line whose price cannot be read refuses rather than
 *   pricing at zero;
 * - the period boundaries and the quoted amount are frozen at approval, so a later renegotiation
 *   cannot restate what was agreed.
 *
 * The service is constructed directly over in-memory tables.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const SECOND_ORDER_LINE = '00000000-0000-4000-8000-000000000021';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const SECOND_VARIANT = '00000000-0000-4000-8000-000000000031';
const RETURN = '00000000-0000-4000-8000-000000000050';

type Row = Record<string, any>;

interface ITables {
	order_exchange: Row[];
	order_exchange_line: Row[];
	order_return: Row[];
	order_return_line: Row[];
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
		count: async (options: any = {}) => live().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes —
			// `TenantAwareCrudService.create` reads `RequestContext.currentTenantId()` — and every read below
			// filters by it. A double that did not would make "write a line and read it straight back", which
			// is exactly what an exchange's creation does, impossible.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
		save: async (entity: any) => {
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

/** One `order_exchange` row, as the service reads it. */
const exchangeRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `EXC-${id}`,
	status: OrderExchangeStatus.OPEN,
	currency: 'USD',
	allowBackorder: false,
	...overrides
});

/** One outbound line of an exchange, as the service reads it. */
const outboundRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	exchangeId: 'exchange-1',
	orderLineId: ORDER_LINE,
	variantId: VARIANT,
	quantity: '2.000000',
	unitPrice: '19.990000',
	...overrides
});

/** One line of the inbound return, as the return service reads it. */
const inboundRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	returnId: RETURN,
	orderLineId: SECOND_ORDER_LINE,
	quantity: '1.000000',
	receivedQuantity: '0',
	damagedQuantity: '0',
	restock: true,
	createdAt: '2026-01-01T00:00:01.000Z',
	...overrides
});

/**
 * Builds the exchange service over one in-memory store, with the real line services behind it.
 *
 * @param options.exchanges The exchanges the fixture starts with.
 * @param options.outbound The outbound lines the fixture starts with.
 * @param options.inbound The inbound return lines the fixture starts with.
 * @param options.fulfilled What the order domain reports as fulfilled, which is what both sides price
 * against.
 * @param options.withFulfillment Whether the order capability is registered.
 * @param options.numberSeries Whether the organization has an `EXCHANGE` series.
 */
function exchangeFixture(
	options: {
		exchanges?: Row[];
		outbound?: Row[];
		inbound?: Row[];
		fulfilled?: Array<{ orderLineId: string; fulfilledQuantity: string; variantId?: string; unitPrice?: string }>;
		withFulfillment?: boolean;
		numberSeries?: boolean;
	} = {}
) {
	const tables: ITables = {
		order_exchange: [...(options.exchanges ?? [exchangeRow('exchange-1')])],
		order_exchange_line: [...(options.outbound ?? [])],
		order_return: [
			{ id: RETURN, tenantId: TENANT, organizationId: ORG, orderId: ORDER, status: 'APPROVED', currency: 'USD' }
		],
		order_return_line: [...(options.inbound ?? [])]
	};
	const typeOrmOrderExchangeRepository = repository(tables, 'order_exchange');
	const fulfillment =
		options.withFulfillment === false
			? undefined
			: {
					getFulfilledLines: async () =>
						options.fulfilled ?? [
							{
								orderLineId: ORDER_LINE,
								fulfilledQuantity: '2.000000',
								variantId: VARIANT,
								unitPrice: '19.99'
							},
							{
								orderLineId: SECOND_ORDER_LINE,
								fulfilledQuantity: '1.000000',
								variantId: SECOND_VARIANT,
								unitPrice: '4.50'
							}
						]
			  };
	const lineService = new OrderExchangeLineService(
		repository(tables, 'order_exchange_line') as never,
		{} as never,
		typeOrmOrderExchangeRepository as never,
		fulfillment as never
	);
	const returnLineService = new OrderReturnLineService(
		repository(tables, 'order_return_line') as never,
		{} as never,
		repository(tables, 'order_return') as never,
		fulfillment as never
	);
	const sequenceCalls: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			sequenceCalls.push(key);

			if (options.numberSeries === false) {
				throw new Error(`no series configured for ${key}`);
			}

			return { formatted: 'EXC-000001', key };
		}
	};
	const service = new OrderExchangeService(
		typeOrmOrderExchangeRepository as never,
		{} as never,
		lineService,
		returnLineService,
		sequenceService as never,
		fulfillment as never
	);

	return {
		service,
		tables,
		sequenceCalls,
		exchange: (id: string) => tables.order_exchange.find((row) => row.id === id),
		outboundLines: () => tables.order_exchange_line.filter((row) => !row.deletedAt)
	};
}

/** The fixture both halves of a priced exchange need: two units out, one unit back. */
const pricedExchange = (overrides: { outbound?: Row[]; inbound?: Row[]; exchange?: Row } = {}) =>
	exchangeFixture({
		exchanges: [exchangeRow('exchange-1', { returnId: RETURN, ...(overrides.exchange ?? {}) })],
		outbound: overrides.outbound ?? [outboundRow('out-1')],
		inbound: overrides.inbound ?? [inboundRow('in-1')]
	});

describe('OrderExchangeService — raising an exchange (doc 10 §12.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises an exchange with its number, its status and its outbound lines', async () => {
		const fixture = exchangeFixture({ exchanges: [], outbound: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ variantId: VARIANT, quantity: '1', unitPrice: '9.99' }]
		} as never);

		expect(created).toMatchObject({
			orderId: ORDER,
			number: 'EXC-000001',
			status: OrderExchangeStatus.OPEN,
			allowBackorder: false,
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.sequenceCalls).toEqual(['EXCHANGE']);
		expect(created.lines).toHaveLength(1);
		expect(created.lines?.[0]).toMatchObject({ exchangeId: created.id, variantId: VARIANT, unitPrice: '9.990000' });
	});

	it('prices the difference at creation when the inbound return is already known', async () => {
		// The exchange and its return are often created together, and the difference is what the customer
		// is quoted, so it is settled as soon as both halves exist rather than left for the approval.
		const fixture = exchangeFixture({
			exchanges: [],
			outbound: [],
			inbound: [inboundRow('in-1')]
		});

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			returnId: RETURN,
			lines: [{ variantId: VARIANT, quantity: '2', unitPrice: '19.99' }]
		} as never);

		// 2 × 19.99 out, 1 × 4.50 back.
		expect(created.differenceDue).toBe('35.480000');
		expect(fixture.exchange(created.id)?.differenceDue).toBe('35.480000');
	});

	it('leaves the difference unstated while there is no inbound return to price against', async () => {
		const fixture = exchangeFixture({ exchanges: [], outbound: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ variantId: VARIANT, quantity: '1', unitPrice: '9.99' }]
		} as never);

		expect(created.differenceDue).toBeUndefined();
	});

	it('refuses an exchange that names no order, no currency or no line', async () => {
		const fixture = exchangeFixture({ exchanges: [], outbound: [] });

		await expect(
			fixture.service.create({
				currency: 'USD',
				lines: [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }]
			} as never)
		).rejects.toThrow(/must name the order it is against/);

		await expect(
			fixture.service.create({
				orderId: ORDER,
				lines: [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }]
			} as never)
		).rejects.toThrow(/must state the currency/);

		await expect(fixture.service.create({ orderId: ORDER, currency: 'USD' } as never)).rejects.toThrow(
			/at least one outbound line/
		);

		expect(fixture.tables.order_exchange).toEqual([]);
		expect(fixture.sequenceCalls).toEqual([]);
	});

	it('names the missing numbering series rather than failing generically', async () => {
		const fixture = exchangeFixture({ exchanges: [], outbound: [], numberSeries: false });

		await expect(
			fixture.service.create({
				orderId: ORDER,
				currency: 'USD',
				lines: [{ variantId: VARIANT, quantity: '1', unitPrice: '1' }]
			} as never)
		).rejects.toThrow(/"EXCHANGE"/);
		expect(fixture.tables.order_exchange).toEqual([]);
	});
});

describe('OrderExchangeService — pricing the difference (doc 10 §12.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prices outbound value less inbound value, at the currency’s scale', async () => {
		const fixture = pricedExchange();

		const difference = await fixture.service.computeDifference(fixture.exchange('exchange-1') as never);

		// outbound 2 × 19.99 = 39.98; inbound 1 × 4.50 = 4.50; the customer owes the difference.
		expect(difference).toBe('35.480000');
	});

	it('leaves the difference signed when the replacement is the cheaper half', async () => {
		// A downgrade credits the customer. The sign is the information: a magnitude would leave the
		// settlement step unable to tell a charge from a credit.
		const fixture = pricedExchange({
			outbound: [outboundRow('out-1', { orderLineId: SECOND_ORDER_LINE, variantId: SECOND_VARIANT, quantity: '1.000000', unitPrice: '4.500000' })],
			inbound: [inboundRow('in-1', { orderLineId: ORDER_LINE, quantity: '1.000000' })]
		});

		expect(await fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).toBe('-15.490000');
	});

	it('sums several lines of each half exactly', async () => {
		const fixture = pricedExchange({
			outbound: [
				outboundRow('out-1', { quantity: '2.000000', unitPrice: '19.990000' }),
				outboundRow('out-2', { orderLineId: SECOND_ORDER_LINE, variantId: SECOND_VARIANT, quantity: '3.000000', unitPrice: '4.500000' })
			],
			inbound: [inboundRow('in-1', { quantity: '1.000000' })]
		});

		// 39.98 + 13.50 = 53.48 out, 4.50 back.
		expect(await fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).toBe('48.980000');
	});

	it('rounds a product that binary floating point resolves the other way', async () => {
		// `8.115 × 3` is exactly `24.345`, which rounds half-up to `24.35`; in IEEE-754 the product is
		// `24.344999999999999`, which rounds to `24.34`. The control below is the naive answer, asserted so
		// this case cannot pass by accident.
		const fixture = pricedExchange({
			outbound: [outboundRow('out-1', { quantity: '3.000000', unitPrice: '8.115000' })],
			inbound: [inboundRow('in-1', { orderLineId: SECOND_ORDER_LINE, quantity: '0.000000' })]
		});

		expect((8.115 * 3).toFixed(2)).toBe('24.34');
		expect(await fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).toBe('24.350000');
	});

	it('refuses to price an exchange that has no inbound return', async () => {
		const fixture = exchangeFixture({ exchanges: [exchangeRow('exchange-1')], outbound: [outboundRow('out-1')] });

		await expect(fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).rejects.toThrow(
			/no difference until its inbound return exists/
		);
	});

	it('refuses to price the inbound side with no order capability registered', async () => {
		// The returned units are priced at what the customer originally paid, and only the order domain
		// knows that; without it the inbound half is unpriceable rather than free.
		const withOrder = pricedExchange();
		const withoutOrder = exchangeFixture({
			exchanges: [exchangeRow('exchange-1', { returnId: RETURN })],
			outbound: [outboundRow('out-1')],
			inbound: [inboundRow('in-1')],
			withFulfillment: false
		});

		// Control: the same fixture with the capability prices the exchange.
		await expect(withOrder.service.computeDifference(withOrder.exchange('exchange-1') as never)).resolves.toBe('35.480000');
		await expect(
			withoutOrder.service.computeDifference(withoutOrder.exchange('exchange-1') as never)
		).rejects.toThrow(/EXCHANGE_FULFILLMENT_UNAVAILABLE/);
	});

	it('refuses when an inbound line’s unit price cannot be read from the order', async () => {
		// A returned unit the order cannot price is a credit nobody can compute, so the exchange refuses
		// rather than treating it as free.
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('exchange-1', { returnId: RETURN })],
			outbound: [outboundRow('out-1')],
			inbound: [inboundRow('in-1', { orderLineId: 'a-line-with-no-price' })],
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '2.000000', variantId: VARIANT, unitPrice: '19.99' }]
		});

		await expect(fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).rejects.toThrow(
			/EXCHANGE_PRICE_UNAVAILABLE/
		);
	});

	it('refuses when an inbound line names no order line at all', async () => {
		const fixture = pricedExchange({ inbound: [inboundRow('in-1', { orderLineId: undefined })] });

		await expect(fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).rejects.toThrow(
			/EXCHANGE_PRICE_UNAVAILABLE/
		);
	});
});

/**
 * The exchange's own answer to ADR-26, asserted rather than argued in a comment.
 *
 * ADR-26 names an exchange among the moves that must recompute the order's totals, its `paymentStatus`
 * and its `fulfillmentStatus` from the ledgers, and **this service is the one writer of the five that
 * asks for none**. The reading that decides it is the derivations': `computeTotals` reads the order's
 * lines, its shipping methods, its credit lines, its adjustments, its tax lines and its
 * `order_transaction` ledger; `derivePaymentStatus` reads the order's status, that snapshot and the same
 * ledger; `deriveFulfillmentStatus` reads the order's status and five sums over its lines. Every method
 * of this service writes the exchange's own row and its own lines — it injects no refund gateway, no
 * stock ledger and no reservation port, so it cannot append a ledger row even by accident — and
 * `order_exchange.returnId` is a link rather than a counter.
 *
 * Doc 10 §12.5's `settle-difference` step, which *would* move a ledger and would owe a recompute, is not
 * implemented here: the difference is priced onto the row and left there. That is what these two tests
 * pin, so the day the step lands, the test that has to change is this one.
 */
describe('OrderExchangeService — resolving writes nothing the order derives from (ADR-26)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prices the difference onto its own row and appends nothing beside it', async () => {
		// A downgrade, so the customer is owed: the case §12.5 would settle with a refund if the step
		// existed. It is priced, signed, and left — no refund is raised, no second document is numbered,
		// and no line of either half is written.
		const fixture = pricedExchange({
			exchange: { status: OrderExchangeStatus.REQUESTED },
			// The downgrade the pricing suite already pins: a replacement the fulfilled map cannot price is
			// valued at the line's own snapshotted price, so the customer is owed the difference.
			outbound: [
				outboundRow('out-1', {
					orderLineId: SECOND_ORDER_LINE,
					variantId: SECOND_VARIANT,
					quantity: '1.000000',
					unitPrice: '4.500000'
				})
			],
			inbound: [inboundRow('in-1', { orderLineId: ORDER_LINE, quantity: '1.000000' })]
		});
		const sequencesBefore = [...fixture.sequenceCalls];
		const outboundBefore = fixture.tables.order_exchange_line.length;
		const inboundBefore = fixture.tables.order_return_line.length;

		const approved = await fixture.service.approve('exchange-1');

		expect(approved).toMatchObject({ status: OrderExchangeStatus.APPROVED, differenceDue: '-15.490000' });
		expect(fixture.tables.order_exchange_line).toHaveLength(outboundBefore);
		expect(fixture.tables.order_return_line).toHaveLength(inboundBefore);
		expect(fixture.sequenceCalls).toEqual(sequencesBefore);
	});

	it('writes only its own row on the three transitions that end or withdraw it', async () => {
		// The other three candidate call sites. Each writes a status on the exchange and nothing else, which
		// is the whole of the answer: there is no input of any derivation for a recompute to move.
		const fixture = exchangeFixture({
			exchanges: [
				exchangeRow('rejected', { status: OrderExchangeStatus.REQUESTED }),
				exchangeRow('cancelled', { status: OrderExchangeStatus.REQUESTED }),
				exchangeRow('closed', { returnId: RETURN, status: OrderExchangeStatus.APPROVED })
			]
		});
		const outboundBefore = fixture.tables.order_exchange_line.length;
		const sequencesBefore = [...fixture.sequenceCalls];

		await expect(fixture.service.reject('rejected', 'out of policy')).resolves.toMatchObject({
			status: OrderExchangeStatus.REJECTED
		});
		await expect(fixture.service.cancel('cancelled', 'customer withdrew')).resolves.toMatchObject({
			status: OrderExchangeStatus.CANCELED
		});
		await expect(fixture.service.close('closed')).resolves.toMatchObject({
			status: OrderExchangeStatus.CLOSED
		});

		expect(fixture.tables.order_exchange_line).toHaveLength(outboundBefore);
		expect(fixture.sequenceCalls).toEqual(sequencesBefore);
		expect(fixture.tables.order_exchange.map((row) => row.status)).toEqual([
			OrderExchangeStatus.REJECTED,
			OrderExchangeStatus.CANCELED,
			OrderExchangeStatus.CLOSED
		]);
	});
});

describe('OrderExchangeService — approval requires both halves (doc 10 §12.1, §12.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('approves a two-sided exchange and freezes the difference on it', async () => {
		const fixture = pricedExchange();

		const approved = await fixture.service.approve('exchange-1', 'agreed with the customer');

		expect(approved).toMatchObject({
			status: OrderExchangeStatus.APPROVED,
			differenceDue: '35.480000',
			note: 'agreed with the customer'
		});
		// The quoted number is recorded rather than recomputed, so a later price change cannot restate it.
		expect(fixture.exchange('exchange-1')?.differenceDue).toBe('35.480000');
	});

	it('refuses an exchange with no outbound lines', async () => {
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('exchange-1', { returnId: RETURN })],
			outbound: [],
			inbound: [inboundRow('in-1')]
		});

		await expect(fixture.service.approve('exchange-1')).rejects.toThrow(
			/must have at least one outbound line before it can be approved/
		);
		expect(fixture.exchange('exchange-1')).toMatchObject({ status: OrderExchangeStatus.OPEN });
	});

	it('refuses an exchange with no inbound return, because there is nothing coming back', async () => {
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('exchange-1')],
			outbound: [outboundRow('out-1')]
		});

		await expect(fixture.service.approve('exchange-1')).rejects.toThrow(
			/must have an inbound return before it can be approved/
		);
		expect(fixture.exchange('exchange-1')).toMatchObject({ status: OrderExchangeStatus.OPEN });
	});

	it('refuses an exchange whose return has no lines, because the difference cannot be priced', async () => {
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('exchange-1', { returnId: RETURN })],
			outbound: [outboundRow('out-1')],
			inbound: []
		});

		await expect(fixture.service.approve('exchange-1')).rejects.toThrow(
			/inbound return of this exchange has no lines/
		);
		expect(fixture.exchange('exchange-1')).toMatchObject({ status: OrderExchangeStatus.OPEN });
	});

	it('refuses to approve an exchange that has already been decided', async () => {
		const fixture = pricedExchange({ exchange: { status: OrderExchangeStatus.APPROVED, differenceDue: '1.000000' } });

		await expect(fixture.service.approve('exchange-1')).rejects.toThrow(
			/cannot approve; expected OPEN or REQUESTED/
		);
		expect(fixture.exchange('exchange-1')?.differenceDue).toBe('1.000000');
	});

	it('refuses every transition on an exchange of another organization', async () => {
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('theirs', { organizationId: OTHER_ORG, returnId: RETURN })],
			outbound: [outboundRow('out-1', { exchangeId: 'theirs', organizationId: OTHER_ORG })],
			inbound: [inboundRow('in-1')]
		});

		await expect(fixture.service.approve('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.reject('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.cancel('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.close('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.linkReturn('theirs', RETURN)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('OrderExchangeService — the rest of the lifecycle (doc 10 §12.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('links the inbound return, which is what makes the exchange priceable', async () => {
		const fixture = exchangeFixture({ exchanges: [exchangeRow('exchange-1')], outbound: [outboundRow('out-1')] });

		expect(fixture.exchange('exchange-1')?.returnId).toBeUndefined();

		const linked = await fixture.service.linkReturn('exchange-1', RETURN);

		expect(linked).toMatchObject({ returnId: RETURN });
	});

	it('rejects an exchange that is still decidable and refuses one that is closed', async () => {
		const fixture = exchangeFixture({
			exchanges: [
				exchangeRow('open'),
				exchangeRow('approved', { status: OrderExchangeStatus.APPROVED }),
				exchangeRow('closed', { status: OrderExchangeStatus.CLOSED })
			]
		});

		await expect(fixture.service.reject('open', 'out of policy')).resolves.toMatchObject({
			status: OrderExchangeStatus.REJECTED,
			note: 'out of policy'
		});
		await expect(fixture.service.reject('approved')).resolves.toMatchObject({
			status: OrderExchangeStatus.REJECTED
		});
		await expect(fixture.service.reject('closed')).rejects.toThrow(
			/cannot reject; expected OPEN or REQUESTED or APPROVED/
		);
	});

	it('cancels an exchange and stamps the withdrawal', async () => {
		const fixture = exchangeFixture({ exchanges: [exchangeRow('open')] });

		const canceled = await fixture.service.cancel('open', 'customer withdrew');

		expect(canceled).toMatchObject({ status: OrderExchangeStatus.CANCELED, note: 'customer withdrew' });
		expect(canceled.canceledAt).toBeInstanceOf(Date);
	});

	it('closes an approved exchange once both halves have settled, and treats a second close as a no-op', async () => {
		const fixture = exchangeFixture({
			exchanges: [exchangeRow('approved', { status: OrderExchangeStatus.APPROVED })]
		});

		const closed = await fixture.service.close('approved', 'both halves settled');

		expect(closed).toMatchObject({ status: OrderExchangeStatus.CLOSED, note: 'both halves settled' });
		await expect(fixture.service.close('approved')).resolves.toMatchObject({
			status: OrderExchangeStatus.CLOSED
		});
	});

	it('refuses to close an exchange that was never approved', async () => {
		const fixture = exchangeFixture({ exchanges: [exchangeRow('open')] });

		await expect(fixture.service.close('open')).rejects.toThrow(/cannot close; expected APPROVED/);
		expect(fixture.exchange('open')).toMatchObject({ status: OrderExchangeStatus.OPEN });
	});

	it('rewrites an exchange’s outbound lines through the service that prices them', async () => {
		const fixture = exchangeFixture({ exchanges: [exchangeRow('exchange-1')], outbound: [] });

		const written = await fixture.service.replaceLines('exchange-1', [
			{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1' }
		]);

		expect(written).toHaveLength(1);
		expect(written[0]).toMatchObject({ variantId: VARIANT, unitPrice: '19.990000' });

		await expect(
			fixture.service.replaceLines('exchange-1', [{ variantId: 'unpriceable', quantity: '1' }])
		).rejects.toThrow(/EXCHANGE_PRICE_UNAVAILABLE/);
	});

	it('reads the exchange’s lines as a caller would see them', async () => {
		const fixture = pricedExchange();

		expect((await fixture.service.findLines('exchange-1')).map((line) => line.id)).toEqual(['out-1']);
	});

	it('reads a detailed exchange, and refuses one that is not the caller’s', async () => {
		const fixture = pricedExchange();

		await expect(fixture.service.findOneDetailed('exchange-1')).resolves.toMatchObject({ id: 'exchange-1' });
		await expect(fixture.service.findOneDetailed('no-such-exchange')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * A control for the arithmetic the difference is computed with: the money layer refuses to combine two
 * currencies, so an exchange priced in one currency is the whole of what this domain can state.
 */
describe('OrderExchangeService — one currency per exchange', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prices the difference in the exchange’s own currency, by the documented formula', async () => {
		const fixture = pricedExchange({ exchange: { currency: 'JPY' } });

		// Doc 10 §12.5: `exchangeCharge = round(unitPrice × quantity)`, the return credit is the returned
		// units' own value, and `differenceDue = Σ exchangeCharge − Σ returnCredit`. A JPY exchange has no
		// minor unit, so the outbound half is valued at that scale first — 2 × 19.99 is 40 — the inbound
		// half is carried exactly (4.50), and the difference crosses its one boundary at the end: 36.
		expect(await fixture.service.computeDifference(fixture.exchange('exchange-1') as never)).toBe('36.000000');
		await expect(fixture.service.approve('exchange-1')).resolves.toMatchObject({ differenceDue: '36.000000' });
	});
});
