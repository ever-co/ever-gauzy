/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a claim service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the services under test are the real
 * ones**: the claim service and the real line service it delegates its lines to, with the platform's
 * real money layer behind them.
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
import { OrderClaimReason, OrderClaimStatus, OrderClaimType } from '../returns.types';
import { OrderClaimLineService } from '../order-claim-line/order-claim-line.service';
import { OrderClaimService } from './order-claim.service';

/**
 * A complaint about a delivered order and the resolution chosen for it.
 *
 * The resolution is what makes a claim a domain rather than a note (doc 10 §12.1):
 *
 * - a `REFUND` claim **settles in money and closes**, because nothing else has to happen once the
 *   refund is written;
 * - a `REPLACE` claim **settles in goods**, so it is approved once there is something to ship — at
 *   least one additional item or a linked exchange — and closed when the replacement has gone out. A
 *   replacement claim with neither is refused, "because approving it would put the claim in a state
 *   where nothing can ever happen next";
 * - either way money never moves from here: the refund is issued through the payment capability's
 *   port, and the amount is normalised at the currency's scale through the platform money layer first.
 *
 * The suite pins those three, the state machine around them, and the two amounts a refund claim can be
 * settled for — the one the caller states and the one the claim was raised with.
 *
 * The service is constructed directly over in-memory tables. The repository doubles state the `where`
 * the services state, because a double that returned every row regardless would make the
 * organization-scope and linked-exchange cases vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const RETURN = '00000000-0000-4000-8000-000000000050';

type Row = Record<string, any>;

interface ITables {
	order_claim: Row[];
	order_claim_line: Row[];
	order_exchange: Row[];
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
			// filters by it. A double that did not would make "write a line and read it straight back"
			// impossible, which is what a set rewrite does.
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

/** One `order_claim` row, as the service reads it. */
const claimRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `CLM-${id}`,
	type: OrderClaimType.REFUND,
	status: OrderClaimStatus.OPEN,
	currency: 'USD',
	...overrides
});

/**
 * Builds the claim service — and the real line service it delegates to — over one in-memory store.
 *
 * @param options.claims The claims the fixture starts with.
 * @param options.lines The claim lines the fixture starts with.
 * @param options.exchanges The exchanges the fixture starts with.
 * @param options.withRefund Whether the payment capability is registered.
 * @param options.refundReturns What the payment capability answers with, when it answers with something
 * other than the amount it was asked for.
 * @param options.numberSeries Whether the organization has a `CLAIM` series.
 */
function claimFixture(
	options: {
		claims?: Row[];
		lines?: Row[];
		exchanges?: Row[];
		withRefund?: boolean;
		refundReturns?: string;
		numberSeries?: boolean;
	} = {}
) {
	const tables: ITables = {
		order_claim: [...(options.claims ?? [claimRow('claim-1')])],
		order_claim_line: [...(options.lines ?? [])],
		order_exchange: [...(options.exchanges ?? [])]
	};
	const typeOrmOrderClaimRepository = repository(tables, 'order_claim');
	const fulfillment = {
		getFulfilledLines: async () => [{ orderLineId: ORDER_LINE, fulfilledQuantity: '3.000000', variantId: VARIANT }]
	};
	const lineService = new OrderClaimLineService(
		repository(tables, 'order_claim_line') as never,
		{} as never,
		typeOrmOrderClaimRepository as never,
		fulfillment as never
	);
	const sequenceCalls: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			sequenceCalls.push(key);

			if (options.numberSeries === false) {
				throw new Error(`no series configured for ${key}`);
			}

			return { formatted: 'CLM-000001', key };
		}
	};
	const refundCalls: Row[] = [];
	const refundGateway =
		options.withRefund === false
			? undefined
			: {
					createRefund: async (request: Row) => {
						refundCalls.push(request);

						return {
							refundId: `refund-${refundCalls.length}`,
							amount: options.refundReturns ?? request.amount,
							currency: request.currency
						};
					}
			  };
	const service = new OrderClaimService(
		typeOrmOrderClaimRepository as never,
		{} as never,
		repository(tables, 'order_exchange') as never,
		lineService,
		sequenceService as never,
		refundGateway as never
	);

	return {
		service,
		tables,
		refundCalls,
		sequenceCalls,
		claim: (id: string) => tables.order_claim.find((row) => row.id === id),
		liveLines: () => tables.order_claim_line.filter((row) => !row.deletedAt)
	};
}

describe('OrderClaimService — raising a claim (doc 10 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises a claim with its number, its type and its lines', async () => {
		const fixture = claimFixture({ claims: [], lines: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			lines: [{ orderLineId: ORDER_LINE, quantity: '1', reason: OrderClaimReason.DAMAGED }]
		} as never);

		expect(created).toMatchObject({
			orderId: ORDER,
			number: 'CLM-000001',
			type: OrderClaimType.REFUND,
			status: OrderClaimStatus.OPEN,
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG,
			refundAmount: undefined
		});
		expect(fixture.sequenceCalls).toEqual(['CLAIM']);
		expect(created.lines).toHaveLength(1);
		expect(created.lines?.[0]).toMatchObject({ claimId: created.id, orderLineId: ORDER_LINE });
	});

	it('keeps the type and the amount a replacement claim was raised with', async () => {
		const fixture = claimFixture({ claims: [], lines: [] });

		const created = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			type: OrderClaimType.REPLACE,
			refundAmount: '12.345',
			lines: [{ variantId: VARIANT, quantity: '1' }]
		} as never);

		expect(created.type).toBe(OrderClaimType.REPLACE);
		// The amount is normalised at the currency's scale on the way in, half-up.
		expect(created.refundAmount).toBe('12.350000');
	});

	it('refuses a claim that names no order, no currency or no line', async () => {
		const fixture = claimFixture({ claims: [], lines: [] });

		await expect(
			fixture.service.create({ currency: 'USD', lines: [{ orderLineId: ORDER_LINE, quantity: '1' }] } as never)
		).rejects.toThrow(/must name the order it is about/);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [{ orderLineId: ORDER_LINE, quantity: '1' }] } as never)
		).rejects.toThrow(/must state the currency/);

		await expect(fixture.service.create({ orderId: ORDER, currency: 'USD' } as never)).rejects.toThrow(
			/at least one line/
		);

		expect(fixture.tables.order_claim).toEqual([]);
		expect(fixture.sequenceCalls).toEqual([]);
	});

	it('tells a zero amount apart from an unstated one', async () => {
		const fixture = claimFixture({ claims: [], lines: [] });

		const withZero = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: 0,
			lines: [{ orderLineId: ORDER_LINE, quantity: '1' }]
		} as never);
		const withNothing = await fixture.service.create({
			orderId: ORDER,
			currency: 'USD',
			refundAmount: null,
			lines: [{ orderLineId: ORDER_LINE, quantity: '1' }]
		} as never);

		expect(withZero.refundAmount).toBe('0.000000');
		expect(withNothing.refundAmount).toBeUndefined();
	});

	it('names the missing numbering series rather than failing generically', async () => {
		const fixture = claimFixture({ claims: [], lines: [], numberSeries: false });

		await expect(
			fixture.service.create({
				orderId: ORDER,
				currency: 'USD',
				lines: [{ orderLineId: ORDER_LINE, quantity: '1' }]
			} as never)
		).rejects.toThrow(/"CLAIM"/);
		expect(fixture.tables.order_claim).toEqual([]);
	});
});

describe('OrderClaimService — a refund claim settles in money (doc 10 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('issues the refund and closes the claim, because nothing else has to happen', async () => {
		const fixture = claimFixture({ lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		const outcome = await fixture.service.approve('claim-1', '25.00', 'goodwill');

		expect(outcome.refund).toMatchObject({ refundId: 'refund-1', amount: '25.000000', currency: 'USD' });
		expect(outcome.claim).toMatchObject({
			status: OrderClaimStatus.CLOSED,
			refundAmount: '25.000000',
			note: 'goodwill'
		});
		expect(fixture.refundCalls[0]).toMatchObject({ orderId: ORDER, currency: 'USD', note: 'goodwill' });
	});

	it('settles for the amount the claim was raised with when the caller states none', async () => {
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { refundAmount: '18.500000' })],
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }]
		});

		const outcome = await fixture.service.approve('claim-1');

		expect(outcome.refund).toMatchObject({ amount: '18.500000' });
		expect(fixture.claim('claim-1')).toMatchObject({ status: OrderClaimStatus.CLOSED, refundAmount: '18.500000' });
	});

	it('refuses a refund claim with no amount at all, and issues nothing', async () => {
		const fixture = claimFixture({ lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		await expect(fixture.service.approve('claim-1')).rejects.toThrow(
			/refund claim needs an amount before it can be settled/
		);
		expect(fixture.refundCalls).toEqual([]);
		expect(fixture.claim('claim-1')).toMatchObject({ status: OrderClaimStatus.OPEN });
	});

	it('refuses a refund when no payment capability is registered', async () => {
		const fixture = claimFixture({
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }],
			withRefund: false
		});

		await expect(fixture.service.approve('claim-1', '25.00')).rejects.toThrow(/CLAIM_REFUND_UNAVAILABLE/);
		expect(fixture.claim('claim-1')).toMatchObject({ status: OrderClaimStatus.OPEN });
	});

	it('refuses an amount that is not positive once it has crossed the currency’s boundary', async () => {
		const fixture = claimFixture({ lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		for (const amount of ['0', '0.004', '-5']) {
			await expect(fixture.service.approve('claim-1', amount)).rejects.toThrow(
				/must be for a positive amount/
			);
		}
		expect(fixture.refundCalls).toEqual([]);

		await expect(fixture.service.approve('claim-1', '0.005')).resolves.toMatchObject({
			refund: { amount: '0.010000' }
		});
	});

	it('normalises the amount it asks the payment capability for', async () => {
		const fixture = claimFixture({ lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		await fixture.service.approve('claim-1', '10.005');

		expect(fixture.refundCalls[0].amount).toBe('10.010000');
	});

	it('names the claim as what the refund is attributed to', async () => {
		// A claim refund is money going back for a damaged or short delivery, and the claim is the only
		// record of why. The payment side treats a claim as attribution on its own — precisely so a
		// refund can be recorded when no captured payment can carry it — and it can only do that if the
		// request names the claim.
		const fixture = claimFixture({ lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		await fixture.service.approve('claim-1', '25.00');

		expect(fixture.refundCalls[0]).toMatchObject({ orderId: ORDER, claimId: 'claim-1' });
	});

	it('records the amount the capability actually refunded, not the one that was requested', async () => {
		// The port documents that the amount refunded "may be less than the amount requested", and what is
		// recorded on the claim is what actually left.
		const fixture = claimFixture({
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE }],
			refundReturns: '20.000000'
		});

		const outcome = await fixture.service.approve('claim-1', '25.00');

		expect(outcome.refund?.amount).toBe('20.000000');
		expect(fixture.claim('claim-1')?.refundAmount).toBe('20.000000');
	});
});

describe('OrderClaimService — a replacement claim settles in goods (doc 10 §12.1, §12.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a replacement with nothing to ship, leaving the claim where it was', async () => {
		// Approving it "would put the claim in a state where nothing can ever happen next": no additional
		// item was asked for and no exchange exists to ship one.
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE })],
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE, isAdditionalItem: false }]
		});

		await expect(fixture.service.approve('claim-1')).rejects.toThrow(
			/must have at least one additional item or a linked exchange/
		);
		expect(fixture.claim('claim-1')).toMatchObject({ status: OrderClaimStatus.OPEN });
	});

	it('approves a replacement that asks for an additional item, and leaves it open for the shipment', async () => {
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE })],
			lines: [
				{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE, isAdditionalItem: false },
				{ id: 'line-2', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', variantId: VARIANT, isAdditionalItem: true }
			]
		});

		const outcome = await fixture.service.approve('claim-1', undefined, 'sending a replacement');

		expect(outcome.refund).toBeUndefined();
		expect(outcome.claim).toMatchObject({ status: OrderClaimStatus.APPROVED, note: 'sending a replacement' });
		expect(fixture.refundCalls).toEqual([]);
	});

	it('approves a replacement whose return is the inbound half of an exchange', async () => {
		// The claim and the exchange are linked through the return rather than to each other, so a claim
		// with no additional item of its own still has something to ship when an exchange brings the
		// replacements in against its return.
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE, returnId: RETURN })],
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE, isAdditionalItem: false }],
			exchanges: [{ id: 'exchange-1', tenantId: TENANT, organizationId: ORG, returnId: RETURN }]
		});

		await expect(fixture.service.approve('claim-1')).resolves.toMatchObject({
			claim: { status: OrderClaimStatus.APPROVED }
		});
	});

	it('does not count an exchange of another organization as the claim’s own', async () => {
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE, returnId: RETURN })],
			lines: [{ id: 'line-1', tenantId: TENANT, organizationId: ORG, claimId: 'claim-1', orderLineId: ORDER_LINE, isAdditionalItem: false }],
			exchanges: [{ id: 'exchange-1', tenantId: TENANT, organizationId: OTHER_ORG, returnId: RETURN }]
		});

		await expect(fixture.service.approve('claim-1')).rejects.toThrow(/at least one additional item or a linked exchange/);
	});

	it('closes an approved replacement once it has been shipped', async () => {
		const fixture = claimFixture({
			claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE, status: OrderClaimStatus.APPROVED })]
		});

		const closed = await fixture.service.close('claim-1', 'replacement delivered');

		expect(closed).toMatchObject({ status: OrderClaimStatus.CLOSED, note: 'replacement delivered' });
	});

	it('closes an already closed claim as a no-op rather than as an error', async () => {
		const fixture = claimFixture({ claims: [claimRow('claim-1', { status: OrderClaimStatus.CLOSED })] });

		await expect(fixture.service.close('claim-1')).resolves.toMatchObject({ status: OrderClaimStatus.CLOSED });
	});

	it('refuses to close a claim that was never approved', async () => {
		const fixture = claimFixture({ claims: [claimRow('claim-1', { status: OrderClaimStatus.OPEN })] });

		await expect(fixture.service.close('claim-1')).rejects.toThrow(/cannot close; expected APPROVED/);
		expect(fixture.claim('claim-1')).toMatchObject({ status: OrderClaimStatus.OPEN });
	});
});

describe('OrderClaimService — the state machine around the decision (doc 10 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to approve a claim that has already been decided', async () => {
		const fixture = claimFixture({
			claims: [
				claimRow('approved', { status: OrderClaimStatus.APPROVED, type: OrderClaimType.REPLACE }),
				claimRow('closed', { status: OrderClaimStatus.CLOSED })
			]
		});

		await expect(fixture.service.approve('approved')).rejects.toThrow(
			/cannot approve; expected OPEN or REQUESTED/
		);
		await expect(fixture.service.approve('closed', '5.00')).rejects.toThrow(
			/cannot approve; expected OPEN or REQUESTED/
		);
		// A refused approval issues no money and moves no status.
		expect(fixture.refundCalls).toEqual([]);
		expect(fixture.claim('closed')).toMatchObject({ status: OrderClaimStatus.CLOSED });
	});

	it('rejects a claim that is still decidable and refuses one that is closed', async () => {
		const fixture = claimFixture({
			claims: [
				claimRow('open'),
				claimRow('approved', { status: OrderClaimStatus.APPROVED }),
				claimRow('closed', { status: OrderClaimStatus.CLOSED })
			]
		});

		await expect(fixture.service.reject('open', 'out of policy')).resolves.toMatchObject({
			status: OrderClaimStatus.REJECTED,
			reason: 'out of policy'
		});
		await expect(fixture.service.reject('approved')).resolves.toMatchObject({
			status: OrderClaimStatus.REJECTED
		});
		await expect(fixture.service.reject('closed')).rejects.toThrow(
			/cannot reject; expected OPEN or REQUESTED or APPROVED/
		);
	});

	it('cancels a claim that is still decidable and stamps the withdrawal', async () => {
		const fixture = claimFixture({ claims: [claimRow('open')] });

		const canceled = await fixture.service.cancel('open', 'customer withdrew');

		expect(canceled).toMatchObject({ status: OrderClaimStatus.CANCELED, reason: 'customer withdrew' });
		expect(canceled.canceledAt).toBeInstanceOf(Date);
	});

	it('refuses every transition on a claim of another organization', async () => {
		const fixture = claimFixture({ claims: [claimRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.approve('theirs', '5.00')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.reject('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.cancel('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.close('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.linkReturn('theirs', RETURN)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('links the return that brings the faulty goods back', async () => {
		const fixture = claimFixture({ claims: [claimRow('claim-1', { type: OrderClaimType.REPLACE })] });

		const linked = await fixture.service.linkReturn('claim-1', RETURN);

		expect(linked).toMatchObject({ returnId: RETURN });
		expect(fixture.claim('claim-1')).toMatchObject({ returnId: RETURN });
	});

	it('rewrites a claim’s lines through the service that owns them', async () => {
		// One writer of claim lines, and the derivation of what each line is about lives in it, so a caller
		// holding the claim edits it without reaching for another service.
		const fixture = claimFixture({ claims: [claimRow('claim-1')], lines: [] });

		const written = await fixture.service.replaceLines('claim-1', [{ variantId: VARIANT, quantity: '1' }]);

		expect(written).toHaveLength(1);
		expect(written[0]).toMatchObject({ variantId: VARIANT, isAdditionalItem: true });

		await expect(
			fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1' }])
		).rejects.toThrow(/not both/);
	});

	it('refuses a line with a non-positive quantity through the same path', async () => {
		const fixture = claimFixture({ claims: [claimRow('claim-1')], lines: [] });

		await expect(fixture.service.replaceLines('claim-1', [{ variantId: VARIANT, quantity: '0' }])).rejects.toThrow(
			/must claim a positive quantity/
		);
		expect(fixture.liveLines()).toEqual([]);
	});
});
