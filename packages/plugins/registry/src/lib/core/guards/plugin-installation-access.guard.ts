import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PluginInstallationService } from '../../domain/services/plugin-installation.service';
import { PluginSubscriptionAccessService } from '../../domain/services/plugin-subscription-access.service';
import { PluginService } from '../../domain/services/plugin.service';

@Injectable()
export class PluginInstallationAccessGuard implements CanActivate {
	constructor(
		private readonly pluginInstallationService: PluginInstallationService,
		private readonly pluginService: PluginService,
		private readonly pluginSubscriptionAccessService: PluginSubscriptionAccessService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const installationId = this.getInstallationIdFromRequest(request);
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const currentUser = RequestContext.currentUser();
		const installedById = currentUser?.employeeId || null;

		if (!installationId) {
			throw new ForbiddenException('Plugin installation ID is required.');
		}
		if (!userId) {
			throw new ForbiddenException('User ID is required.');
		}

		// Find the plugin installation
		const installation = await this.pluginInstallationService.findOneByIdString(installationId);
		if (!installation) {
			throw new ForbiddenException('Plugin installation not found.');
		}

		// Check if user is the one who installed the plugin
		if (installation.installedById === installedById) {
			return true;
		}

		// Check if user is the plugin owner (uploaded the plugin)
		const isOwner = await this.pluginService.validatePluginOwnership(installation.pluginId, userId);
		if (isOwner) {
			return true;
		}

		// Check if user has an active subscription for this plugin using centralized service
		const hasAccess = await this.pluginSubscriptionAccessService.validatePluginAccess(
			installation.pluginId,
			tenantId,
			organizationId,
			userId
		);
		if (hasAccess) {
			return true;
		}

		throw new ForbiddenException(
			'You do not have permission to access this plugin installation. You must be the installer, plugin owner, or have an active subscription.'
		);
	}

	private getInstallationIdFromRequest(request: any): string | undefined {
		return request.params?.installationId || request.body?.installationId || request.params?.id || request.body?.id;
	}
}
