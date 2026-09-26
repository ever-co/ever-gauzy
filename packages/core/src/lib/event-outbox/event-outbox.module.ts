import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxService } from './event-outbox.service';
import { EventDeliveryEventPublisher } from './event-delivery.publisher';
import { EventOutboxController } from './event-outbox.controller';
import { EventDeliveryController } from './event-delivery.controller';
import { EventOutboxResolver } from './event-outbox.resolver';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';
import { MikroOrmEventDeliveryRepository } from './repository/mikro-orm-event-delivery.repository';
import { MikroOrmEventOutboxRepository } from './repository/mikro-orm-event-outbox.repository';

/**
 * The transactional outbox and the per-consumer delivery records.
 *
 * **The kernel gained two routes and a resolver, and the service is the one thing they share.** Both
 * controllers and the resolver call `EventOutboxService`, which owns the caller's scope, the two
 * operator moves and the announcement those moves produce — so neither surface can move a record
 * without the other's answer changing, and a subscriber cannot tell which protocol made the move.
 *
 * **`RolePermissionModule` is imported for the guards.** A guard is a provider of whichever module
 * hosts the handler it protects, so the permission guard the controllers and the resolver all carry
 * resolves its permission lookup from *this* module. `FeatureModule` is deliberately not imported:
 * it is global, so the feature service `FeatureFlagGuard` resolves through is available wherever a
 * guard runs, and an import here would be one edge in every module that declares a handler.
 *
 * **The subscription surface is named through a deferred `require`, and the deferral is load-bearing
 * rather than stylistic.** `GraphqlSubscriptionModule` imports *this* module — the consumer it
 * registers is what feeds durable events to subscribers — so an edge back is a cycle, and a cycle is
 * safe only when neither side reads the other while it is still being defined. A module-scope import
 * here would be read from inside that module's own evaluation when this one happens to be evaluated
 * first (`app.module.ts` lists this module before it), and the other import is a plain one, so the
 * reference it holds would be `undefined` at decoration time and the boot would fail with a message
 * about an undefined module rather than about a cycle. Requiring it inside `forwardRef` moves both
 * the read and the resolution to the moment Nest scans the graph, by which time every module class
 * exists — the same arrangement `graphql/additional-resolver-modules.ts` uses for the zones it must
 * not pull into a barrel. Nest resolves the resulting cycle itself: the scanner adds each edge by
 * token and the module-distance pass skips an edge that closes a cycle.
 *
 * **The publisher is provided here, beside the service that calls it.** A publisher can only inject
 * what its own module can reach, and this module reaches `GraphqlPubSub` and the event catalogue
 * through the import above; the service injects the publisher, so a process that hosts no GraphQL
 * endpoint writes the same rows and announces nothing.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EventOutbox, EventDelivery]),
		MikroOrmModule.forFeature([EventOutbox, EventDelivery]),
		forwardRef(() => require('../graphql/subscriptions/graphql-subscription.module').GraphqlSubscriptionModule),
		RolePermissionModule
	],
	controllers: [EventOutboxController, EventDeliveryController],
	providers: [
		EventOutboxService,
		EventConsumerRegistry,
		// The streamed fact's producer collaborator: it declares the event at bootstrap and publishes
		// each move the service makes.
		EventDeliveryEventPublisher,
		// The GraphQL view of the same resource pair: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EventOutboxResolver,
		TypeOrmEventOutboxRepository,
		MikroOrmEventOutboxRepository,
		TypeOrmEventDeliveryRepository,
		MikroOrmEventDeliveryRepository
	],
	exports: [
		EventOutboxService,
		EventConsumerRegistry,
		EventDeliveryEventPublisher,
		EventOutboxResolver,
		TypeOrmEventOutboxRepository,
		MikroOrmEventOutboxRepository,
		TypeOrmEventDeliveryRepository,
		MikroOrmEventDeliveryRepository
	]
})
export class EventOutboxModule {}
