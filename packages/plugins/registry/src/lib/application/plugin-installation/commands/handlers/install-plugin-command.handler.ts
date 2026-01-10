import { PluginInstallationStatus, PluginScope } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallation, PluginInstallationService, PluginSubscriptionAccessService } from '../../../../domain';
import { IPluginInstallation } from '../../../../shared';
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
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Get employeeId - may be null for users without employee records or with CHANGE_SELECTED_EMPLOYEE permission
		const currentUser = RequestContext.currentUser();
		const installedById = currentUser?.employeeId || null;

		// Ensure user has an associated employee record
		if (!installedById) {
			throw new ForbiddenException(
				'Plugin installation requires an associated employee record. Please contact your administrator.'
			);
		}

		// Check if user has valid subscription for this plugin (any scope: user, organization, or tenant)
		const state = await this.subscriptionAccessService.getSubscriptionDetails(
			pluginId,
			tenantId,
			organizationId,
			userId
		);

		// Ensure user has access to install the plugin
		this.ensurePluginAccess(state);

		// Build where clause for finding existing installation (only include database properties)
		const whereClause = {
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.INSTALLED
		};

		// Find existing plugin installation
		const found = await this.installationService.findOneOrFailByWhereOptions(whereClause);

		if (found.success) {
			// Plugin is already installed, return the existing record
			return found.record;
		}

		// Create the PluginInstallation entity
		const installationData: Partial<IPluginInstallation> = {
			tenantId,
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.INSTALLED,
			installedAt: new Date(),
			uninstalledAt: null,
			...(organizationId && { organizationId })
		};

		const installation = Object.assign(new PluginInstallation(), installationData);

		// Persist the plugin installation record
		return this.installationService.save(installation);
	}

	private ensurePluginAccess(state: { hasAccess: boolean; accessLevel: PluginScope }): void {
		if (state.hasAccess) return;
		const message = this.accessDeniedMessages[state.accessLevel] ?? 'Access denied. Missing valid subscription.';
		throw new ForbiddenException(message);
	}
}
