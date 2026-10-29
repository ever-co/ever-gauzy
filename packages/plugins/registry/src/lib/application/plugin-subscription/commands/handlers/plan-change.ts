import { ID, PluginSubscriptionType } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';
import { IPluginSubscription, IPluginSubscriptionPlan } from '../../../../shared';

/** Answered when a plan change would raise what the subscriber pays without a payment. */
export const PLAN_CHANGE_NEEDS_PAYMENT =
	'This plan costs more than your current one. A plan change that costs more is not available yet: ask the plugin publisher.';

/**
 * Checks a plan change (`POST :id/upgrade` / `POST :id/downgrade`) before it is applied.
 *
 * - The subscription must belong to the plugin the route names (when it names one): otherwise it is not found.
 * - The new plan must exist, be active and belong to the subscription's plugin. Without that check a subscriber could
 *   move onto any plan of any plugin, a paid one included.
 * - The change must not raise what the subscriber pays, because the plugin registry takes no payment for a plan
 *   change (its payment gateway is not integrated): a subscriber may move to a free plan, or to a plan that costs no
 *   more than the current one in the same currency and billing period. The plugin's publisher, who may already set a
 *   subscription's status and dates to grant trials or comps, may move a subscriber to any plan of the plugin.
 *
 * @param planService - Reads the plans.
 * @param pluginService - Answers who published a plugin.
 * @param subscription - The subscription, with its current `plan`.
 * @param newPlanId - The plan to move to.
 * @param pluginId - The plugin the route names, if any.
 * @returns The new plan.
 * @throws NotFoundException when the subscription belongs to another plugin than the route's.
 * @throws BadRequestException when the plan is missing, inactive or another plugin's.
 * @throws HttpException 402 when the change would cost more and the caller is not the publisher.
 */
export async function assertPlanChangeAllowed(
	planService: PluginSubscriptionPlanService,
	pluginService: PluginService,
	subscription: IPluginSubscription,
	newPlanId: ID,
	pluginId?: ID
): Promise<IPluginSubscriptionPlan> {
	if (pluginId && subscription.pluginId !== pluginId) {
		throw new NotFoundException(`Plugin subscription with ID ${subscription.id} not found or access denied`);
	}

	const { success, record: plan } = newPlanId
		? await planService.findOneOrFailByIdString(newPlanId)
		: { success: false, record: null };
	if (!success || !plan || plan.isActive === false) {
		throw new BadRequestException('The subscription plan is not available.');
	}
	if (plan.pluginId !== subscription.pluginId) {
		throw new BadRequestException('The subscription plan does not belong to this plugin.');
	}

	if (isFreePlan(plan) || costsNoMore(plan, subscription.plan)) {
		return plan;
	}

	const userId = RequestContext.currentUserId();
	if (userId && (await pluginService.validatePluginOwnership(subscription.pluginId, userId))) {
		return plan;
	}

	throw new HttpException(PLAN_CHANGE_NEEDS_PAYMENT, HttpStatus.PAYMENT_REQUIRED);
}

/** What the price comparison reads of a plan (the registry's plan, or the contracts' one a subscription carries). */
type PricedPlan = Pick<IPluginSubscriptionPlan, 'type' | 'price' | 'currency' | 'billingPeriod'>;

/** A plan that costs nothing (the entity's `isFree`, read from its fields so plain objects work too). */
function isFreePlan(plan: PricedPlan): boolean {
	return plan.type === PluginSubscriptionType.FREE || Number(plan.price) === 0;
}

/** Whether `next` costs no more than `current`, comparable only in the same currency and billing period. */
function costsNoMore(next: PricedPlan, current?: PricedPlan | null): boolean {
	if (!current || isFreePlan(current)) {
		return false;
	}
	return (
		next.currency === current.currency &&
		next.billingPeriod === current.billingPeriod &&
		Number(next.price) <= Number(current.price)
	);
}
