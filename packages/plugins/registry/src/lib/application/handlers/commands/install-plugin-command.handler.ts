import { RequestContext } from '@gauzy/core';
import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallation } from '../../../domain/entities/plugin-installation.entity';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginSubscriptionPlanService } from '../../../domain/services/plugin-subscription-plan.service';
import { PluginSubscriptionService } from '../../../domain/services/plugin-subscription.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { PluginScope } from '../../../shared/models/plugin-scope.model';
import { PluginSubscriptionStatus } from '../../../shared/models/plugin-subscription.model';
import { InstallPluginCommand } from '../../commands/install-plugin.command';

/**
 * Command handler responsible for handling the installation of plugins.
 */
@CommandHandler(InstallPluginCommand)
export class InstallPluginCommandHandler implements ICommandHandler<InstallPluginCommand> {
	constructor(
		/**
		 * Service responsible for handling plugin installation logic.
		 */
		private readonly installationService: PluginInstallationService,
		/**
		 * Service responsible for handling plugin subscription logic.
		 */
		private readonly subscriptionService: PluginSubscriptionService,
		/**
		 * Service responsible for handling plugin subscription plans.
		 */
		private readonly subscriptionPlanService: PluginSubscriptionPlanService
	) {}

	/**
	 * Executes the command to install a plugin.
	 *
	 * @param command - The install plugin command containing the plugin ID and version information.
	 * @returns A promise that resolves when the plugin installation is completed.
	 * @throws {NotFoundException} If the plugin installation entry is not found.
	 * @throws {ForbiddenException} If user doesn't have proper subscription for plugin installation.
	 */
	public async execute(command: InstallPluginCommand): Promise<void> {
		const {
			pluginId,
			input: { versionId }
		} = command;
		const installedById = RequestContext.currentEmployeeId();
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Check if user has valid subscription for this plugin (any scope: user, organization, or tenant)
		await this.validatePluginSubscription(pluginId, tenantId, organizationId, userId);

		// Find existing plugin installation
		const found = await this.installationService.findOneOrFailByWhereOptions({
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.INSTALLED
		});

		if (found.success) {
			// Plugin is already installed, no further action needed
			return;
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
		await this.installationService.save(installation);
	}

	/**
	 * Validate that the user has an active subscription for this plugin
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID
	 * @param userId - The user ID
	 * @throws ForbiddenException if user doesn't have an active subscription
	 */
	private async validatePluginSubscription(
		pluginId: string,
		tenantId: string,
		organizationId: string,
		userId: string
	): Promise<void> {
		// Check if the plugin has any subscription plans
		const hasPlans = await this.subscriptionPlanService.hasPlans(pluginId);

		// If no subscription plans exist, the plugin is free and anyone can install it
		if (!hasPlans) {
			console.log(`Plugin is free (no subscription plans), allowing installation: Plugin ID: ${pluginId}`);
			return;
		}

		// Check for active subscription at user level (user bought for themselves)
		const hasUserSubscription = await this.subscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			subscriberId: userId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.USER
		});

		// Check for active subscription at organization level
		const hasOrgSubscription = await this.subscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.ORGANIZATION
		});

		// Check for active subscription at tenant level
		const hasTenantSubscription = await this.subscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: PluginScope.TENANT
		});

		if (!hasUserSubscription && !hasOrgSubscription && !hasTenantSubscription) {
			throw new ForbiddenException(
				'You must have an active subscription for this plugin to install it. ' +
					'Please purchase the plugin first or contact your administrator if it should be available to you.'
			);
		}
	}
}
