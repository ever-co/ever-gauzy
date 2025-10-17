import { MikroOrmPluginInstallationRepository } from './mikro-orm-plugin-installation.repository';
import { MikroOrmPluginSourceRepository } from './mikro-orm-plugin-source.repository';
import { MikroOrmPluginVersionRepository } from './mikro-orm-plugin-version.repository';
import { MikroOrmPluginRepository } from './mikro-orm-plugin.repository';
import { MikroOrmPluginSettingRepository } from './mikro-orm-plugin-setting.repository';
import { MikroOrmPluginSubscriptionRepository } from './mikro-orm-plugin-subscription.repository';
import { MikroOrmPluginTenantRepository } from './tenant/mikro-orm-plugin-tenant.repository';
import { TypeOrmPluginTenantRepository } from './tenant/type-orm-plugin-tenant.repository';
import { TypeOrmPluginInstallationRepository } from './type-orm-plugin-installation.repository';
import { TypeOrmPluginSourceRepository } from './type-orm-plugin-source.repository';
import { TypeOrmPluginVersionRepository } from './type-orm-plugin-version.repository';
import { TypeOrmPluginRepository } from './type-orm-plugin.repository';
import { TypeOrmPluginSettingRepository } from './type-orm-plugin-setting.repository';
import { TypeOrmPluginSubscriptionRepository } from './type-orm-plugin-subscription.repository';
import { TypeOrmPluginCategoryRepository } from './type-orm-plugin-category.repository';
import { MikroOrmPluginCategoryRepository } from './mikro-orm-plugin-category.repository';

export const repositories = [
	TypeOrmPluginSourceRepository,
	TypeOrmPluginVersionRepository,
	TypeOrmPluginRepository,
	TypeOrmPluginInstallationRepository,
	TypeOrmPluginTenantRepository,
	TypeOrmPluginSettingRepository,
	TypeOrmPluginSubscriptionRepository,
	MikroOrmPluginSourceRepository,
	MikroOrmPluginVersionRepository,
	MikroOrmPluginRepository,
	MikroOrmPluginInstallationRepository,
	MikroOrmPluginTenantRepository,
	MikroOrmPluginSettingRepository,
	MikroOrmPluginSubscriptionRepository,
	TypeOrmPluginCategoryRepository,
	MikroOrmPluginCategoryRepository
];

// Export individual repositories
export * from './mikro-orm-plugin-installation.repository';
export * from './mikro-orm-plugin-source.repository';
export * from './mikro-orm-plugin-version.repository';
export * from './mikro-orm-plugin.repository';
export * from './mikro-orm-plugin-setting.repository';
export * from './mikro-orm-plugin-subscription.repository';
export * from './tenant/mikro-orm-plugin-tenant.repository';
export * from './tenant/type-orm-plugin-tenant.repository';
export * from './type-orm-plugin-installation.repository';
export * from './type-orm-plugin-source.repository';
export * from './type-orm-plugin-version.repository';
export * from './type-orm-plugin.repository';
export * from './type-orm-plugin-setting.repository';
export * from './type-orm-plugin-subscription.repository';
export * from './type-orm-plugin-category.repository';
export * from './mikro-orm-plugin-category.repository';
