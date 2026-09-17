/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a line service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**.
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
import { OrderClaimReason, OrderClaimStatus } from '../returns.types';
import { OrderClaimLineService } from './order-claim-line.service';

/**
 * The lines of a claim.
 *
 * A claim line is not a return line. It may point at an order line — something the customer says was
 * wrong with what they received — or stand on its own as an additional item, a replacement part that
 * was never ordered. Doc 10 §12.1 states the two shapes the entity records:
 *
 * > A line with `orderLineId` set and `isAdditionalItem = false` describes the defective or missing
 * > original unit; a line with `variantId` set and `isAdditionalItem = true` describes a replacement
 * > unit to be shipped.
 *
 * The rule this suite pins is that the two are **derived from what the line names**, never trusted
 * from a flag: a caller that sends both, or neither, or a flag that contradicts what it named, is
 * refused rather than recorded as something the domain cannot act on. The second rule is the ceiling
 * a return also has — a customer cannot claim about an item that never shipped.
 *
 * The service is constructed directly with in-memory doubles of its repositories.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';

type Row = Record<string, any>;

interface ITables {
	order_claim: Row[];
	order_claim_line: Row[];
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

/** One `order_claim` row, as the service reads it. */
const claimRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `CLM-${id}`,
	type: 'REFUND',
	status: OrderClaimStatus.OPEN,
	currency: 'USD',
	...overrides
});

/**
 * Builds the claim-line service over in-memory tables and one order capability.
 *
 * @param options.claims The claims the fixture starts with.
 * @param options.lines The claim lines the fixture starts with.
 * @param options.fulfilled What the order domain reports as fulfilled.
 * @param options.withFulfillment Whether the order capability is registered.
 */
function claimLineFixture(
	options: {
		claims?: Row[];
		lines?: Row[];
		fulfilled?: Array<{ orderLineId: string; fulfilledQuantity: string; variantId?: string }>;
		withFulfillment?: boolean;
	} = {}
) {
	const tables: ITables = {
		order_claim: [...(options.claims ?? [claimRow('claim-1')])],
		order_claim_line: [...(options.lines ?? [])]
	};
	const fulfillment =
		options.withFulfillment === false
			? undefined
			: {
					getFulfilledLines: async () =>
						options.fulfilled ?? [
							{ orderLineId: ORDER_LINE, fulfilledQuantity: '3.000000', variantId: VARIANT }
						]
			  };
	const service = new OrderClaimLineService(
		repository(tables, 'order_claim_line') as never,
		{} as never,
		repository(tables, 'order_claim') as never,
		fulfillment as never
	);

	return {
		service,
		tables,
		live: () => tables.order_claim_line.filter((row) => !row.deletedAt),
		line: (id: string) => tables.order_claim_line.find((row) => row.id === id)
	};
}

describe('OrderClaimLineService — what a claimed line is about (doc 10 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records an original unit as a claim about the order line, and a replacement as an additional item', async () => {
		const fixture = claimLineFixture();

		const written = await fixture.service.replaceLines('claim-1', [
			{ orderLineId: ORDER_LINE, quantity: '1', reason: OrderClaimReason.DAMAGED },
			{ variantId: VARIANT, quantity: '1', reason: OrderClaimReason.WRONG_ITEM }
		]);

		expect(written[0]).toMatchObject({
			claimId: 'claim-1',
			orderLineId: ORDER_LINE,
			isAdditionalItem: false,
			reason: OrderClaimReason.DAMAGED
		});
		expect(written[1]).toMatchObject({
			claimId: 'claim-1',
			variantId: VARIANT,
			isAdditionalItem: true,
			reason: OrderClaimReason.WRONG_ITEM
		});
	});

	it('derives the flag from what the line names rather than trusting the one it was sent', async () => {
		// The two shapes select different resolution paths — a replacement is reserved and shipped, an
		// original unit is examined — so a flag that contradicts what the line names would send the claim
		// down the wrong one.
		const fixture = claimLineFixture();

		const [aboutTheOrder] = await fixture.service.replaceLines('claim-1', [
			{ orderLineId: ORDER_LINE, quantity: '1', isAdditionalItem: true }
		]);

		expect(aboutTheOrder.isAdditionalItem).toBe(false);

		const [replacement] = await fixture.service.replaceLines('claim-1', [
			{ variantId: VARIANT, quantity: '1', isAdditionalItem: false }
		]);

		expect(replacement.isAdditionalItem).toBe(true);
	});

	it('refuses a line that names both an order line and a replacement variant', async () => {
		const fixture = claimLineFixture();

		await expect(
			fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, variantId: VARIANT, quantity: '1' }])
		).rejects.toThrow(/not both/);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses a line that names neither', async () => {
		const fixture = claimLineFixture();

		await expect(fixture.service.replaceLines('claim-1', [{ quantity: '1' }])).rejects.toThrow(
			/must name the order line it is about, or the additional variant it asks for/
		);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses a line claiming no quantity at all', async () => {
		// A claim of nothing is not a claim; zero and a negative both mean the resolution would ship or
		// refund nothing.
		const fixture = claimLineFixture();

		for (const quantity of ['0', '-1', '0.0000004']) {
			await expect(
				fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, quantity }])
			).rejects.toThrow(/must claim a positive quantity/);
		}
		expect(fixture.live()).toEqual([]);
	});

	it('defaults an unstated reason to the catch-all, and normalises the quantity', async () => {
		// `OTHER` is the value the enum documents as "anything not covered; requires a note", which is the
		// only honest default when the caller named nothing.
		const fixture = claimLineFixture();

		const [written] = await fixture.service.replaceLines('claim-1', [
			{ orderLineId: ORDER_LINE, quantity: '1.0000005', note: 'housing cracked' }
		]);

		expect(written).toMatchObject({
			reason: OrderClaimReason.OTHER,
			quantity: '1.000001',
			note: 'housing cracked'
		});
	});

	it('replaces the line set rather than adding to it', async () => {
		const fixture = claimLineFixture({ lines: [{ id: 'stale', claimId: 'claim-1', orderLineId: ORDER_LINE }] });

		const written = await fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, quantity: '2' }]);

		expect(written).toHaveLength(1);
		expect(fixture.line('stale')?.deletedAt).toBeInstanceOf(Date);
		expect(fixture.live()).toHaveLength(1);
	});

	it('refuses to rewrite the lines of a claim that has been decided', async () => {
		const fixture = claimLineFixture({
			claims: [claimRow('claim-1', { status: OrderClaimStatus.APPROVED })],
			lines: [{ id: 'line-1', claimId: 'claim-1', orderLineId: ORDER_LINE }]
		});

		await expect(
			fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/cannot be changed; only an open or requested claim can be edited/);
		expect(fixture.line('line-1')?.deletedAt).toBeUndefined();
	});

	it('refuses an empty line set, and a claim of another organization', async () => {
		const fixture = claimLineFixture({
			claims: [claimRow('mine'), claimRow('theirs', { organizationId: OTHER_ORG })]
		});

		await expect(fixture.service.replaceLines('mine', [])).rejects.toThrow(/at least one line/);
		await expect(
			fixture.service.replaceLines('theirs', [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.live()).toEqual([]);
	});
});

describe('OrderClaimLineService — a claim is about something that shipped (doc 10 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a claim about an order line that was never fulfilled', async () => {
		const fixture = claimLineFixture();

		await expect(
			fixture.service.replaceLines('claim-1', [{ orderLineId: 'never-shipped', quantity: '1' }])
		).rejects.toThrow(/was not fulfilled on this order, so it cannot be claimed/);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses to validate a claim about an order line with no order capability registered', async () => {
		// Without the order domain there is nothing to check the claim against, so the write is refused
		// rather than accepted unchecked.
		const fixture = claimLineFixture({ withFulfillment: false });

		await expect(
			fixture.service.replaceLines('claim-1', [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/CLAIM_FULFILLMENT_UNAVAILABLE/);
		expect(fixture.live()).toEqual([]);
	});

	it('accepts an additional item with no order capability at all, because nothing has to be checked', async () => {
		// A replacement part that was never ordered is not a claim about the order, so the ceiling does
		// not apply to it and the order domain is never consulted.
		const fixture = claimLineFixture({ withFulfillment: false });

		const written = await fixture.service.replaceLines('claim-1', [{ variantId: VARIANT, quantity: '1' }]);

		expect(written[0]).toMatchObject({ variantId: VARIANT, isAdditionalItem: true });
	});

	it('checks every order line the set names, not only the first', async () => {
		const fixture = claimLineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '3.000000', variantId: VARIANT }]
		});

		await expect(
			fixture.service.replaceLines('claim-1', [
				{ orderLineId: ORDER_LINE, quantity: '1' },
				{ orderLineId: 'never-shipped', quantity: '1' }
			])
		).rejects.toThrow(/was not fulfilled on this order/);
		// All-or-nothing: the first line is not written when the second is refused.
		expect(fixture.live()).toEqual([]);
	});

	it('reads a claim’s lines inside the caller’s organization only, oldest first', async () => {
		const fixture = claimLineFixture({
			lines: [
				{ id: 'line-1', claimId: 'claim-1', tenantId: TENANT, organizationId: ORG, createdAt: '2026-01-01T00:00:01.000Z' },
				{ id: 'line-2', claimId: 'claim-1', tenantId: TENANT, organizationId: ORG, createdAt: '2026-01-01T00:00:02.000Z' },
				{ id: 'line-3', claimId: 'claim-1', tenantId: TENANT, organizationId: OTHER_ORG }
			]
		});

		expect((await fixture.service.findForClaim('claim-1')).map((line) => line.id)).toEqual(['line-1', 'line-2']);
	});
});
