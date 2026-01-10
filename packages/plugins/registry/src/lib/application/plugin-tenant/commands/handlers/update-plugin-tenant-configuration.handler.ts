import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { UpdatePluginTenantConfigurationCommand } from '../update-plugin-tenant-configuration.command';

@CommandHandler(UpdatePluginTenantConfigurationCommand)
export class UpdatePluginTenantConfigurationCommandHandler
	implements ICommandHandler<UpdatePluginTenantConfigurationCommand>
{
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the update plugin tenant configuration command
	 *
	 * @param command - The command containing configuration update data
	 * @returns The updated plugin tenant
	 * @throws BadRequestException if validation fails
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: UpdatePluginTenantConfigurationCommand): Promise<IPluginTenant> {
		const { input } = command;

		// Validate input
		if (!input || !input.pluginTenantId) {
			throw new BadRequestException('Plugin tenant ID is required');
		}

		if (!input.configuration && !input.preferences) {
			throw new BadRequestException('Either configuration or preferences must be provided');
		}

		// Check if plugin tenant exists
		const pluginTenant = await this.pluginTenantService.findOneByIdString(input.pluginTenantId);
		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${input.pluginTenantId}" not found`);
		}

		// Convert to entity to use business logic methods
		const entity = Object.assign(new PluginTenant(), pluginTenant);

		// Update configuration if provided
		if (input.configuration) {
			entity.updateConfiguration(input.configuration);
		}

		// Update preferences if provided
		if (input.preferences) {
			entity.updatePreferences(input.preferences);
		}

		// Update in database
		await this.pluginTenantService.update(input.pluginTenantId, {
			tenantConfiguration: entity.tenantConfiguration,
			preferences: entity.preferences
		});

		// Return updated plugin tenant with relations
		return await this.pluginTenantService.findOneByIdString(input.pluginTenantId, {
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
