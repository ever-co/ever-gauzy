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
import { AsanaTaskBaseline, MikroOrmAsanaTaskBaselineRepository, TypeOrmAsanaTaskBaselineRepository } from './entities/asana-task-baseline.entity';
import { AsanaSyncConflict, MikroOrmAsanaSyncConflictRepository, TypeOrmAsanaSyncConflictRepository } from './entities/asana-sync-conflict.entity';
import { AsanaSyncRun, MikroOrmAsanaSyncRunRepository, TypeOrmAsanaSyncRunRepository } from './entities/asana-sync-run.entity';
import { AsanaProjectMapping, MikroOrmAsanaProjectMappingRepository, TypeOrmAsanaProjectMappingRepository } from './entities/asana-project-mapping.entity';
import { AsanaAuthorizationController } from './asana-authorization.controller';
import { AsanaCatalogService } from './asana-catalog.service';
import { readAsanaConfig } from './asana-config';
import { AsanaMappingService } from './asana-mapping.service';
import { AsanaOAuthStateService } from './asana-oauth-state.service';
import { AsanaSyncConflictService } from './asana-sync-conflict.service';
import { AsanaSyncRunService } from './asana-sync-run.service';
import { AsanaTenantService } from './asana-tenant.service';
import { AsanaWebhookController } from './asana-webhook.controller';
import { AsanaController } from './asana.controller';
import { ASANA_CONFIG } from './asana.constants';
import { AsanaLifecycle } from './asana.lifecycle';
import { AsanaEventSubscriber } from './sync/asana-event.subscriber';
import { AsanaSyncService } from './sync/asana-sync.service';
import { AsanaTaskDetailsService } from './sync/asana-task-details.service';
import { AsanaImportSweepService } from './maintenance/asana-import-sweep.service';

/** Every table the plugin owns (its migration creates them). */
export const ASANA_ENTITIES = [AsanaProjectMapping, AsanaSyncRun, AsanaSyncConflict, AsanaTaskBaseline];

/**
 * The Asana integration module (`@gauzy/plugin-integration-asana`). Loaded only when `ASANA_ENABLED=true`
 * (see `isAsanaEnabled`). Both ORMs are registered for every entity: the platform selects its ORM at boot,
 * and the paired repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(ASANA_ENTITIES),
		MikroOrmModule.forFeature(ASANA_ENTITIES),
		RolePermissionModule,
		PluginCommonModule,
		CqrsModule,
		IntegrationModule,
		IntegrationTenantModule,
		IntegrationSettingModule,
		IntegrationMapModule,
		OrganizationProjectModule,
		EmployeeModule
	],
	// The callback and the webhook before the id routes: registered after, `GET /callback` would be taken by
	// `GET /:integrationId` (and refused by its guard and its UUID check).
	controllers: [AsanaAuthorizationController, AsanaWebhookController, AsanaController],
	providers: [
		AsanaCatalogService,
		AsanaLifecycle,
		AsanaOAuthStateService,
		AsanaTenantService,
		AsanaMappingService,
		AsanaSyncRunService,
		AsanaSyncConflictService,
		AsanaSyncService,
		AsanaTaskDetailsService,
		AsanaImportSweepService,
		AsanaEventSubscriber,
		TypeOrmAsanaProjectMappingRepository,
		MikroOrmAsanaProjectMappingRepository,
		TypeOrmAsanaSyncRunRepository,
		MikroOrmAsanaSyncRunRepository,
		TypeOrmAsanaSyncConflictRepository,
		MikroOrmAsanaSyncConflictRepository,
		TypeOrmAsanaTaskBaselineRepository,
		MikroOrmAsanaTaskBaselineRepository,
		{
			provide: ASANA_CONFIG,
			useFactory: () => {
				const logger = new Logger('Asana');
				return readAsanaConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [AsanaCatalogService, AsanaTenantService, AsanaMappingService, AsanaSyncService, AsanaImportSweepService, ASANA_CONFIG]
})
export class AsanaModule {}
