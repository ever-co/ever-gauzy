import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { UpdatePluginTenantCommand } from '../update-plugin-tenant.command';

@CommandHandler(UpdatePluginTenantCommand)
export class UpdatePluginTenantCommandHandler implements ICommandHandler<UpdatePluginTenantCommand> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the update plugin tenant command
	 *
	 * @param command - The command containing plugin tenant update data
	 * @returns The updated plugin tenant
	 * @throws BadRequestException if validation fails
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: UpdatePluginTenantCommand): Promise<IPluginTenant> {
		const { id, input } = command;

		// Validate input
		if (!input) {
			throw new BadRequestException('Update data is required');
		}

		// Check if plugin tenant exists
		const existing = await this.pluginTenantService.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`Plugin tenant with ID "${id}" not found`);
		}

		// Update the plugin tenant
		await this.pluginTenantService.update(id, {
			enabled: input.enabled,
			scope: input.scope,
			autoInstall: input.autoInstall,
			requiresApproval: input.requiresApproval,
			isMandatory: input.isMandatory,
			maxInstallations: input.maxInstallations,
			maxActiveUsers: input.maxActiveUsers,
			tenantConfiguration: input.tenantConfiguration,
			preferences: input.preferences,
			isDataCompliant: input.isDataCompliant,
			complianceCertifications: input.complianceCertifications
		});

		// Return updated plugin tenant with relations
		return await this.pluginTenantService.findOneByIdString(id, {
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
