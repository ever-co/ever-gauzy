import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FeatureModule } from '../feature/feature.module';
import { IntegrationTenantController } from './integration-tenant.controller';
import { IntegrationTenantResolver } from './integration-tenant.resolver';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationSettingModule } from './../integration-setting/integration-setting.module';
import { IntegrationEntitySettingModule } from './../integration-entity-setting/integration-entity-setting.module';
import { RoleModule } from '../role/role.module';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmIntegrationTenantRepository } from './repository/type-orm-integration-tenant.repository';
import { MikroOrmIntegrationTenantRepository } from './repository/mikro-orm-integration-tenant.repository';

/**
 * The integrations a tenant has connected.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationTenant]),
		MikroOrmModule.forFeature([IntegrationTenant]),
		RoleModule,
		RolePermissionModule,
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationEntitySettingModule),
		CqrsModule,
		EventBusModule,
		FeatureModule
	],
	controllers: [IntegrationTenantController],
	providers: [
		IntegrationTenantService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// service and the command bus its own module can reach, and this module is what reaches them.
		IntegrationTenantResolver,
		TypeOrmIntegrationTenantRepository,
		MikroOrmIntegrationTenantRepository,
		...CommandHandlers
	],
	exports: [IntegrationTenantService, TypeOrmIntegrationTenantRepository, MikroOrmIntegrationTenantRepository]
})
export class IntegrationTenantModule {}