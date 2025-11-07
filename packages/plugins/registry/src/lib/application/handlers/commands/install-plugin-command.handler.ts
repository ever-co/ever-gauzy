import { RequestContext } from '@gauzy/core';
import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallation } from '../../../domain/entities/plugin-installation.entity';
import { PluginSubscriptionAccessService } from '../../../domain/services';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { IPluginInstallation, PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { PluginScope } from '../../../shared/models/plugin-scope.model';
import { InstallPluginCommand } from '../../commands/install-plugin.command';

/**
 * Command handler responsible for handling the installation of plugins.
 */
@CommandHandler(InstallPluginCommand)
export class InstallPluginCommandHandler implements ICommandHandler<InstallPluginCommand> {
	private readonly accessDeniedMessages: Record<PluginScope, string> = {
		[PluginScope.USER]:
			'You do not have an active subscription for this plugin. Please subscribe to install and use it.',
		[PluginScope.ORGANIZATION]:
			'Your organization does not have an active subscription for this plugin. Please contact your administrator.',
		[PluginScope.TENANT]:
			'Your tenant does not have an active subscription for this plugin. Please contact your administrator.',
		[PluginScope.GLOBAL]:
			'Your tenant does not have an active subscription for this plugin. Please contact your administrator.'
	};

	constructor(
		/**
		 * Service responsible for handling plugin installation logic.
		 */
		private readonly installationService: PluginInstallationService,
		/**
		 * Service responsible for validating plugin subscription access.
		 */
		private readonly subscriptionAccessService: PluginSubscriptionAccessService
	) {}

	/**
	 * Executes the command to install a plugin.
	 *
	 * @param command - The install plugin command containing the plugin ID and version information.
	 * @returns A promise that resolves when the plugin installation is completed.
	 * @throws {NotFoundException} If the plugin installation entry is not found.
	 * @throws {ForbiddenException} If user doesn't have proper subscription for plugin installation.
	 */
	public async execute(command: InstallPluginCommand): Promise<IPluginInstallation> {
		const {
			pluginId,
			input: { versionId }
		} = command;
		const installedById = RequestContext.currentEmployeeId();
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Check if user has valid subscription for this plugin (any scope: user, organization, or tenant)
		const state = await this.subscriptionAccessService.getSubscriptionDetails(
			pluginId,
			tenantId,
			organizationId,
			userId
		);

		// Ensure user has access to install the plugin
		this.ensurePluginAccess(state);

		// Find existing plugin installation
		const found = await this.installationService.findOneOrFailByWhereOptions({
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.INSTALLED
		});

		if (found.success) {
			// Plugin is already installed, return the existing record
			return found.record;
		}

		// Create or update the PluginInstallation entity
		const installation = Object.assign(new PluginInstallation(), {
			installedById,
			pluginId,
			versionId,
			status: PluginInstallationStatus.INSTALLED,
			installedAt: new Date(),
			uninstalledAt: null
		});
		// Persist the plugin installation record
		return this.installationService.save(installation);
	}

	private ensurePluginAccess(state: { hasAccess: boolean; accessLevel: PluginScope }): void {
		if (state.hasAccess) return;
		const message = this.accessDeniedMessages[state.accessLevel] ?? 'Access denied. Missing valid subscription.';
		throw new ForbiddenException(message);
	}
}
