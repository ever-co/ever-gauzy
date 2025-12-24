import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { EnablePluginTenantCommand } from '../enable-plugin-tenant.command';

@CommandHandler(EnablePluginTenantCommand)
export class EnablePluginTenantCommandHandler implements ICommandHandler<EnablePluginTenantCommand> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the enable plugin tenant command
	 *
	 * @param command - The command containing plugin tenant ID to enable
	 * @returns The updated plugin tenant
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: EnablePluginTenantCommand): Promise<IPluginTenant> {
		const { id } = command;

		// Check if plugin tenant exists
		const existing = await this.pluginTenantService.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`Plugin tenant with ID "${id}" not found`);
		}

		// Use service method for enabling
		return await this.pluginTenantService.enablePlugin(id);
	}
}
