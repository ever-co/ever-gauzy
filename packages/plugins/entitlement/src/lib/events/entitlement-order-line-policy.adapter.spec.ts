/**
 * Entitlements from purchases (Q7-W5): what right an order line grants, and what the grant path does with
 * the `lines` an `order.placed` event now carries.
 *
 * `@gauzy/core` and the entitlement service are doubled at the module boundary, as the package's other
 * suites do: what is under test is the adapter's answer and the consumer's decision from the payload.
 */
jest.mock('@gauzy/core', () => ({
	EventConsumerRegistry: class EventConsumerRegistry {},
	FeatureService: class FeatureService {}
}));

jest.mock('../entitlement/entitlement.service', () => ({
	EntitlementService: class EntitlementService {}
}));

import { IEventEnvelope } from '@gauzy/contracts';
import { EntitlementKind } from '../entitlement.enums';
import { EntitlementRevocationReason } from '../entitlement.types';
import { EntitlementGrantConsumer } from './entitlement-grant.consumer';
import { EntitlementOrderLinePolicyAdapter, policyProblemOf } from './entitlement-order-line-policy.adapter';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000020';

function adapter(enabled: boolean, catalog?: Record<string, Record<string, unknown> | null>) {
	const reads: string[] = [];
	const featureService = { isFeatureEnabled: async () => enabled };
	const port = catalog
		? {
				findVariant: async (id: string) => {
					reads.push(`variant:${id}`);
					return catalog[`variant:${id}`] ?? null;
				},
				findProduct: async (id: string) => {
					reads.push(`product:${id}`);
					return catalog[`product:${id}`] ?? null;
				}
			}
		: undefined;

	return { adapter: new EntitlementOrderLinePolicyAdapter(featureService as never, port as never), reads };
}

describe('EntitlementOrderLinePolicyAdapter', () => {
	it('answers null when FEATURE_ENTITLEMENT is off, so the order announces no lines', async () => {
		const { adapter: subject, reads } = adapter(false, {
			'variant:v1': { id: 'v1', metadata: { entitlement: { kind: 'SEAT' } } }
		});

		await expect(
			subject.policiesFor({
				tenantId: TENANT,
				organizationId: ORG,
				lines: [{ orderLineId: 'l1', variantId: 'v1', quantity: 1 }]
			})
		).resolves.toBeNull();
		expect(reads).toEqual([]);
	});

	it("takes the variant's policy, then the product's, reading each item once", async () => {
		const { adapter: subject, reads } = adapter(true, {
			'variant:v1': { id: 'v1', metadata: { entitlement: { kind: 'SEAT', quantity: 5 } } },
			'variant:v2': { id: 'v2', metadata: {} },
			'product:p2': { id: 'p2', metadata: { entitlement: { kind: 'TERM', endsAt: '2999-01-01T00:00:00.000Z' } } },
			'variant:v3': { id: 'v3' },
			'product:p3': { id: 'p3' }
		});

		const answer = await subject.policiesFor({
			tenantId: TENANT,
			organizationId: ORG,
			lines: [
				{ orderLineId: 'l0', variantId: 'v1', productId: 'p1', quantity: 1 },
				{ orderLineId: 'l1', variantId: 'v1', productId: 'p1', quantity: 2 },
				{ orderLineId: 'l1b', variantId: 'v1', productId: 'p1', quantity: 3 },
				{ orderLineId: 'l2', variantId: 'v2', productId: 'p2', quantity: 1 },
				{ orderLineId: 'l3', variantId: 'v3', productId: 'p3', quantity: 1 }
			]
		});

		expect(answer).toEqual({
			l0: { kind: 'SEAT', quantity: 5 },
			l1: { kind: 'SEAT', quantity: 5 },
			l1b: { kind: 'SEAT', quantity: 5 },
			l2: expect.objectContaining({ kind: 'TERM', endsAt: '2999-01-01T00:00:00.000Z' }),
			l3: null
		});
		// v1 once for three lines.
		expect(reads).toEqual(['variant:v1', 'variant:v2', 'product:p2', 'variant:v3', 'product:p3']);
	});

	it('makes a line with an unusable policy grant nothing, and drops members it does not know', async () => {
		const policyOf = (entitlement: Record<string, unknown>) => ({ metadata: { entitlement } });
		const { adapter: subject } = adapter(true, {
			'variant:bad-kind': policyOf({ kind: 'FOREVER' }),
			'variant:bad-qty': policyOf({ quantity: 0 }),
			'variant:bad-term': policyOf({ startsAt: '2027-01-02', endsAt: '2027-01-01' }),
			'variant:ok': policyOf({ kind: 'USAGE', quantity: 100, tenantId: 'other', note: 'x' })
		});

		const answer = await subject.policiesFor({
			lines: ['bad-kind', 'bad-qty', 'bad-term', 'ok'].map((id) => ({
				orderLineId: id,
				variantId: id,
				quantity: 1
			}))
		});

		expect(answer).toEqual({
			'bad-kind': null,
			'bad-qty': null,
			'bad-term': null,
			ok: { kind: 'USAGE', quantity: 100 }
		});
	});

	it('starts a term that states only its end at the placement, and refuses one whose end has passed', async () => {
		// Greptile on #10914: the grant path started such a term when the event was delivered, so a late delivery put
		// the start after the end and the grant refused the whole event, every other line with it.
		const policyOf = (entitlement: Record<string, unknown>) => ({ metadata: { entitlement } });
		const { adapter: subject } = adapter(true, {
			'variant:past': policyOf({ kind: 'TERM', endsAt: '2020-01-01T00:00:00.000Z' }),
			'variant:future': policyOf({ kind: 'TERM', endsAt: '2999-01-01T00:00:00.000Z' })
		});
		const before = Date.now();

		const answer = await subject.policiesFor({
			lines: [
				{ orderLineId: 'past', variantId: 'past', quantity: 1 },
				{ orderLineId: 'future', variantId: 'future', quantity: 1 }
			]
		});

		expect(answer?.['past']).toBeNull();
		expect(answer?.['future']).toMatchObject({ kind: 'TERM', endsAt: '2999-01-01T00:00:00.000Z' });
		expect(new Date(String(answer?.['future']?.['startsAt'])).getTime()).toBeGreaterThanOrEqual(before);
		expect(policyProblemOf({ endsAt: '2020-01-01T00:00:00.000Z' })).toBe('endsAt has already passed');
	});

	it('accepts every kind the package grants', () => {
		for (const kind of Object.values(EntitlementKind)) {
			expect(policyProblemOf({ kind })).toBeNull();
		}
	});
});

describe('EntitlementGrantConsumer — order.placed lines and order.canceled', () => {
	function consumer() {
		const granted: unknown[][] = [];
		const revoked: unknown[][] = [];
		const entitlementService = {
			grant: async (...args: unknown[]) => {
				granted.push(args);
				return { created: true };
			},
			find: async () => [{ id: 'entitlement-1' }],
			revoke: async (...args: unknown[]) => {
				revoked.push(args);
			}
		};

		return { subject: new EntitlementGrantConsumer(entitlementService as never), granted, revoked };
	}

	const context = { assertOrder: async () => undefined, alreadyDelivered: async () => false } as never;

	function event(name: string, data: Record<string, unknown>): IEventEnvelope {
		return {
			id: 'event-1',
			name,
			tenantId: TENANT,
			organizationId: ORG,
			aggregate: { type: 'ORDER', id: ORDER },
			data
		} as unknown as IEventEnvelope;
	}

	it('grants a PENDING right per line that carries a policy, attributed to the order line', async () => {
		const { subject, granted } = consumer();

		await subject.handle(
			event('order.placed', {
				orderId: ORDER,
				customerId: 'customer-1',
				lines: [
					{
						orderLineId: 'line-1',
						productId: 'p1',
						variantId: 'v1',
						quantity: 2,
						entitlement: { kind: 'SEAT' }
					},
					{ orderLineId: 'line-2', productId: 'p2', variantId: 'v2', quantity: 1 }
				],
				linesTotal: 2,
				linesTruncated: false
			}),
			context
		);

		expect(granted).toHaveLength(1);
		expect(granted[0][0]).toEqual(
			expect.objectContaining({
				customerId: 'customer-1',
				orderId: ORDER,
				orderLineId: 'line-1',
				productId: 'p1',
				variantId: 'v1',
				kind: EntitlementKind.SEAT,
				quantity: 2
			})
		);
		expect(granted[0][1]).toEqual({ tenantId: TENANT, organizationId: ORG });
	});

	it('withdraws the rights of a cancelled order as ORDER_CANCELED', async () => {
		const { subject, revoked } = consumer();

		await subject.handle(event('order.canceled', { orderId: ORDER, reason: 'buyer changed mind' }), context);

		expect(revoked).toEqual([
			['entitlement-1', EntitlementRevocationReason.ORDER_CANCELED, { tenantId: TENANT, organizationId: ORG }]
		]);
	});
});
