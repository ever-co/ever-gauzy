import { Body, Controller, Get, Header, HttpCode, HttpStatus, Optional, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
	IRealtimeCatchUp,
	IRealtimePresence,
	IRealtimeStatus,
	IRealtimeTypingSignal,
	PermissionsEnum,
	REALTIME_MAX_TYPING_RECIPIENTS,
	REALTIME_SIGNAL_EVENTS
} from '@gauzy/contracts';
import {
	eventOutboxDispatchMode,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	SubscriptionCatalogue,
	TenantPermissionGuard,
	UseValidationPipe
} from '@gauzy/core';
import { RealtimeCatchUpQueryDTO, RealtimePresenceDTO, RealtimeTypingDTO } from './dto/realtime.dto';
import { collaborationEventNames, collaborationReplayNames } from './graphql/realtime-envelope';
import { RealtimeCatalogue } from './realtime-catalogue';
import { RealtimeCatchUpService } from './realtime-catch-up.service';
import { describeRealtimeDelivery, isSingleApiProcess } from './realtime-delivery';
import { RealtimeSignalsService } from './realtime-signals.service';
import { REALTIME_ROUTE_PREFIX } from './realtime.constants';

/**
 * `/api/realtime/*`: the REST half of the channel. Every route needs a signed-in user of the tenant with
 * `REALTIME_SUBSCRIBE`; the subject is always the caller, never a parameter. Answers are `Cache-Control:
 * no-store` (they are one user's own).
 */
@ApiTags('Realtime')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.REALTIME_SUBSCRIBE)
@Controller(REALTIME_ROUTE_PREFIX)
export class RealtimeController {
	constructor(
		private readonly catalogue: RealtimeCatalogue,
		private readonly signals: RealtimeSignalsService,
		private readonly catchUp: RealtimeCatchUpService,
		@Optional() private readonly subscriptions?: SubscriptionCatalogue,
		@Optional() private readonly pubSub?: GraphqlPubSub
	) {}

	@Get('/status')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Whether this process serves subscriptions, and the events a client may select.' })
	status(): IRealtimeStatus {
		// The same names the subscription offers and the catch-up replays: the channel's own, plus the chat and
		// inbox names those plugins declared when they loaded.
		const declared = this.subscriptions?.names() ?? [];
		const signals = new Set<string>(REALTIME_SIGNAL_EVENTS);
		return {
			enabled: true,
			subscriptions: this.catalogue.servesSubscriptions,
			events: collaborationReplayNames(declared),
			signals: collaborationEventNames(declared).filter((name) => signals.has(name)),
			maxTypingRecipients: REALTIME_MAX_TYPING_RECIPIENTS,
			// Whether a client may rely on pushed events instead of polling (see `describeRealtimeDelivery`).
			delivery: describeRealtimeDelivery(
				eventOutboxDispatchMode(),
				this.pubSub?.sharedAcrossProcesses ?? false,
				isSingleApiProcess()
			)
		};
	}

	@Get('/events')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Catch up: my collaboration events since a time, from the outbox (after a reconnect).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The events, the cursor to continue from, and whether to resync.' })
	events(@Query() query: RealtimeCatchUpQueryDTO): Promise<IRealtimeCatchUp> {
		return this.catchUp.catchUp(query);
	}

	@Post('/presence')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Report my presence (active, idle, away, offline); the organization is told.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The signed-in user has no employee record.' })
	presence(@Body() body: RealtimePresenceDTO): Promise<IRealtimePresence> {
		return this.signals.publishPresence(body);
	}

	@Post('/typing')
	@HttpCode(HttpStatus.ACCEPTED)
	@Throttle({ default: { limit: 300, ttl: 60_000 } })
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Tell the named users that I am typing in a conversation (ephemeral, rate-limited).' })
	typing(@Body() body: RealtimeTypingDTO): Promise<IRealtimeTypingSignal> {
		return this.signals.publishTyping(body);
	}
}
