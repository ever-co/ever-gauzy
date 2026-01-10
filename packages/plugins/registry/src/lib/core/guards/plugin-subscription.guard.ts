import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PluginSubscriptionAccessService } from '../../domain/services/plugin-subscription-access.service';

/**
 * Guard to validate that the user has a valid subscription before installing a plugin
 */
@Injectable()
export class PluginSubscriptionGuard implements CanActivate {
	constructor(private readonly pluginSubscriptionAccessService: PluginSubscriptionAccessService) {}

	/**
	 * Validates that the user has a valid subscription for the plugin
	 * @param context The execution context
	 * @returns Promise<boolean> indicating if the user has valid subscription
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		console.log('PluginSubscriptionGuard canActivate called');

		const request = context.switchToHttp().getRequest();
		const pluginId = request.params.pluginId;

		if (!pluginId) {
			throw new ForbiddenException('Plugin ID is required');
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}

		try {
			// Use centralized subscription access service for validation
			const hasAccess = await this.pluginSubscriptionAccessService.validatePluginAccess(
				pluginId,
				tenantId,
				organizationId,
				userId
			);

			if (!hasAccess) {
				console.log(
					`Plugin subscription access denied: Plugin ID: ${pluginId}, Tenant ID: ${tenantId}, User ID: ${userId}`
				);
				throw new ForbiddenException(
					'Valid subscription required. Please purchase a subscription for this plugin before installation.'
				);
			}

			console.log(
				`Plugin subscription access granted: Plugin ID: ${pluginId}, Tenant ID: ${tenantId}, User ID: ${userId}`
			);
			return true;
		} catch (error) {
			if (error instanceof ForbiddenException) {
				throw error;
			}
			console.error('Error checking plugin subscription:', error);
			throw new ForbiddenException('Unable to verify plugin subscription. Please try again.');
		}
	}
}
