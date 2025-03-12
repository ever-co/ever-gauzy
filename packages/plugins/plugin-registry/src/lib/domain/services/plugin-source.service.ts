import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { PluginSource } from '../entities/plugin-source.entity';
import { MikroOrmPluginSourceRepository } from '../repositories/mikro-orm-plugin-source.repository';
import { TypeOrmPluginSourceRepository } from '../repositories/type-orm-plugin-source.repository';

@Injectable()
export class PluginSourceService extends TenantAwareCrudService<PluginSource> {
	constructor(
		public readonly typeOrmPluginSourceRepository: TypeOrmPluginSourceRepository,
		public readonly mikroOrmPluginSourceRepository: MikroOrmPluginSourceRepository
	) {
		super(typeOrmPluginSourceRepository, mikroOrmPluginSourceRepository);
	}
}
