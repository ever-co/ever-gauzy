import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenantService } from '../../../../domain';
import { DeletePluginTenantCommand } from '../delete-plugin-tenant.command';

@CommandHandler(DeletePluginTenantCommand)
export class DeletePluginTenantCommandHandler implements ICommandHandler<DeletePluginTenantCommand> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the delete plugin tenant command
	 *
	 * @param command - The command containing plugin tenant ID to delete
	 * @returns Promise<void>
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: DeletePluginTenantCommand): Promise<void> {
		const { id } = command;

		// Check if plugin tenant exists
		const existing = await this.pluginTenantService.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`Plugin tenant with ID "${id}" not found`);
		}

		// Delete the plugin tenant
		await this.pluginTenantService.delete(id);
	}
}
