/**
 * The `lines` an `order.placed` event carries (Q7-W5): which lines travel, which right each grants, and the
 * snapshot of a catalogue policy onto the line.
 *
 * `@gauzy/core` and the persistence classes are doubled at the module boundary: what is under test is the
 * line service's decision, not the ORM.
 */
jest.mock('@gauzy/core', () => ({
	Money: class Money {},
	RequestContext: { currentTenantId: () => null, currentOrganizationId: () => null, currentUser: () => null },
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor() {}
	},
	addDecimalStrings: () => '0',
	compareDecimalStrings: () => 0
}));
jest.mock('../order/order.entity', () => ({ Order: class Order {} }));
jest.mock('./order-line.entity', () => ({ OrderLine: class OrderLine {} }));
jest.mock('../order/repository/type-orm-order.repository', () => ({ TypeOrmOrderRepository: class {} }));
jest.mock('./repository/type-orm-order-line.repository', () => ({ TypeOrmOrderLineRepository: class {} }));
jest.mock('./repository/mikro-orm-order-line.repository', () => ({ MikroOrmOrderLineRepository: class {} }));

import { ORDER_PLACED_LINES_CAP, placedLinesOf, statedEntitlementOf } from './order-line-entitlement';
import { OrderLineService } from './order-line.service';

const ORDER = { id: 'order-1', tenantId: 'tenant-1', organizationId: 'org-1' };

function line(id: string, metadata?: Record<string, unknown>) {
	return { id, productId: `p-${id}`, variantId: `v-${id}`, quantity: 2, metadata } as never;
}

function service(port?: { policiesFor: (query: any) => Promise<any> }) {
	const updates: unknown[][] = [];
	const subject = new OrderLineService({} as never, {} as never, {} as never, port as never);

	(subject as any).update = async (...args: unknown[]) => {
		updates.push(args);
	};

	return { subject, updates };
}

describe('placedLinesOf', () => {
	it('carries every line, with the policy of the lines that grant one', () => {
		expect(placedLinesOf([line('a'), line('b')] as never, { a: { kind: 'SEAT' }, b: null })).toEqual({
			lines: [
				{ orderLineId: 'a', productId: 'p-a', variantId: 'v-a', quantity: 2, entitlement: { kind: 'SEAT' } },
				{ orderLineId: 'b', productId: 'p-b', variantId: 'v-b', quantity: 2 }
			],
			linesTotal: 2,
			linesTruncated: false
		});
	});

	it('never drops a granting line to respect the cap; the lines that grant nothing fill what is left', () => {
		const lines = ['a', 'b', 'c', 'd'].map((id) => line(id));
		const projected = placedLinesOf(lines as never, { c: { kind: 'LICENCE' }, d: { kind: 'SEAT' } }, 3);

		expect(projected.lines.map((entry) => entry.orderLineId)).toEqual(['a', 'c', 'd']);
		expect(projected.linesTotal).toBe(4);
		expect(projected.linesTruncated).toBe(true);
		expect(ORDER_PLACED_LINES_CAP).toBeGreaterThan(0);
	});

	it('reads a stated policy only when it is an object', () => {
		expect(statedEntitlementOf({ entitlement: { kind: 'SEAT' } })).toEqual({ kind: 'SEAT' });
		expect(statedEntitlementOf({ entitlement: ['SEAT'] })).toBeNull();
		expect(statedEntitlementOf({ entitlement: 'SEAT' })).toBeNull();
		expect(statedEntitlementOf(undefined)).toBeNull();
	});
});

describe('OrderLineService.placedLinesFor', () => {
	it('announces no lines when the port is unbound', async () => {
		const { subject } = service();

		await expect(subject.placedLinesFor(ORDER, [line('a')])).resolves.toBeUndefined();
	});

	it('announces no lines when the capability is off for the order', async () => {
		const { subject } = service({ policiesFor: async () => null });

		await expect(subject.placedLinesFor(ORDER, [line('a')])).resolves.toBeUndefined();
	});

	it('announces no lines, and does not fail the placement, when the port throws', async () => {
		const { subject } = service({
			policiesFor: async () => {
				throw new Error('catalogue down');
			}
		});

		await expect(subject.placedLinesFor(ORDER, [line('a')])).resolves.toBeUndefined();
	});

	it("asks with the order's scope and the stated policies, snapshots a catalogue policy onto its line, and projects", async () => {
		const queries: any[] = [];
		const { subject, updates } = service({
			policiesFor: async (query) => {
				queries.push(query);
				return { a: { kind: 'LICENCE' }, b: { kind: 'SEAT', quantity: 3 }, c: null };
			}
		});

		const projected = await subject.placedLinesFor(ORDER, [
			line('a', { entitlement: { kind: 'LICENCE' }, cartLineId: 'cl-a' }),
			line('b', { cartLineId: 'cl-b' }),
			line('c')
		]);

		expect(queries).toEqual([
			{
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				lines: [
					{ orderLineId: 'a', productId: 'p-a', variantId: 'v-a', quantity: 2, stated: { kind: 'LICENCE' } },
					{ orderLineId: 'b', productId: 'p-b', variantId: 'v-b', quantity: 2, stated: null },
					{ orderLineId: 'c', productId: 'p-c', variantId: 'v-c', quantity: 2, stated: null }
				]
			}
		]);
		// Only the line whose policy came from the catalogue is written; its other metadata is kept.
		expect(updates).toEqual([
			['b', { metadata: { cartLineId: 'cl-b', entitlement: { kind: 'SEAT', quantity: 3 } } }]
		]);
		expect(projected).toEqual({
			lines: [
				{ orderLineId: 'a', productId: 'p-a', variantId: 'v-a', quantity: 2, entitlement: { kind: 'LICENCE' } },
				{
					orderLineId: 'b',
					productId: 'p-b',
					variantId: 'v-b',
					quantity: 2,
					entitlement: { kind: 'SEAT', quantity: 3 }
				},
				{ orderLineId: 'c', productId: 'p-c', variantId: 'v-c', quantity: 2 }
			],
			linesTotal: 3,
			linesTruncated: false
		});
	});

	it('still announces the policy when its snapshot cannot be written', async () => {
		const { subject } = service({ policiesFor: async () => ({ a: { kind: 'SEAT' } }) });

		(subject as any).update = async () => {
			throw new Error('no tenant');
		};

		await expect(subject.placedLinesFor(ORDER, [line('a')])).resolves.toEqual(
			expect.objectContaining({
				lines: [expect.objectContaining({ orderLineId: 'a', entitlement: { kind: 'SEAT' } })]
			})
		);
	});
});
