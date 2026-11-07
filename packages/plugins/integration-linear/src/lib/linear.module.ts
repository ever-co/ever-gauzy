import { Logger, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	EmployeeModule,
	IntegrationMapModule,
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	OrganizationProjectModule,
	PluginCommonModule,
	RolePermissionModule
} from '@gauzy/core';
import { LinearSyncRun, MikroOrmLinearSyncRunRepository, TypeOrmLinearSyncRunRepository } from './entities/linear-sync-run.entity';
import { LinearTeamMapping, MikroOrmLinearTeamMappingRepository, TypeOrmLinearTeamMappingRepository } from './entities/linear-team-mapping.entity';
import { LinearAuthorizationController } from './linear-authorization.controller';
import { LinearCatalogService } from './linear-catalog.service';
import { readLinearConfig } from './linear-config';
import { LinearMappingService } from './linear-mapping.service';
import { LinearOAuthStateService } from './linear-oauth-state.service';
import { LinearSyncRunService } from './linear-sync-run.service';
import { LinearTenantService } from './linear-tenant.service';
import { LinearWebhookController } from './linear-webhook.controller';
import { LinearController } from './linear.controller';
import { LINEAR_CONFIG } from './linear.constants';
import { LinearLifecycle } from './linear.lifecycle';
import { LinearEventSubscriber } from './sync/linear-event.subscriber';
import { LinearSyncService } from './sync/linear-sync.service';

/** Every table the plugin owns (its migration creates them). */
export const LINEAR_ENTITIES = [LinearTeamMapping, LinearSyncRun];

/**
 * The Linear integration module (`@gauzy/plugin-integration-linear`). Loaded only when `LINEAR_ENABLED=true`
 * (see `isLinearEnabled`). Both ORMs are registered for every entity: the platform selects its ORM at
 * boot, and the paired repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(LINEAR_ENTITIES),
		MikroOrmModule.forFeature(LINEAR_ENTITIES),
		// The tenant and permission guards of the management routes need the role permissions.
		RolePermissionModule,
		// The platform's event bus (TaskEvent) and command bus (the id-map sync commands).
		PluginCommonModule,
		CqrsModule,
		// The integration framework: the catalogue, the connected instance, its settings and id maps.
		IntegrationModule,
		IntegrationTenantModule,
		IntegrationSettingModule,
		IntegrationMapModule,
		// What the sync resolves: projects and employees by e-mail (statuses and priorities are read directly).
		OrganizationProjectModule,
		EmployeeModule
	],
	// The callback and the webhook before the id routes: registered after, `GET /callback` would be taken by
	// `GET /:integrationId` (and refused by its guard and its UUID check).
	controllers: [LinearAuthorizationController, LinearWebhookController, LinearController],
	providers: [
		LinearCatalogService,
		LinearLifecycle,
		LinearOAuthStateService,
		LinearTenantService,
		LinearMappingService,
		LinearSyncRunService,
		LinearSyncService,
		LinearEventSubscriber,
		TypeOrmLinearTeamMappingRepository,
		MikroOrmLinearTeamMappingRepository,
		TypeOrmLinearSyncRunRepository,
		MikroOrmLinearSyncRunRepository,
		{
			provide: LINEAR_CONFIG,
			useFactory: () => {
				const logger = new Logger('Linear');
				return readLinearConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [LinearCatalogService, LinearTenantService, LinearMappingService, LinearSyncService, LINEAR_CONFIG]
})
export class LinearModule {}
