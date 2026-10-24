import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { NotFoundException } from '@nestjs/common';
import { PluginService, PluginSubscriptionService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription } from '../../../../shared';

/**
 * Who may change what on a plugin subscription through `PATCH` / `PUT /plugins/:pluginId/subscriptions/:id`.
 *
 * A subscription's status, dates and plan are what its subscriber paid for. The checkout and the payment handling
 * set them on the server (purchase, renewal, payment failure), and the plugin's publisher may set the status and the
 * dates too, to grant a trial or a free period to a subscriber. `PLUGIN_CONFIGURE`, which the routes check, is a
 * default permission of every tenant's admins, so it is no claim on billing state: before, a subscriber's admin could
 * `PUT {"status":"active","endDate":"2099-01-01"}` on a pending paid subscription, or `PATCH {"status":"renewed"}`
 * to extend it, and use the plugin without paying.
 */

/** What the subscriber's tenant may change with `PLUGIN_CONFIGURE`: its own settings, no billing state. */
export const SUBSCRIBER_FIELDS = ['autoRenew', 'metadata'] as const;

/** What the plugin's publisher may change, on a subscription of any tenant: the status and the dates. */
export const PUBLISHER_FIELDS = ['status', 'startDate', 'endDate', 'trialEndDate'] as const;

/** Metadata the server keeps for billing (renewals, payment failures); a subscriber's write does not replace it. */
export const SERVER_METADATA_KEYS = ['renewalCount', 'paymentFailureCount'] as const;

/** A subscription and the caller's standing on it. */
export interface SubscriptionWriteAccess {
	subscription: PluginSubscription;
	/** The subscription is in the caller's tenant: the scoped read found it. */
	subscriber: boolean;
	/** The caller published the subscription's plugin. */
	publisher: boolean;
}

/**
 * Reads the subscription a write names and the caller's standing on it.
 *
 * The caller's own tenant is read first, through the scoped service. A subscription of another tenant is reached
 * only by the publisher of its plugin, who sells to every tenant; to anyone else it is the same `404` as a missing id.
 *
 * @param subscriptionService - Reads the subscription, scoped and in any tenant.
 * @param pluginService - Answers who published a plugin.
 * @param id - The subscription the route names.
 * @param pluginId - The plugin the route names; a subscription of another plugin is not found.
 * @throws NotFoundException when the subscription is missing, belongs to another plugin, or is out of the caller's reach.
 */
export async function resolveSubscriptionWriteAccess(
	subscriptionService: PluginSubscriptionService,
	pluginService: PluginService,
	id: ID,
	pluginId?: ID
): Promise<SubscriptionWriteAccess> {
	const notFound = () => new NotFoundException(`Plugin subscription with ID ${id} not found or access denied`);
	const scoped = await subscriptionService.findOneOrFailByIdString(id);
	const subscription = scoped.success ? scoped.record : await subscriptionService.findOneInAnyTenant(id);

	if (!subscription || (pluginId && subscription.pluginId !== pluginId)) {
		throw notFound();
	}

	const userId = RequestContext.currentUserId();
	const publisher = !!userId && (await pluginService.validatePluginOwnership(subscription.pluginId, userId));

	if (!scoped.success && !publisher) {
		throw notFound();
	}

	return { subscription, subscriber: scoped.success, publisher };
}

/**
 * The part of a `PATCH` / `PUT` body the caller may write. Every other field is ignored, not refused: a client
 * sending a whole subscription back still gets its settings saved.
 *
 * @param input - The fields the request asks to change.
 * @param access - The stored subscription and the caller's standing on it.
 * @returns The changes to write; empty when the caller may change none of the fields asked for.
 */
export function permittedSubscriptionChanges(
	input: Partial<Record<keyof IPluginSubscription, unknown>>,
	{ subscription, subscriber, publisher }: SubscriptionWriteAccess
): Partial<IPluginSubscription> {
	const fields: readonly string[] = [
		...(subscriber ? SUBSCRIBER_FIELDS : []),
		...(publisher ? PUBLISHER_FIELDS : [])
	];
	const changes: Record<string, unknown> = {};

	for (const field of fields) {
		if (input?.[field] !== undefined) {
			changes[field] = input[field];
		}
	}

	if (changes['metadata'] && typeof changes['metadata'] === 'object') {
		const kept = Object.fromEntries(
			SERVER_METADATA_KEYS.filter((key) => subscription.metadata?.[key] !== undefined).map((key) => [
				key,
				subscription.metadata[key]
			])
		);
		changes['metadata'] = { ...(changes['metadata'] as Record<string, unknown>), ...kept };
	}

	return changes as Partial<IPluginSubscription>;
}

/**
 * Writes the permitted changes: through the scoped service in the caller's own tenant, and in the subscription's
 * own tenant for the publisher of a plugin used in another one.
 *
 * @param subscriptionService - Writes the subscription.
 * @param access - The subscription and the caller's standing on it.
 * @param changes - What {@link permittedSubscriptionChanges} allowed.
 * @returns The subscription as stored afterwards.
 */
export async function writeSubscriptionChanges(
	subscriptionService: PluginSubscriptionService,
	access: SubscriptionWriteAccess,
	changes: Partial<IPluginSubscription>
): Promise<IPluginSubscription> {
	const { subscription, subscriber } = access;
	if (Object.keys(changes).length === 0) {
		return subscription;
	}

	if (subscriber) {
		await subscriptionService.update(subscription.id, changes);
		return subscriptionService.findOneByIdString(subscription.id);
	}

	await subscriptionService.updateInAnyTenant(subscription.id, changes);
	return subscriptionService.findOneInAnyTenant(subscription.id);
}
