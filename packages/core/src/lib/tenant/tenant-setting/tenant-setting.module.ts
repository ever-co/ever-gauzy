import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { FeatureModule } from '../../feature/feature.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantUiPreferencesController } from './tenant-ui-preferences.controller';
import { TenantSettingResolver } from './tenant-setting.resolver';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTenantSettingRepository } from './repository/type-orm-tenant-setting.repository';
import { MikroOrmTenantSettingRepository } from './repository/mikro-orm-tenant-setting.repository';

/**
 * The tenant's configuration: the settings rows, the document they are read as, and the UI flavour.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The two controllers beside it resolve the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through. Without it the
 * API boot fails on an unresolved dependency, which no static check sees.
 *
 * It is imported through `forwardRef` because the file graph already runs the other way: the feature
 * subscriber reaches the file-storage barrel, that barrel reaches `FileStorageModule`, and that module
 * imports this one. A direct import would therefore be evaluated in the middle of a cycle, where one of
 * the two module classes is not yet assigned — the deferred reference is what keeps the edge honest
 * regardless of which file the process loads first.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TenantSetting]),
		MikroOrmModule.forFeature([TenantSetting]),
		RolePermissionModule,
		forwardRef(() => FeatureModule),
		CqrsModule
	],
	controllers: [TenantSettingController, TenantUiPreferencesController],
	providers: [
		TenantSettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TenantSettingResolver,
		TypeOrmTenantSettingRepository,
		MikroOrmTenantSettingRepository,
		...CommandHandlers
	],
	exports: [TenantSettingService, TypeOrmTenantSettingRepository, MikroOrmTenantSettingRepository, CqrsModule]
})
export class TenantSettingModule {}