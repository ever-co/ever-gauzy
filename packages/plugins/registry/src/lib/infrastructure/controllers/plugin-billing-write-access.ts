import { ID, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PluginBillingService } from '../../domain/services/plugin-billing.service';
import { PluginService } from '../../domain/services/plugin.service';
import { IPluginSubscription } from '../../shared/models';

/**
 * Who may write a plugin bill through `/plugins/:pluginId/subscriptions/:subscriptionId/billings`.
 *
 * A bill is what the subscriber owes the plugin's publisher. Marking it paid, failed or changing its amount is
 * the payment handling's job (it calls the billing service directly, not these routes), and besides it only the
 * plugin's publisher and the operator of the installation may do it (owner decision, 2026-10-22). The subscriber's
 * admins read their bills and pay them; they may not mark one paid. Before, `PLUGIN_RESTRICT`, which every tenant's
 * admins hold, was enough to `PATCH :id {"status":"paid"}` on the subscriber's own bill.
 *
 * The operator is a super admin listed by user id in `EVER_OPERATOR_USER_IDS` (comma separated), the list the
 * ever-instance plugin's operator check reads first. Without the list, nobody is the operator here: the publisher
 * and the payment handling still write bills.
 */
export const OPERATOR_USER_IDS_ENV = 'EVER_OPERATOR_USER_IDS';

/**
 * Whether the signed-in user operates this installation: listed in `EVER_OPERATOR_USER_IDS`, and a super admin now.
 *
 * @param env - The environment to read, the process's by default.
 */
export function isInstallationOperator(env: Record<string, string | undefined> = process.env): boolean {
	const listed = (env[OPERATOR_USER_IDS_ENV] ?? '')
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter((id) => id.length > 0);
	const userId = RequestContext.currentUserId();

	return (
		typeof userId === 'string' &&
		listed.includes(userId.toLowerCase()) &&
		RequestContext.hasRole(RolesEnum.SUPER_ADMIN)
	);
}

/**
 * Refuses a bill write unless the caller published the plugin the route names or operates the installation, then
 * reads the subscription the route names, in whichever tenant holds it (a publisher sells to every tenant).
 *
 * The caller's standing is checked first, so a refused caller learns nothing about which subscriptions exist.
 *
 * @param billingService - Reads the subscription.
 * @param pluginService - Answers who published the plugin.
 * @param pluginId - The plugin the route names.
 * @param subscriptionId - The subscription the route names.
 * @returns The subscription, which belongs to that plugin.
 * @throws ForbiddenException with `PLUGIN_BILLING_WRITE_FORBIDDEN` for anyone else.
 * @throws NotFoundException when the subscription is missing or belongs to another plugin.
 */
export async function resolveBillingWriteAccess(
	billingService: PluginBillingService,
	pluginService: PluginService,
	pluginId: ID,
	subscriptionId: ID
): Promise<IPluginSubscription> {
	const userId = RequestContext.currentUserId();
	const publisher = !!userId && (await pluginService.validatePluginOwnership(pluginId, userId));

	if (!publisher && !isInstallationOperator()) {
		throw new ForbiddenException({
			message:
				"PLUGIN_BILLING_WRITE_FORBIDDEN: a plugin's bills are written by its payment handling, its publisher or the installation's operator.",
			code: 'PLUGIN_BILLING_WRITE_FORBIDDEN'
		});
	}

	const subscription = await billingService.findSubscriptionInAnyTenant(subscriptionId);
	if (!subscription || subscription.pluginId !== pluginId) {
		throw new NotFoundException(`Plugin subscription with ID ${subscriptionId} not found`);
	}

	return subscription;
}
