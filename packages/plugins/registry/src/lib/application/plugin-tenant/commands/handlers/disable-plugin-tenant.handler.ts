import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { DisablePluginTenantCommand } from '../disable-plugin-tenant.command';

@CommandHandler(DisablePluginTenantCommand)
export class DisablePluginTenantCommandHandler implements ICommandHandler<DisablePluginTenantCommand> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the disable plugin tenant command
	 *
	 * @param command - The command containing plugin tenant ID to disable
	 * @returns The updated plugin tenant
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: DisablePluginTenantCommand): Promise<IPluginTenant> {
		const { id } = command;

		// Check if plugin tenant exists
		const existing = await this.pluginTenantService.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`Plugin tenant with ID "${id}" not found`);
		}

		// Use service method for disabling
		return await this.pluginTenantService.disablePlugin(id);
	}
}
