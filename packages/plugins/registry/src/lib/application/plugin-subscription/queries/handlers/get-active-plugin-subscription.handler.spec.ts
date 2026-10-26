// The registry's barrels drag in the entity graph; the handler only needs the service it reads through.
jest.mock('../../../../domain', () => ({ PluginSubscriptionService: class PluginSubscriptionService {} }));
jest.mock('../../../../shared', () => ({}));

import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { NotFoundException } from '@nestjs/common';
import { GetActivePluginSubscriptionQuery } from '../get-active-plugin-subscription.query';
import { GetActivePluginSubscriptionQueryHandler } from './get-active-plugin-subscription.handler';

/**
 * `GET /plugins/:pluginId/subscriptions/me`: the marketplace asks it for every plugin card, so "no subscription" is an
 * answer (`null`), not a `404` that the desktop apps' error interceptor would retry and toast once per card.
 */
describe("the signed-in user's own subscription to a plugin", () => {
	function handlerReading(found: { success: boolean; record?: unknown; error?: unknown }) {
		const service = { findOneOrFailByOptions: jest.fn(async () => found) };
		return { service, handler: new GetActivePluginSubscriptionQueryHandler(service as any) };
	}

	const query = new GetActivePluginSubscriptionQuery('plugin-1', 'tenant-1', 'organization-1', 'user-1');

	it('answers null, not a 404, when the user has no active subscription', async () => {
		const { service, handler } = handlerReading({ success: false, error: new NotFoundException() });

		await expect(handler.execute(query)).resolves.toBeNull();
		expect(service.findOneOrFailByOptions).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					pluginId: 'plugin-1',
					tenantId: 'tenant-1',
					organizationId: 'organization-1',
					subscriberId: 'user-1'
				})
			})
		);
	});

	it('answers the subscription when the user has one', async () => {
		const subscription = { id: 'subscription-1', status: PluginSubscriptionStatus.ACTIVE, isExpired: false };
		const { handler } = handlerReading({ success: true, record: subscription });

		await expect(handler.execute(query)).resolves.toBe(subscription);
	});

	it('answers null for an expired subscription, as before', async () => {
		const { handler } = handlerReading({
			success: true,
			record: { id: 'subscription-1', status: PluginSubscriptionStatus.ACTIVE, isExpired: true }
		});

		await expect(handler.execute(query)).resolves.toBeNull();
	});
});
