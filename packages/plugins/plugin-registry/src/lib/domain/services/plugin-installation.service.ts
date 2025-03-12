import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { PluginInstallation } from '../entities/plugin-installation.entity';
import { MikroOrmPluginInstallationRepository } from '../repositories/mikro-orm-plugin-installation.repository';
import { TypeOrmPluginInstallationRepository } from '../repositories/type-orm-plugin-installation.repository';

@Injectable()
export class PluginInstallationService extends TenantAwareCrudService<PluginInstallation> {
	constructor(
		public readonly typeOrmPluginInstallationRepository: TypeOrmPluginInstallationRepository,
		public readonly mikroOrmPluginInstallationRepository: MikroOrmPluginInstallationRepository
	) {
		super(typeOrmPluginInstallationRepository, mikroOrmPluginInstallationRepository);
	}
}
