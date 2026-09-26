import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureModule } from '../feature/feature.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingResolver } from './integration-entity-setting.resolver';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';
import { TypeOrmIntegrationEntitySettingRepository } from './repository/type-orm-integration-entity-setting.repository';
import { MikroOrmIntegrationEntitySettingRepository } from './repository/mikro-orm-integration-entity-setting.repository';

/**
 * What each configured integration synchronises.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySetting]),
		MikroOrmModule.forFeature([IntegrationEntitySetting]),
		forwardRef(() => IntegrationTenantModule),
		RolePermissionModule,
		CqrsModule,
		FeatureModule
	],
	controllers: [IntegrationEntitySettingController],
	providers: [
		IntegrationEntitySettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// command bus its own module can reach, and this module is what reaches it.
		IntegrationEntitySettingResolver,
		TypeOrmIntegrationEntitySettingRepository,
		MikroOrmIntegrationEntitySettingRepository,
		...CommandHandlers
	],
	exports: [IntegrationEntitySettingService]
})
export class IntegrationEntitySettingModule {}