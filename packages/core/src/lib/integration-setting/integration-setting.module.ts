import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureModule } from '../feature/feature.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingResolver } from './integration-setting.resolver';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TypeOrmIntegrationSettingRepository } from './repository/type-orm-integration-setting.repository';
import { MikroOrmIntegrationSettingRepository } from './repository/mikro-orm-integration-setting.repository';

/**
 * The credentials of a configured integration.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated
 * by `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it
 * protects — so this module is what has to reach the feature service the guard resolves through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationSetting]),
		MikroOrmModule.forFeature([IntegrationSetting]),
		RolePermissionModule,
		CqrsModule,
		FeatureModule
	],
	controllers: [IntegrationSettingController],
	providers: [
		IntegrationSettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		IntegrationSettingResolver,
		TypeOrmIntegrationSettingRepository,
		MikroOrmIntegrationSettingRepository,
		...CommandHandlers
	],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationSettingService, TypeOrmIntegrationSettingRepository, MikroOrmIntegrationSettingRepository]
})
export class IntegrationSettingModule {}
