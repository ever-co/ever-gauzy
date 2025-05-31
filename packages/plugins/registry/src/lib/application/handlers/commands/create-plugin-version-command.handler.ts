import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
import { CreatePluginVersionCommand } from '../../commands/create-plugin-version.command';

@CommandHandler(CreatePluginVersionCommand)
export class CreatePluginVersionCommandHandler implements ICommandHandler<CreatePluginVersionCommand> {
	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginSourceService: PluginSourceService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Handles the execution of the CreatePluginVersionCommand.
	 *
	 * @param {CreatePluginVersionCommand} command - The command instance containing plugin ID and DTO.
	 * @returns {Promise<IPluginVersion>} - The created plugin version.
	 * @throws {NotFoundException} - If the plugin with the given ID does not exist.
	 */
	public async execute(command: CreatePluginVersionCommand): Promise<IPluginVersion> {
		const { pluginId, dto } = command;

		// Fetch plugin by ID
		const pluginResult = await this.pluginService.findOneOrFailByIdString(pluginId);
		if (!pluginResult.success) {
			throw new NotFoundException(`Plugin with ID ${pluginId} not found.`);
		}

		// Create a plugin source
		const source = await this.pluginSourceService.createSources(dto.sources);

		// Create and return the new plugin version
		return this.pluginVersionService.createVersion(dto, pluginResult.record, source);
	}
}
