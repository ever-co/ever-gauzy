import { ID, PluginSourceType } from '@gauzy/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { UpdatePluginVersionDTO } from '../../../shared/dto/update-plugin-version.dto';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
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
				await this.updateVersion(input.version, id);

				if (input.version.source) {
					await this.updateSource(input.version.source, input.version.id);
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
				relations: ['versions', 'versions.source']
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

	/**
	 * Updates a plugin source using the source service
	 *
	 * @param data - Source data to update
	 * @param pluginId - ID of the plugin
	 * @throws NotFoundException if source is not found
	 */
	private async updateSource(data: Partial<IPluginSource>, versionId: IPluginVersion['id']): Promise<void> {
		if (!data || !data.id) {
			throw new BadRequestException('Source data and ID are required');
		}

		const found = await this.sourceService.findOneOrFailByWhereOptions({
			versions: {
				id: versionId
			},
			id: data.id
		});

		if (!found.success) {
			throw new NotFoundException(`Source with ID ${data.id} not found for version ${versionId}`);
		}

		const source: Partial<IPluginSource> = {
			type: data.type,
			...(data.type === PluginSourceType.CDN && {
				url: data.url,
				integrity: data.integrity,
				crossOrigin: data.crossOrigin
			}),
			...(data.type === PluginSourceType.NPM && {
				registry: data.registry,
				name: data.name,
				scope: data.scope,
				authToken: data.authToken
			}),
			...(data.type === PluginSourceType.GAUZY && data)
		};

		await this.sourceService.update(data.id, source);
	}

	/**
	 * Updates a plugin version using the version service
	 *
	 * @param data - Version data to update
	 * @param pluginId - ID of the plugin
	 * @throws NotFoundException if version is not found
	 */
	private async updateVersion(data: UpdatePluginVersionDTO, pluginId: ID): Promise<void> {
		if (!data || !data.id) {
			throw new BadRequestException('Version data and ID are required');
		}

		const found = await this.versionService.findOneOrFailByWhereOptions({
			pluginId,
			id: data.id
		});

		if (!found.success) {
			throw new NotFoundException(`Version with ID ${data.id} not found for plugin ${pluginId}`);
		}

		const version: Partial<IPluginVersion> = {
			changelog: data.changelog,
			number: data.number,
			releaseDate: data.releaseDate
		};

		await this.versionService.update(data.id, version);
	}
}
