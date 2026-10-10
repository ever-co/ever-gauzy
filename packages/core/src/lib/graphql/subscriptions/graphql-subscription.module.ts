import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventBusModule } from '../../event-bus/event-bus.module';
import { EventOutboxModule } from '../../event-outbox/event-outbox.module';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { GraphqlSubscriptionBusBridge } from './subscription-bus-bridge';
import { GraphqlSubscriptionConsumer } from './subscription-consumer';
import { GraphqlSubscriptionHub } from './subscription-hub.service';
import { SubscriptionAuthorizer } from './subscription-scope';
import { SubscriptionCatalogue } from './subscription-catalogue';

/**
 * The subscription surface.
 *
 * Everything a subscription needs is provided here and nothing else is asked of the application: the
 * fan-out, the catalogue of streamable events, the delivery decision, the hub that owns open
 * subscriptions, the outbox consumer that feeds it durable events and the bridge that feeds it the
 * in-process ones.
 *
 * A resolver does not depend on any of it beyond `GraphqlPubSub`: a domain publishes an event, or
 * declares how an existing event maps to a subscription envelope, and the delivery, the limits and
 * the authorisation are the kernel's business rather than each domain's.
 */
@Module({
	imports: [
		// The two buses a domain may already be publishing on, so the bridge can follow either.
		EventBusModule,
		CqrsModule,
		// The dispatcher's consumer registry, which is how a durable event reaches a subscriber.
		EventOutboxModule
	],
	providers: [
		GraphqlPubSub,
		SubscriptionCatalogue,
		SubscriptionAuthorizer,
		GraphqlSubscriptionHub,
		GraphqlSubscriptionConsumer,
		GraphqlSubscriptionBusBridge
	],
	exports: [
		GraphqlPubSub,
		SubscriptionCatalogue,
		SubscriptionAuthorizer,
		GraphqlSubscriptionHub,
		GraphqlSubscriptionConsumer,
		GraphqlSubscriptionBusBridge
	]
})
export class GraphqlSubscriptionModule {}
