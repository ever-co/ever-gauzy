import { TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { PluginSource } from '../entities/plugin-source.entity';
import { MikroOrmPluginSourceRepository } from '../repositories/mikro-orm-plugin-source.repository';
import { TypeOrmPluginSourceRepository } from '../repositories/type-orm-plugin-source.repository';
import { ID, PluginSourceType } from '@gauzy/contracts';

@Injectable()
export class PluginSourceService extends TenantAwareCrudService<PluginSource> {
	constructor(
		public readonly typeOrmPluginSourceRepository: TypeOrmPluginSourceRepository,
		public readonly mikroOrmPluginSourceRepository: MikroOrmPluginSourceRepository
	) {
		super(typeOrmPluginSourceRepository, mikroOrmPluginSourceRepository);
	}

	public saveSources(sources: PluginSource[]): Promise<IPluginSource[]> {
		return this.typeOrmPluginSourceRepository.save(sources);
	}

	/**
	 * Creates and saves multiple plugin source entities.
	 *
	 * @param {IPluginSource[]} sources - The source data array.
	 * @returns {Promise<IPluginSource[]>} - The created plugin sources.
	 * @throws {BadRequestException} - If source data is missing.
	 */
	public async createSources(sources: IPluginSource[]): Promise<IPluginSource[]> {
		if (!sources || !Array.isArray(sources) || sources.length === 0) {
			throw new BadRequestException('Source data array is required and must not be empty.');
		}
		const data = sources.map((source) => Object.assign(new PluginSource(), source));
		return this.saveSources(data);
	}

	/**
	 * Updates a plugin source using the source service
	 *
	 * @param data - Source data to update
	 * @param pluginId - ID of the plugin
	 * @throws NotFoundException if source is not found
	 */
	public async updateSource(data: Partial<IPluginSource>, versionId: ID): Promise<void> {
		if (!data || !data.id) {
			throw new BadRequestException('Source data and ID are required');
		}

		const found = await this.findOneOrFailByWhereOptions({
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

		await this.update(data.id, source);
	}
}
