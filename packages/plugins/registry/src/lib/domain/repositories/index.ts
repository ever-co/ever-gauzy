import { MikroOrmPluginInstallationRepository } from './mikro-orm-plugin-installation.repository';
import { MikroOrmPluginSourceRepository } from './mikro-orm-plugin-source.repository';
import { MikroOrmPluginVersionRepository } from './mikro-orm-plugin-version.repository';
import { MikroOrmPluginRepository } from './mikro-orm-plugin.repository';
import { TypeOrmPluginInstallationRepository } from './type-orm-plugin-installation.repository';
import { TypeOrmPluginSourceRepository } from './type-orm-plugin-source.repository';
import { TypeOrmPluginVersionRepository } from './type-orm-plugin-version.repository';
import { TypeOrmPluginRepository } from './type-orm-plugin.repository';

export const repositories = [
	TypeOrmPluginSourceRepository,
	TypeOrmPluginVersionRepository,
	TypeOrmPluginRepository,
	TypeOrmPluginInstallationRepository,
	MikroOrmPluginSourceRepository,
	MikroOrmPluginVersionRepository,
	MikroOrmPluginRepository,
	MikroOrmPluginInstallationRepository
];
