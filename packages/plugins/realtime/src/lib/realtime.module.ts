import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeModule, GraphqlSubscriptionModule, RolePermissionModule } from '@gauzy/core';
import { REALTIME_EVENT_HANDLERS } from './handlers/realtime-event.handlers';
import { RealtimeResolver } from './graphql/realtime.resolver';
import { RealtimeAudience } from './realtime-audience';
import { RealtimeCatalogue } from './realtime-catalogue';
import { RealtimeCatchUpService } from './realtime-catch-up.service';
import { RealtimeHintsService } from './realtime-hints.service';
import { RealtimeSignalsService } from './realtime-signals.service';
import { RealtimeController } from './realtime.controller';

/**
 * The real-time channel (`@gauzy/plugin-realtime`), loaded only when `GAUZY_REALTIME_ENABLED=true`.
 *
 * Owns no table. It listens to the platform's in-process facts and files change hints on the event outbox,
 * publishes presence and typing signals on the subscription pub/sub, serves the catch-up and status routes,
 * and resolves `Subscription.collaborationEvents`. Both deliveries put every event to the audience checks
 * (`RealtimeAudience`) in the subscriber's request context before handing it over.
 */
@Module({
	imports: [
		// The CQRS bus the comment, mention and notification facts are published on.
		CqrsModule,
		// The pub/sub the signals are published to and the subscription field reads from.
		GraphqlSubscriptionModule,
		// Presence is persisted on the employee through the existing heartbeat; mentions resolve employee → user.
		EmployeeModule,
		// The tenant and permission guards of the routes need the role permissions.
		RolePermissionModule
	],
	controllers: [RealtimeController],
	providers: [
		RealtimeCatalogue,
		RealtimeAudience,
		RealtimeHintsService,
		RealtimeSignalsService,
		RealtimeCatchUpService,
		// Listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is never
		// registered, and the schema would advertise a field nothing resolves.
		RealtimeResolver,
		...REALTIME_EVENT_HANDLERS
	],
	exports: [RealtimeHintsService, RealtimeSignalsService, RealtimeCatalogue]
})
export class RealtimeModule {}
