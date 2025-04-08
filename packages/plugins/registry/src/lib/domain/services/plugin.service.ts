import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Plugin } from '../entities/plugin.entity';
import { MikroOrmPluginRepository } from '../repositories/mikro-orm-plugin.repository';
import { TypeOrmPluginRepository } from '../repositories/type-orm-plugin.repository';

@Injectable()
export class PluginService extends TenantAwareCrudService<Plugin> {
	constructor(
		public readonly typeOrmPluginRepository: TypeOrmPluginRepository,
		public readonly mikroOrmPluginRepository: MikroOrmPluginRepository
	) {
		super(typeOrmPluginRepository, mikroOrmPluginRepository);
	}

	public async validatePluginOwnership(pluginId: string, employeeId: string): Promise<boolean> {
		const plugin = await this.findOneOrFailByWhereOptions({ id: pluginId });

		if (!plugin.success) {
			throw new NotFoundException(`Plugin with ID "${pluginId}" not found.`);
		}
		if (plugin.record.uploadedById !== employeeId) {
			return false;
		}

		return true;
	}
}
