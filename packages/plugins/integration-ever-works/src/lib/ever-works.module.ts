import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginCommonModule, RolePermissionModule } from '@gauzy/core';
import { EverWorksClientFactory } from './client/ever-works-client.factory';
import { EverWorksConnectionController } from './connection/ever-works-connection.controller';
import { EverWorksConnection } from './connection/ever-works-connection.entity';
import { EverWorksConnectionService } from './connection/ever-works-connection.service';
import { EverWorksHealthScheduler } from './connection/ever-works-health.scheduler';
import { EverWorksNotifier } from './connection/ever-works-notifier.service';
import { MikroOrmEverWorksConnectionRepository } from './connection/repository/mikro-orm-ever-works-connection.repository';
import { TypeOrmEverWorksConnectionRepository } from './connection/repository/type-orm-ever-works-connection.repository';
import { EverWorksCatalogService } from './ever-works-catalog.service';
import { readEverWorksConfig } from './ever-works-config';
import { EverWorksScopeService } from './ever-works-scope.service';
import { EverWorksController } from './ever-works.controller';
import { EverWorksGoalCapture, EverWorksGoalSubscriber, EverWorksKeyResultSubscriber, EverWorksKeyResultUpdateSubscriber } from './goals/ever-works-goal.signals';
import { EverWorksGoalsService } from './goals/ever-works-goals.service';
import { EverWorksIdeaTaskCapture } from './ideas/ever-works-idea-task.capture';
import { EverWorksInitiativeCapture, EverWorksInitiativeGoalSubscriber, EverWorksInitiativeSubscriber } from './initiatives/ever-works-initiative.signals';
import { EverWorksInitiativesController } from './initiatives/ever-works-initiatives.controller';
import { EverWorksInitiativesService } from './initiatives/ever-works-initiatives.service';
import { EverWorksIdeasService } from './ideas/ever-works-ideas.service';
import { EverWorksLifecycle } from './ever-works.lifecycle';
import { EVER_WORKS_CONFIG } from './ever-works.tokens';
import { EverWorksMappingController } from './mapping/ever-works-mapping.controller';
import { EverWorksMappingService } from './mapping/ever-works-mapping.service';
import { EverWorksMappingContextService } from './mapping/ever-works-mapping-context.service';
import { EverWorksAgentsService } from './people/ever-works-agents.service';
import { EverWorksPeopleController } from './people/ever-works-people.controller';
import { EverWorksPeopleService } from './people/ever-works-people.service';
import { EverWorksProjectsController } from './projects/ever-works-projects.controller';
import { EverWorksProjectsService } from './projects/ever-works-projects.service';
import { EverWorksTeamCapture, EverWorksTeamMemberSubscriber, EverWorksTeamSubscriber } from './teams/ever-works-team.signals';
import { EverWorksTeamsController } from './teams/ever-works-teams.controller';
import { EverWorksTeamsService } from './teams/ever-works-teams.service';
import { EverWorksLinkService } from './sync/links/ever-works-link.service';
import { EverWorksSyncController } from './sync/admin/ever-works-sync.controller';
import { EverWorksSyncStatusService } from './sync/admin/ever-works-sync-status.service';
import { EverWorksConflictsService } from './sync/conflicts/ever-works-conflicts.service';
import { EverWorksInitialSyncService } from './sync/initial/ever-works-initial-sync.service';
import { EverWorksSyncRun, MikroOrmEverWorksSyncRunRepository } from './sync/initial/ever-works-sync-run.entity';
import {
	EverWorksEntityLink,
	EverWorksInboundEvent,
	EverWorksOutboundChange,
	EverWorksSyncLog
} from './sync/entities/ever-works-sync.entities';
import {
	MikroOrmEverWorksEntityLinkRepository,
	MikroOrmEverWorksInboundEventRepository,
	MikroOrmEverWorksOutboundChangeRepository,
	MikroOrmEverWorksSyncLogRepository
} from './sync/entities/ever-works-sync.repositories';
import { EverWorksSyncLogService } from './sync/ever-works-sync-log.service';
import { EverWorksSyncLoop } from './sync/ever-works-sync.loop';
import { EverWorksFeedPoller } from './sync/inbound/ever-works-feed.poller';
import { EverWorksInboundApplier } from './sync/inbound/ever-works-inbound.applier';
import { EverWorksInboundStore } from './sync/inbound/ever-works-inbound.store';
import { EverWorksOutboundPusher } from './sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from './sync/outbound/ever-works-outbound.queue';
import { EverWorksTaskEventListener } from './sync/outbound/ever-works-task-event.listener';
import { EverWorksRateLimitGuard } from './sync/webhook/ever-works-rate-limit.guard';
import { EverWorksWebhookController } from './sync/webhook/ever-works-webhook.controller';

/** Registers the per-entity handlers with the applier and the pusher. */
@Injectable()
export class EverWorksHandlersRegistrar implements OnModuleInit {
	constructor(
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly loop: EverWorksSyncLoop,
		private readonly agents: EverWorksAgentsService,
		private readonly teams: EverWorksTeamsService,
		private readonly projects: EverWorksProjectsService,
		private readonly initialSync: EverWorksInitialSyncService
	) {}

	onModuleInit(): void {
		this.applier.register(this.agents);
		this.applier.register(this.teams);
		this.pusher.register(this.teams);
		this.loop.registerSweeper(this.teams);
		this.applier.register(this.projects);
		this.loop.registerSweeper(this.projects);
		// Initial sync and resync runs advance under the same lease (G-P1-10).
		this.loop.registerSweeper(this.initialSync);
	}
}

/** The entity subscribers the plugin adds to the ORMs (outbound triggers of records without a platform event). */
export const EVER_WORKS_SUBSCRIBERS = [
	EverWorksTeamSubscriber,
	EverWorksTeamMemberSubscriber,
	EverWorksGoalSubscriber,
	EverWorksKeyResultSubscriber,
	EverWorksKeyResultUpdateSubscriber,
	EverWorksInitiativeSubscriber,
	EverWorksInitiativeGoalSubscriber
];

/** Every table the plugin owns (its migrations create them). */
export const EVER_WORKS_ENTITIES = [EverWorksConnection, EverWorksEntityLink, EverWorksInboundEvent, EverWorksOutboundChange, EverWorksSyncLog, EverWorksSyncRun];

/**
 * The Ever Works integration module (`@gauzy/plugin-integration-ever-works`). Loaded only when
 * `EVER_WORKS_ENABLED=true` (see `isEverWorksEnabled`).
 *
 * Both ORMs are registered for every entity: the platform selects its ORM at boot, and the paired
 * repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(EVER_WORKS_ENTITIES),
		MikroOrmModule.forFeature(EVER_WORKS_ENTITIES),
		// Gauzy's tenant and permission guards of the management routes need the role permissions.
		RolePermissionModule,
		// The platform's event bus (TaskEvent) and command bus (project creation).
		PluginCommonModule,
		CqrsModule
	],
	controllers: [
		EverWorksController,
		EverWorksConnectionController,
		EverWorksMappingController,
		EverWorksPeopleController,
		EverWorksTeamsController,
		EverWorksProjectsController,
		EverWorksInitiativesController,
		EverWorksWebhookController,
		EverWorksSyncController
	],
	providers: [
		EverWorksCatalogService,
		EverWorksLifecycle,
		EverWorksScopeService,
		EverWorksClientFactory,
		EverWorksNotifier,
		EverWorksConnectionService,
		EverWorksHealthScheduler,
		EverWorksMappingService,
		EverWorksSyncLogService,
		EverWorksInboundStore,
		EverWorksFeedPoller,
		EverWorksInboundApplier,
		EverWorksOutboundQueue,
		EverWorksOutboundPusher,
		EverWorksTaskEventListener,
		EverWorksSyncLoop,
		EverWorksRateLimitGuard,
		EverWorksLinkService,
		EverWorksMappingContextService,
		EverWorksPeopleService,
		EverWorksAgentsService,
		EverWorksTeamsService,
		EverWorksProjectsService,
		EverWorksTeamCapture,
		EverWorksConflictsService,
		EverWorksInitialSyncService,
		EverWorksSyncStatusService,
		// Ideas ↔ Idea tasks (G-P2-3): registers itself with the applier and the pusher.
		EverWorksIdeasService,
		EverWorksIdeaTaskCapture,
		// Goals ↔ Goal + KeyResults (G-P2-1): registers itself with the applier and the pusher.
		EverWorksGoalsService,
		EverWorksGoalCapture,
		// Missions ↔ Strategic Initiatives (G-P2-2): registers itself with the applier and the pusher.
		EverWorksInitiativesService,
		EverWorksInitiativeCapture,
		EverWorksHandlersRegistrar,
		TypeOrmEverWorksConnectionRepository,
		MikroOrmEverWorksConnectionRepository,
		MikroOrmEverWorksEntityLinkRepository,
		MikroOrmEverWorksInboundEventRepository,
		MikroOrmEverWorksOutboundChangeRepository,
		MikroOrmEverWorksSyncLogRepository,
		MikroOrmEverWorksSyncRunRepository,
		{
			provide: EVER_WORKS_CONFIG,
			useFactory: () => {
				const logger = new Logger('EverWorks');
				return readEverWorksConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [
		EverWorksCatalogService,
		EverWorksConnectionService,
		EverWorksClientFactory,
		EverWorksScopeService,
		EverWorksMappingService,
		EverWorksInboundApplier,
		EverWorksOutboundPusher,
		EverWorksOutboundQueue,
		EverWorksSyncLogService,
		EverWorksConflictsService,
		EverWorksInitialSyncService,
		EVER_WORKS_CONFIG
	]
})
export class EverWorksModule {}
