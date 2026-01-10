import { MikroOrmPluginBillingRepository } from './mikro-orm-plugin-billing.repository';
import { MikroOrmPluginCategoryRepository } from './mikro-orm-plugin-category.repository';
import { MikroOrmPluginInstallationRepository } from './mikro-orm-plugin-installation.repository';
import { MikroOrmPluginSettingRepository } from './mikro-orm-plugin-setting.repository';
import { MikroOrmPluginSourceRepository } from './mikro-orm-plugin-source.repository';
import { MikroOrmPluginSubscriptionPlanRepository } from './mikro-orm-plugin-subscription-plan.reposittory';
import { MikroOrmPluginSubscriptionRepository } from './mikro-orm-plugin-subscription.repository';
import { MikroOrmPluginTagRepository } from './mikro-orm-plugin-tag.repository';
import { MikroOrmPluginVersionRepository } from './mikro-orm-plugin-version.repository';
import { MikroOrmPluginRepository } from './mikro-orm-plugin.repository';
import { MikroOrmPluginTenantRepository } from './tenant/mikro-orm-plugin-tenant.repository';
import { TypeOrmPluginTenantRepository } from './tenant/type-orm-plugin-tenant.repository';
import { TypeOrmPluginBillingRepository } from './type-orm-plugin-billing.repository';
import { TypeOrmPluginCategoryRepository } from './type-orm-plugin-category.repository';
import { TypeOrmPluginInstallationRepository } from './type-orm-plugin-installation.repository';
import { TypeOrmPluginSettingRepository } from './type-orm-plugin-setting.repository';
import { TypeOrmPluginSourceRepository } from './type-orm-plugin-source.repository';
import { TypeOrmPluginSubscriptionPlanRepository } from './type-orm-plugin-subscription-plan.reposittory';
import { TypeOrmPluginSubscriptionRepository } from './type-orm-plugin-subscription.repository';
import { TypeOrmPluginTagRepository } from './type-orm-plugin-tag.repository';
import { TypeOrmPluginVersionRepository } from './type-orm-plugin-version.repository';
import { TypeOrmPluginRepository } from './type-orm-plugin.repository';

export const repositories = [
	TypeOrmPluginSourceRepository,
	TypeOrmPluginVersionRepository,
	TypeOrmPluginRepository,
	TypeOrmPluginInstallationRepository,
	TypeOrmPluginTenantRepository,
	TypeOrmPluginSettingRepository,
	TypeOrmPluginSubscriptionRepository,
	TypeOrmPluginTagRepository,
	MikroOrmPluginSourceRepository,
	MikroOrmPluginVersionRepository,
	MikroOrmPluginRepository,
	MikroOrmPluginInstallationRepository,
	MikroOrmPluginTenantRepository,
	MikroOrmPluginSettingRepository,
	MikroOrmPluginSubscriptionRepository,
	MikroOrmPluginTagRepository,
	TypeOrmPluginBillingRepository,
	MikroOrmPluginBillingRepository,
	TypeOrmPluginCategoryRepository,
	MikroOrmPluginCategoryRepository,
	MikroOrmPluginSubscriptionPlanRepository,
	TypeOrmPluginSubscriptionPlanRepository
];

// Export individual repositories
export * from './mikro-orm-plugin-billing.repository';
export * from './mikro-orm-plugin-category.repository';
export * from './mikro-orm-plugin-installation.repository';
export * from './mikro-orm-plugin-setting.repository';
export * from './mikro-orm-plugin-source.repository';
export * from './mikro-orm-plugin-subscription-plan.reposittory';
export * from './mikro-orm-plugin-subscription.repository';
export * from './mikro-orm-plugin-tag.repository';
export * from './mikro-orm-plugin-version.repository';
export * from './mikro-orm-plugin.repository';
export * from './tenant/mikro-orm-plugin-tenant.repository';
export * from './tenant/type-orm-plugin-tenant.repository';
export * from './type-orm-plugin-billing.repository';
export * from './type-orm-plugin-category.repository';
export * from './type-orm-plugin-installation.repository';
export * from './type-orm-plugin-setting.repository';
export * from './type-orm-plugin-source.repository';
export * from './type-orm-plugin-subscription-plan.reposittory';
export * from './type-orm-plugin-subscription.repository';
export * from './type-orm-plugin-tag.repository';
export * from './type-orm-plugin-version.repository';
export * from './type-orm-plugin.repository';
