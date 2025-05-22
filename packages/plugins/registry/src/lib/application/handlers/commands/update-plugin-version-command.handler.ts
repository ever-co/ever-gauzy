import { ID, PluginSourceType } from '@gauzy/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { UpdatePluginVersionDTO } from '../../../shared/dto/update-plugin-version.dto';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
import { UpdatePluginVersionCommand } from '../../commands/update-plugin-version.command';

@CommandHandler(UpdatePluginVersionCommand)
export class UpdatePluginVersionCommandHandler implements ICommandHandler<UpdatePluginVersionCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly dataSource: DataSource
	) {}

	/**
	 * Updates a plugin version and its associated source
	 *
	 * @param command - The update plugin version command with input data and plugin ID
	 * @returns The updated plugin
	 * @throws NotFoundException if source, or version is not found
	 */
	public async execute(command: UpdatePluginVersionCommand): Promise<IPluginVersion> {
		const { input, pluginId, versionId } = command;

		if (!pluginId) {
			throw new BadRequestException('Plugin version ID is required');
		}

		// Start a transaction for updating the plugin version and related entities
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Check if plugin version exists
			const found = await this.versionService.findOneOrFailByIdString(versionId, {
				where: {
					pluginId
				}
			});

			if (!found.success) {
				throw new NotFoundException(`Plugin version with ID ${versionId} not found`);
			}

			// Update source and version
			if (input) {
				await this.updateVersion(input, pluginId);

				if (input.sources.length) {
					await Promise.all(input.sources.map((source) => this.updateSource(source, versionId)));
				}
			}

			await queryRunner.commitTransaction();

			// Return the updated plugin with relations
			return this.versionService.findOneByIdString(versionId, {
				relations: ['sources', 'plugin']
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
			versionId,
			id: data.id
		});

		if (!found.success) {
			throw new NotFoundException(`Source with ID ${data.id} not found for version ${versionId}`);
		}

		const source: Partial<IPluginSource> = {
			type: data.type,
			architecture: data.architecture,
			operatingSystem: data.operatingSystem,
			...(data.type === PluginSourceType.CDN && {
				url: data.url,
				integrity: data.integrity,
				crossOrigin: data.crossOrigin
			}),
			...(data.type === PluginSourceType.NPM && {
				registry: data.registry,
				name: data.name,
				scope: data.scope,
				private: data.private
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
