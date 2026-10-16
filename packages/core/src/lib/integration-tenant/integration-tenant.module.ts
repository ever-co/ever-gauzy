import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../event-bus/event-bus.module';
import { EventOutboxModule } from '../event-outbox/event-outbox.module';
import { GraphqlSubscriptionModule } from '../graphql/subscriptions';
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
import { IntegrationTenantSyncService } from './integration-tenant-sync.service';
import { IntegrationTenantSyncResolver } from './integration-tenant-sync.resolver';

/**
 * The integrations a tenant has connected.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through.
 *
 * `EventOutboxModule` and `GraphqlSubscriptionModule` are imported for the synchronisation fact: every integration
 * ends a run through `IntegrationTenantSyncService`, which stamps the connection and appends
 * `integration_tenant.synced` in one transaction and declares the name with the subscription catalogue, and
 * `IntegrationTenantSyncResolver` streams it as `Subscription.integrationSyncCompleted`. The service is exported, so
 * an integration package that imports this module can end its runs through it.
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
		FeatureModule,
		EventOutboxModule,
		GraphqlSubscriptionModule
	],
	controllers: [IntegrationTenantController],
	providers: [
		IntegrationTenantService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// service and the command bus its own module can reach, and this module is what reaches them.
		IntegrationTenantResolver,
		IntegrationTenantSyncService,
		IntegrationTenantSyncResolver,
		TypeOrmIntegrationTenantRepository,
		MikroOrmIntegrationTenantRepository,
		...CommandHandlers
	],
	exports: [
		IntegrationTenantService,
		IntegrationTenantSyncService,
		TypeOrmIntegrationTenantRepository,
		MikroOrmIntegrationTenantRepository
	]
})
export class IntegrationTenantModule {}