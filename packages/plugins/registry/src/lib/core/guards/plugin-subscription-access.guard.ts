import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PluginSubscriptionAccessService } from '../../domain/services/plugin-subscription-access.service';

/**
 * Guard to validate plugin subscription access before allowing operations.
 * This guard checks if the user has an active subscription to access the plugin.
 *
 * Usage:
 * @UseGuards(PluginSubscriptionAccessGuard)
 * @SetMetadata('pluginIdParam', 'pluginId') // Optional: specify which param contains the plugin ID
 *
 * By default, it looks for 'pluginId' in route params.
 */
@Injectable()
export class PluginSubscriptionAccessGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly subscriptionAccessService: PluginSubscriptionAccessService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();

		// Get plugin ID from route parameters
		const pluginIdParam = this.reflector.get<string>('pluginIdParam', context.getHandler()) || 'pluginId';
		const pluginId = request.params[pluginIdParam];

		if (!pluginId) {
			throw new ForbiddenException('Plugin ID parameter is missing in the request');
		}

		// Get context information
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}

		// Check if user has access to the plugin
		try {
			const { canActivate } = await this.subscriptionAccessService.getSubscriptionDetails(
				pluginId,
				tenantId,
				organizationId,
				userId
			);
			return canActivate;
		} catch (error) {
			throw new ForbiddenException(
				error.message || 'You do not have an active subscription to access this plugin'
			);
		}
	}
}
