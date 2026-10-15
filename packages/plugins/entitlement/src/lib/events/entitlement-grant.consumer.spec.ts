/**
 * What the entitlement consumer does with a subscription's cancellation.
 *
 * The consumer is the real one. `@gauzy/core` is doubled at the module boundary, as the package's other
 * suites do, and so is the entitlement service it writes through: what is under test is the decision the
 * consumer takes from the payload, which is `SubscriptionService.cancel`'s — the subscription package's
 * own suite hands this consumer the payload that service actually appends.
 */
jest.mock('@gauzy/core', () => ({
	EventConsumerRegistry: class EventConsumerRegistry {}
}));

jest.mock('../entitlement/entitlement.service', () => ({
	EntitlementService: class EntitlementService {}
}));

import { IEventEnvelope } from '@gauzy/contracts';
import { EntitlementRevocationReason } from '../entitlement.types';
import { EntitlementGrantConsumer } from './entitlement-grant.consumer';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000010';

/**
 * @param data The payload, in the shape `SubscriptionService.cancel` appends it.
 * @returns The revocations the consumer made, and the subscriptions it looked rights up for.
 */
async function cancel(data: Record<string, unknown>) {
	const revoked: unknown[][] = [];
	const lookedUp: unknown[] = [];
	const entitlementService = {
		find: async (options: { where: Record<string, unknown> }) => {
			lookedUp.push(options.where);

			return [{ id: 'entitlement-1' }, { id: 'entitlement-2' }];
		},
		revoke: async (...args: unknown[]) => {
			revoked.push(args);
		}
	};
	const event = {
		id: 'event-1',
		name: 'subscription.canceled',
		tenantId: TENANT,
		organizationId: ORG,
		aggregate: { type: 'SUBSCRIPTION', id: SUBSCRIPTION },
		data
	} as unknown as IEventEnvelope;

	await new EntitlementGrantConsumer(entitlementService as never).handle(event, {
		assertOrder: async () => undefined,
		alreadyDelivered: async () => false
	} as never);

	return { revoked, lookedUp };
}

describe('EntitlementGrantConsumer — subscription.canceled', () => {
	it('withdraws every right of a subscription cancelled with immediate effect, with no credit stated', async () => {
		const { revoked, lookedUp } = await cancel({
			subscriptionId: SUBSCRIPTION,
			canceledAt: '2026-03-16T00:00:00.000Z',
			cancelReason: 'customer left',
			immediate: true,
			creditAmount: null
		});

		expect(lookedUp).toEqual([{ subscriptionId: SUBSCRIPTION, tenantId: TENANT, organizationId: ORG }]);
		expect(revoked).toEqual([
			[
				'entitlement-1',
				EntitlementRevocationReason.SUBSCRIPTION_ENDED,
				{ tenantId: TENANT, organizationId: ORG }
			],
			['entitlement-2', EntitlementRevocationReason.SUBSCRIPTION_ENDED, { tenantId: TENANT, organizationId: ORG }]
		]);
	});

	it('withdraws them as well when a credit is given back', async () => {
		const { revoked } = await cancel({ subscriptionId: SUBSCRIPTION, immediate: true, creditAmount: '40.000000' });

		expect(revoked).toHaveLength(2);
	});

	it('leaves the rights of a subscription that runs to the end of its paid period', async () => {
		const { revoked, lookedUp } = await cancel({
			subscriptionId: SUBSCRIPTION,
			immediate: false,
			creditAmount: null
		});

		expect(revoked).toEqual([]);
		expect(lookedUp).toEqual([]);
	});
});
