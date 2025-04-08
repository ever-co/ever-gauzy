import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CreatePluginVersionCommand } from '../../commands/create-plugin-version.command';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { IPlugin } from '../../../shared/models/plugin.model';
import { PluginVersion } from '../../../domain/entities/plugin-version.entity';
import { PluginSource } from '../../../domain/entities/plugin-source.entity';

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
		const source = await this.createPluginSource(dto.source);

		// Create and return the new plugin version
		return this.createPluginVersion(dto, pluginResult.record, source);
	}

	/**
	 * Creates and saves a new plugin version entity.
	 *
	 * @param {IPluginVersion} versionData - The plugin version data.
	 * @param {IPlugin} plugin - The associated plugin.
	 * @param {IPluginSource} source - The associated plugin source.
	 * @returns {Promise<IPluginVersion>} - The created plugin version.
	 * @throws {BadRequestException} - If version data is missing.
	 */
	private async createPluginVersion(
		versionData: IPluginVersion,
		plugin: IPlugin,
		source: IPluginSource
	): Promise<IPluginVersion> {
		if (!versionData) {
			throw new BadRequestException('Version data is required.');
		}

		const version = Object.assign(new PluginVersion(), {
			...versionData,
			plugin,
			source
		});

		return this.pluginVersionService.save(version);
	}

	/**
	 * Creates and saves a new plugin source entity.
	 *
	 * @param {IPluginSource} sourceData - The source data.
	 * @returns {Promise<IPluginSource>} - The created plugin source.
	 * @throws {BadRequestException} - If source data is missing.
	 */
	private async createPluginSource(sourceData: IPluginSource): Promise<IPluginSource> {
		if (!sourceData) {
			throw new BadRequestException('Source data is required.');
		}

		const source = Object.assign(new PluginSource(), sourceData);
		return this.pluginSourceService.save(source);
	}
}
