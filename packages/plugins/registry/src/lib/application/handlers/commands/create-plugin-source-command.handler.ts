import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { CreatePluginSourceCommand } from '../../commands/create-plugin-source.command';
import { PluginSource } from '../../../domain/entities/plugin-source.entity';

@CommandHandler(CreatePluginSourceCommand)
export class CreatePluginSourceCommandHandler implements ICommandHandler<CreatePluginSourceCommand> {
	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginSourceService: PluginSourceService
	) {}

	/**
	 * Handles the execution of the CreatePluginVersionCommand.
	 *
	 * @param {CreatePluginSourceCommand} command - The command instance containing plugin ID and DTO.
	 * @returns {Promise<IPluginSource[]>} - The created plugin source.
	 * @throws {NotFoundException} - If the plugin with the given ID does not exist.
	 */
	public async execute(command: CreatePluginSourceCommand): Promise<IPluginSource[]> {
		const { pluginId, versionId, input } = command;

		// Fetch plugin by ID
		const validation = await this.pluginVersionService.findOneOrFailByWhereOptions({
			id: versionId,
			pluginId
		});
		if (!validation.success) {
			throw new NotFoundException(`Plugin source with ID ${versionId} not found.`);
		}

		// Create a plugin source
		const sources = input.map((source) => Object.assign(new PluginSource(), { versionId }, source));

		// Save the plugin source
		return this.pluginSourceService.saveSources(sources);
	}
}
