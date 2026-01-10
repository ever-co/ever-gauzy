import { RequestContext } from '@gauzy/core';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { CreatePluginTenantCommand } from '../create-plugin-tenant.command';

@CommandHandler(CreatePluginTenantCommand)
export class CreatePluginTenantCommandHandler implements ICommandHandler<CreatePluginTenantCommand> {
	constructor(
		private readonly pluginTenantService: PluginTenantService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Executes the create plugin tenant command
	 *
	 * @param command - The command containing plugin tenant creation data
	 * @returns The created plugin tenant
	 * @throws BadRequestException if validation fails
	 * @throws ConflictException if plugin tenant already exists
	 */
	public async execute(command: CreatePluginTenantCommand): Promise<IPluginTenant> {
		const { input } = command;

		// Validate input
		if (!input) {
			throw new BadRequestException('Plugin tenant data is required');
		}

		// Get context info
		const tenantId = input.tenantId || RequestContext.currentTenantId();
		const organizationId = input.organizationId || RequestContext.currentOrganizationId();

		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		// Verify plugin exists
		const plugin = await this.pluginService.findOneByIdString(input.pluginId);
		if (!plugin) {
			throw new BadRequestException(`Plugin with ID "${input.pluginId}" not found`);
		}

		// Check if plugin tenant already exists
		const existing = await this.pluginTenantService.findByPluginAndTenant(input.pluginId, tenantId, organizationId);

		if (existing) {
			throw new ConflictException(
				`Plugin "${plugin.name}" is already configured for this ${organizationId ? 'organization' : 'tenant'}`
			);
		}

		// Create plugin tenant using factory method
		const pluginTenant = PluginTenant.create({
			plugin,
			scope: input.scope,
			enabled: input.enabled,
			autoInstall: input.autoInstall,
			requiresApproval: input.requiresApproval,
			isMandatory: input.isMandatory,
			maxInstallations: input.maxInstallations,
			maxActiveUsers: input.maxActiveUsers,
			isDataCompliant: input.isDataCompliant
		});

		// Set additional properties
		pluginTenant.tenantId = tenantId;
		pluginTenant.organizationId = organizationId;
		pluginTenant.tenantConfiguration = input.tenantConfiguration;
		pluginTenant.preferences = input.preferences;
		pluginTenant.complianceCertifications = input.complianceCertifications;

		// Handle access controls
		if (input.allowedRoleIds && input.allowedRoleIds.length > 0) {
			// TODO: Load roles from IDs and assign to allowedRoles
			// This would require role service injection
		}
		if (input.allowedUserIds && input.allowedUserIds.length > 0) {
			// TODO: Load users from IDs and assign to allowedUsers
			// This would require user service injection
		}
		if (input.deniedUserIds && input.deniedUserIds.length > 0) {
			// TODO: Load users from IDs and assign to deniedUsers
			// This would require user service injection
		}

		// If objects are provided directly, use them
		if (input.allowedRoles) {
			pluginTenant.allowedRoles = input.allowedRoles;
		}
		if (input.allowedUsers) {
			pluginTenant.allowedUsers = input.allowedUsers;
		}
		if (input.deniedUsers) {
			pluginTenant.deniedUsers = input.deniedUsers;
		}

		// Save the plugin tenant
		const created = await this.pluginTenantService.save(pluginTenant);

		// Return with relations loaded
		return await this.pluginTenantService.findOneByIdString(created.id, {
			relations: [
				'plugin',
				'approvedBy',
				'allowedRoles',
				'allowedUsers',
				'deniedUsers',
				'settings',
				'subscriptions'
			]
		});
	}
}
