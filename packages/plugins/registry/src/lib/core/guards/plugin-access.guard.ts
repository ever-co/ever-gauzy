import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PluginInstallationService } from '../../domain/services/plugin-installation.service';
import { PluginSubscriptionService } from '../../domain/services/plugin-subscription.service';
import { PluginService } from '../../domain/services/plugin.service';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import { PluginSubscriptionStatus } from '../../shared/models/plugin-subscription.model';

@Injectable()
export class PluginAccessGuard implements CanActivate {
	constructor(
		private readonly pluginService: PluginService,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginInstallationService: PluginInstallationService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const idFromRequest = this.getPluginIdFromRequest(request);
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const currentUser = RequestContext.currentUser();
		const installedById = currentUser?.employeeId || null;

		if (!idFromRequest) {
			throw new ForbiddenException('Plugin ID or Installation ID is required.');
		}
		if (!userId) {
			throw new ForbiddenException('User ID is required.');
		}

		let pluginId: string;

		// Check if we have an installation ID - resolve to plugin ID
		if (request.params?.installationId || request.body?.installationId) {
			const installation = await this.pluginInstallationService.findOneByIdString(idFromRequest);
			if (!installation) {
				throw new ForbiddenException('Plugin installation not found.');
			}

			// Check if user is the one who installed the plugin
			if (installation.installedById === installedById) {
				return true;
			}

			pluginId = installation.pluginId;
		} else {
			pluginId = idFromRequest;
		}

		// Check if user is the plugin owner (uploaded the plugin)
		const isOwner = await this.pluginService.validatePluginOwnership(pluginId, userId);
		if (isOwner) {
			return true;
		}

		// Check if user has an active subscription for this plugin
		const hasAccess = await this.checkPluginSubscriptionAccess(pluginId, userId, tenantId, organizationId);
		if (hasAccess) {
			return true;
		}

		throw new ForbiddenException(
			'You do not have permission to access this plugin. You must be the owner or have an active subscription.'
		);
	}

	private getPluginIdFromRequest(request: any): string | undefined {
		// Handle both plugin IDs and installation IDs
		const pluginId = request.params?.id || request.body?.id || request.params?.pluginId || request.body?.pluginId;
		if (pluginId) {
			return pluginId;
		}

		// If we have an installation ID, we'll need to look up the plugin ID
		const installationId = request.params?.installationId || request.body?.installationId;
		if (installationId) {
			// This will be handled asynchronously in canActivate
			return installationId;
		}

		return undefined;
	}

	/**
	 * Check if user has access to plugin through subscription
	 * @param pluginId - The plugin ID
	 * @param userId - The user ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID
	 * @returns True if user has access through any subscription
	 */
	private async checkPluginSubscriptionAccess(
		pluginId: string,
		userId: string,
		tenantId: string,
		organizationId: string
	): Promise<boolean> {
		// Check for user-level subscription (user bought for themselves)
		const hasUserSubscription = await this.pluginSubscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			subscriberId: userId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.USER
		});

		if (hasUserSubscription) {
			return true;
		}

		// Check for organization-level subscription
		const hasOrgSubscription = await this.pluginSubscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.ORGANIZATION
		});

		if (hasOrgSubscription) {
			return true;
		}

		// Check for tenant-level subscription
		const hasTenantSubscription = await this.pluginSubscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.TENANT
		});

		if (hasTenantSubscription) {
			return true;
		}

		return false;
	}
}
