import { Injectable } from '@nestjs/common';
import { PluginInstallation } from '../entities/plugin-installation.entity';
import { MikroOrmPluginInstallationRepository } from '../repositories/mikro-orm-plugin-installation.repository';
import { TypeOrmPluginInstallationRepository } from '../repositories/type-orm-plugin-installation.repository';
import { RegistryTenantAwareCrudService } from './registry-crud.service';

@Injectable()
export class PluginInstallationService extends RegistryTenantAwareCrudService<PluginInstallation> {
	constructor(
		public readonly typeOrmPluginInstallationRepository: TypeOrmPluginInstallationRepository,
		public readonly mikroOrmPluginInstallationRepository: MikroOrmPluginInstallationRepository
	) {
		super(typeOrmPluginInstallationRepository, mikroOrmPluginInstallationRepository);
	}
}
