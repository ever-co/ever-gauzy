import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { PluginVersion } from '../entities/plugin-version.entity';
import { MikroOrmPluginVersionRepository } from '../repositories/mikro-orm-plugin-version.repository';
import { TypeOrmPluginVersionRepository } from '../repositories/type-orm-plugin-version.repository';

@Injectable()
export class PluginVersionService extends TenantAwareCrudService<PluginVersion> {
	constructor(
		public readonly typeOrmPluginVersionRepository: TypeOrmPluginVersionRepository,
		public readonly mikroOrmPluginVersionRepository: MikroOrmPluginVersionRepository
	) {
		super(typeOrmPluginVersionRepository, mikroOrmPluginVersionRepository);
	}
}
