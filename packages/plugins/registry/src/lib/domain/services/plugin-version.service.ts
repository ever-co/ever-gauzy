import { TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginVersion } from '../entities/plugin-version.entity';
import { MikroOrmPluginVersionRepository } from '../repositories/mikro-orm-plugin-version.repository';
import { TypeOrmPluginVersionRepository } from '../repositories/type-orm-plugin-version.repository';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { UpdatePluginVersionDTO } from '../../shared/dto/update-plugin-version.dto';
import { ID } from '@gauzy/contracts';

@Injectable()
export class PluginVersionService extends TenantAwareCrudService<PluginVersion> {
	constructor(
		public readonly typeOrmPluginVersionRepository: TypeOrmPluginVersionRepository,
		public readonly mikroOrmPluginVersionRepository: MikroOrmPluginVersionRepository
	) {
		super(typeOrmPluginVersionRepository, mikroOrmPluginVersionRepository);
	}

	public getTotalDownloadCount(pluginId: IPlugin['id']): Promise<number> {
		return this.typeOrmRepository.sum('downloadCount', {
			pluginId
		});
	}

	/**
	 * Creates and saves a new plugin version entity.
	 *
	 * @param {IPluginVersion} versionData - The plugin version data.
	 * @param {IPlugin} plugin - The associated plugin.
	 * @param {IPluginSource[]} sources - The associated plugin sources.
	 * @returns {Promise<IPluginVersion>} - The created plugin version.
	 * @throws {BadRequestException} - If version data is missing.
	 */
	public async createVersion(
		versionData: IPluginVersion,
		plugin: IPlugin,
		sources: IPluginSource[]
	): Promise<IPluginVersion> {
		if (!versionData) {
			throw new BadRequestException('Version data is required.');
		}

		const version = Object.assign(new PluginVersion(), {
			...versionData,
			plugin,
			sources
		});

		return this.save(version);
	}

	/**
	 * Updates a plugin version using the version service
	 *
	 * @param data - Version data to update
	 * @param pluginId - ID of the plugin
	 * @throws NotFoundException if version is not found
	 */
	public async updateVersion(data: UpdatePluginVersionDTO, pluginId: ID): Promise<void> {
		if (!data || !data.id) {
			throw new BadRequestException('Version data and ID are required');
		}

		const found = await this.findOneOrFailByWhereOptions({
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

		await this.update(data.id, version);
	}
}
