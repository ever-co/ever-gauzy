import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
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
}
