import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeModule, GraphqlSubscriptionModule, RolePermissionModule } from '@gauzy/core';
import { REALTIME_EVENT_HANDLERS } from './handlers/realtime-event.handlers';
import { RealtimeResolver } from './graphql/realtime.resolver';
import { RealtimeAudience } from './realtime-audience';
import { RealtimeCatalogue } from './realtime-catalogue';
import { RealtimeCatchUpService, RealtimeSettleHorizon } from './realtime-catch-up.service';
import { RealtimeHintsService } from './realtime-hints.service';
import { RealtimePresenceStore } from './realtime-presence.store';
import { RealtimeReplayWatermarkService } from './realtime-replay-watermark.service';
import { RealtimeRetentionService } from './realtime-retention.service';
import { RealtimeSignalsService } from './realtime-signals.service';
import { RealtimeController } from './realtime.controller';

/**
 * The real-time channel (`@gauzy/plugin-realtime`), loaded only when `GAUZY_REALTIME_ENABLED=true`.
 *
 * It listens to the platform's in-process facts and files change hints on the event outbox, publishes presence
 * and typing signals on the subscription pub/sub, serves the catch-up and status routes, and resolves
 * `Subscription.collaborationEvents`. Its own tables hold per-connection presence (`realtime_presence`) and the
 * replay watermark (`realtime_replay_watermark`), both read and written through the platform's `DataSource`. Both deliveries put every event to the audience checks
 * (`RealtimeAudience`) in the subscriber's request context before handing it over.
 */
@Module({
	imports: [
		// The CQRS bus the comment, mention and notification facts are published on.
		CqrsModule,
		// The pub/sub the signals are published to and the subscription field reads from.
		GraphqlSubscriptionModule,
		// Mentions resolve employee → user (presence writes the employee row through the `DataSource` itself).
		EmployeeModule,
		// The tenant and permission guards of the routes need the role permissions.
		RolePermissionModule
	],
	controllers: [RealtimeController],
	providers: [
		RealtimeCatalogue,
		RealtimeAudience,
		RealtimeHintsService,
		RealtimePresenceStore,
		RealtimeSignalsService,
		RealtimeReplayWatermarkService,
		// Prunes the replayed collaboration events past the FR-3 window; off unless GAUZY_REALTIME_RETENTION_ENABLED=true.
		RealtimeRetentionService,
		RealtimeSettleHorizon,
		RealtimeCatchUpService,
		// Listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is never
		// registered, and the schema would advertise a field nothing resolves.
		RealtimeResolver,
		...REALTIME_EVENT_HANDLERS
	],
	exports: [RealtimeHintsService, RealtimeSignalsService, RealtimeCatalogue, RealtimeReplayWatermarkService]
})
export class RealtimeModule {}
