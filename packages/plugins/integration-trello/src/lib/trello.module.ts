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
import { TrelloCardBaseline, MikroOrmTrelloCardBaselineRepository, TypeOrmTrelloCardBaselineRepository } from './entities/trello-card-baseline.entity';
import { TrelloSyncConflict, MikroOrmTrelloSyncConflictRepository, TypeOrmTrelloSyncConflictRepository } from './entities/trello-sync-conflict.entity';
import { TrelloSyncRun, MikroOrmTrelloSyncRunRepository, TypeOrmTrelloSyncRunRepository } from './entities/trello-sync-run.entity';
import { TrelloBoardMapping, MikroOrmTrelloBoardMappingRepository, TypeOrmTrelloBoardMappingRepository } from './entities/trello-board-mapping.entity';
import { TrelloCatalogService } from './trello-catalog.service';
import { readTrelloConfig } from './trello-config';
import { TrelloConnectStateService } from './trello-connect-state.service';
import { TrelloMappingService } from './trello-mapping.service';
import { TrelloSyncConflictService } from './trello-sync-conflict.service';
import { TrelloSyncRunService } from './trello-sync-run.service';
import { TrelloTenantService } from './trello-tenant.service';
import { TrelloWebhookController } from './trello-webhook.controller';
import { TrelloController } from './trello.controller';
import { TRELLO_CONFIG } from './trello.constants';
import { TrelloLifecycle } from './trello.lifecycle';
import { TrelloEventSubscriber } from './sync/trello-event.subscriber';
import { TrelloSyncService } from './sync/trello-sync.service';
import { TrelloCardDetailsService } from './sync/trello-card-details.service';
import { TrelloImportSweepService } from './maintenance/trello-import-sweep.service';

/** Every table the plugin owns (its migration creates them). */
export const TRELLO_ENTITIES = [TrelloBoardMapping, TrelloSyncRun, TrelloSyncConflict, TrelloCardBaseline];

/**
 * The Trello integration module (`@gauzy/plugin-integration-trello`). Loaded only when `TRELLO_ENABLED=true`
 * (see `isTrelloEnabled`). Both ORMs are registered for every entity: the platform selects its ORM at boot,
 * and the paired repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(TRELLO_ENTITIES),
		MikroOrmModule.forFeature(TRELLO_ENTITIES),
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
	// The webhook (public, under its own `/webhook` prefix) before the management routes, whose `/:integrationId`
	// routes would otherwise take a request of a fixed path registered after them.
	controllers: [TrelloWebhookController, TrelloController],
	providers: [
		TrelloCatalogService,
		TrelloLifecycle,
		TrelloConnectStateService,
		TrelloTenantService,
		TrelloMappingService,
		TrelloSyncRunService,
		TrelloSyncConflictService,
		TrelloSyncService,
		TrelloCardDetailsService,
		TrelloImportSweepService,
		TrelloEventSubscriber,
		TypeOrmTrelloBoardMappingRepository,
		MikroOrmTrelloBoardMappingRepository,
		TypeOrmTrelloSyncRunRepository,
		MikroOrmTrelloSyncRunRepository,
		TypeOrmTrelloSyncConflictRepository,
		MikroOrmTrelloSyncConflictRepository,
		TypeOrmTrelloCardBaselineRepository,
		MikroOrmTrelloCardBaselineRepository,
		{
			provide: TRELLO_CONFIG,
			useFactory: () => {
				const logger = new Logger('Trello');
				return readTrelloConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [TrelloCatalogService, TrelloTenantService, TrelloMappingService, TrelloSyncService, TrelloImportSweepService, TRELLO_CONFIG]
})
export class TrelloModule {}
