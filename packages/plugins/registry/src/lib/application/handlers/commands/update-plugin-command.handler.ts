import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPlugin } from '../../../shared/models/plugin.model';
import { UpdatePluginCommand } from '../../commands/update-plugin.command';

@CommandHandler(UpdatePluginCommand)
export class UpdatePluginCommandHandler implements ICommandHandler<UpdatePluginCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly pluginService: PluginService,
		private readonly dataSource: DataSource
	) {}

	/**
	 * Updates a plugin and its associated source and version
	 *
	 * @param command - The update plugin command with input data and plugin ID
	 * @returns The updated plugin
	 * @throws NotFoundException if plugin, source, or version is not found
	 */
	public async execute(command: UpdatePluginCommand): Promise<IPlugin> {
		const { input, id } = command;

		if (!id) {
			throw new BadRequestException('Plugin ID is required');
		}

		// Start a transaction for updating the plugin and related entities
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Check if plugin exists
			const found = await this.pluginService.findOneOrFailByIdString(id);
			if (!found.success) {
				throw new NotFoundException(`Plugin with ID ${id} not found`);
			}

			// Update source and version
			if (input.version) {
				await this.versionService.updateVersion(input.version, id);

				if (input.version.sources.length > 0) {
					await Promise.all(
						input.version.sources.map(async (source) => {
							this.sourceService.updateSource(source, input.version.id);
						})
					);
				}
			}

			// Update plugin
			const plugin: Partial<IPlugin> = {
				name: input.name,
				type: input.type,
				status: input.status,
				description: input.description,
				isActive: input.isActive,
				repository: input.repository,
				author: input.author,
				license: input.license,
				homepage: input.homepage
			};
			await this.pluginService.update(found.record.id, plugin);

			await queryRunner.commitTransaction();

			// Return the updated plugin with relations
			return this.pluginService.findOneByIdString(id, {
				relations: ['versions', 'versions.sources']
			});
		} catch (error) {
			// Roll back transaction on error
			await queryRunner.rollbackTransaction();

			if (error instanceof NotFoundException) {
				throw error;
			}

			throw new BadRequestException(`Failed to update plugin: ${error.message}`);
		} finally {
			// Release resources
			await queryRunner.release();
		}
	}
}
