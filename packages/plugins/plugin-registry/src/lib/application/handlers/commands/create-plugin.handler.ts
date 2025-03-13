import { IPluginSource } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginSource } from '../../../domain/entities/plugin-source.entity';
import { PluginVersion } from '../../../domain/entities/plugin-version.entity';
import { Plugin } from '../../../domain/entities/plugin.entity';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
import { IPlugin } from '../../../shared/models/plugin.model';
import { CreatePluginCommand } from '../../commands/create-plugin.command';

@CommandHandler(CreatePluginCommand)
export class CreatePluginHandler implements ICommandHandler<CreatePluginCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly pluginService: PluginService,
		private readonly dataSource: DataSource
	) {}

	/**
	 * Executes the create plugin command
	 *
	 * @param command - The command containing plugin creation data
	 * @returns The created plugin
	 * @throws BadRequestException if validation fails
	 */
	public async execute(command: CreatePluginCommand): Promise<IPlugin> {
		const { input } = command;

		// Validate input
		if (!input || (input.source && !input.version)) {
			throw new BadRequestException('Invalid plugin data: Source requires version information');
		}

		// Use a transaction to ensure data consistency
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Create the plugin
			const plugin = new Plugin();
			Object.assign(plugin, input);
			await this.pluginService.save(plugin);

			// Process source and version if provided
			if (input.source) {
				const source = await this.createPluginSource(input.source);
				plugin.source = source;
				await this.pluginService.save(plugin);
				await this.createPluginVersion(input.version, plugin);
			}

			await queryRunner.commitTransaction();

			// Return the complete plugin with all relations
			return this.pluginService.findOneByIdString(plugin.id, {
				relations: ['source', 'versions']
			});
		} catch (error) {
			// Rollback transaction on error
			await queryRunner.rollbackTransaction();
			throw new BadRequestException(`Failed to create plugin: ${error.message}`);
		} finally {
			// Release queryRunner resources
			await queryRunner.release();
		}
	}

	/**
	 * Creates a plugin version
	 *
	 * @param versionData - Version data to create
	 * @param plugin - Associated plugin
	 */
	private async createPluginVersion(versionData: IPluginVersion, plugin: IPlugin): Promise<void> {
		if (!versionData) {
			throw new BadRequestException('Version data is required');
		}

		const version = new PluginVersion();
		version.plugin = plugin;
		Object.assign(version, versionData);
		await this.versionService.save(version);
	}

	/**
	 * Creates a plugin source
	 *
	 * @param sourceData - Source data to create
	 * @returns The created plugin source
	 */
	private async createPluginSource(sourceData: IPluginSource): Promise<IPluginSource> {
		if (!sourceData) {
			throw new BadRequestException('Source data is required');
		}

		const source = new PluginSource();
		Object.assign(source, sourceData);
		return this.sourceService.save(source);
	}
}
