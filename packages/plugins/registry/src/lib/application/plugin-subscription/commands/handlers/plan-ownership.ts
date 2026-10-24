import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PluginService, PluginSubscriptionPlanService } from '../../../../domain';

/**
 * Subscription plans belong to a plugin of the registry, which every tenant shares, and the registry services
 * scope nothing to a tenant. `PLUGIN_CONFIGURE`, which the plan routes check, is a default permission of every
 * tenant's admins, so it is no claim on somebody else's plugin: a plan may only be created, changed, copied or
 * deleted by the user who published its plugin (`uploadedById`, as `PluginOwnerGuard` checks for its versions
 * and sources). Without that, any tenant admin could price another publisher's paid plan at 0, deactivate or
 * delete it, or attach a free plan to it, and then subscribe for free.
 *
 * @param pluginService Answers who owns a plugin.
 * @param pluginId The plugin whose plans are managed.
 * @throws ForbiddenException when the signed-in user does not own the plugin.
 * @throws NotFoundException when the plugin does not exist.
 */
export async function assertOwnsPlugin(pluginService: PluginService, pluginId: ID): Promise<void> {
	const userId = RequestContext.currentUserId();
	if (!pluginId || !userId || !(await pluginService.validatePluginOwnership(pluginId, userId))) {
		throw new ForbiddenException('Only the owner of this plugin may manage its subscription plans.');
	}
}

/**
 * Refuses unless the signed-in user owns the plugin of every one of these plans.
 *
 * @param pluginService Answers who owns a plugin.
 * @param planService Reads the plans.
 * @param planIds The plans to manage.
 * @throws NotFoundException when a plan does not exist.
 * @throws ForbiddenException when the user does not own the plugin of one of them.
 */
export async function assertOwnsPlans(
	pluginService: PluginService,
	planService: PluginSubscriptionPlanService,
	planIds: ID[]
): Promise<void> {
	const pluginIds = new Set<ID>();
	for (const planId of new Set(planIds)) {
		const { success, record } = await planService.findOneOrFailByIdString(planId);
		if (!success || !record) {
			throw new NotFoundException(`Subscription plan with ID ${planId} not found`);
		}
		pluginIds.add(record.pluginId);
	}
	for (const pluginId of pluginIds) {
		await assertOwnsPlugin(pluginService, pluginId);
	}
}
