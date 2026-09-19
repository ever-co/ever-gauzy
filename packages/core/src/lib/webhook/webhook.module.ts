import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { GraphqlSubscriptionModule } from '../graphql/subscriptions';
import { EncryptionService } from '../common/encryption/encryption.service';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookSubscriptionController } from './webhook-subscription.controller';
import { WebhookResolver } from './webhook.resolver';
import { WebhookEventPublisher } from './webhook-event.publisher';
import { TypeOrmWebhookDeliveryRepository } from './repository/type-orm-webhook-delivery.repository';
import { TypeOrmWebhookSubscriptionRepository } from './repository/type-orm-webhook-subscription.repository';
import { MikroOrmWebhookDeliveryRepository } from './repository/mikro-orm-webhook-delivery.repository';
import { MikroOrmWebhookSubscriptionRepository } from './repository/mikro-orm-webhook-subscription.repository';

/**
 * The outbound webhook kernel: the endpoints an operator configures, and the log of what the platform
 * sent them.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the two
 * tables for whichever mapper the deployment runs, and each repository pair is provided here so a
 * service injected with one is resolved from the module that declares its table rather than from
 * whichever module happens to import this one first.
 *
 * **The controllers and the resolver are declared side by side, and that is the point of this
 * module.** A resolver is an ordinary provider and can only inject services its own module can reach,
 * so a domain that serves one resource over two protocols declares both surfaces here, beside the
 * services they call — and the GraphQL host discovers the resolver by scanning this module rather
 * than by listing the class itself. Neither surface owns a rule the other does not: both speak through
 * the two services below.
 *
 * **`RolePermissionModule` is imported for the guards.** A guard is a provider of whichever module
 * hosts the handler it protects, so the module that hosts these two controllers and this resolver has
 * to be able to reach the permission lookup those guards ask for — the API boot fails on an
 * unresolved dependency without it.
 *
 * **`GraphqlSubscriptionModule` is imported for the publisher, not for a resolver.** The two facts
 * this domain streams travel on the platform's own fan-out, so the module that owns the writers has
 * to reach `GraphqlPubSub` and the event catalogue. Importing it here — rather than in the composition
 * module alone — is what lets the publisher resolve its dependencies from the module that declares
 * it, and Nest's modules are singletons, so the composition module reaches the same instance.
 *
 * **The publisher and the resolver are exported as well as provided.** The publisher is what the two
 * services announce through, and the resolver is listed by the GraphQL host beside the other core
 * resolvers; a module that hands on what it declares is what makes both reachable without a second
 * instance over the same fact.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery]),
		MikroOrmModule.forFeature([WebhookSubscription, WebhookDelivery]),
		RolePermissionModule,
		GraphqlSubscriptionModule
	],
	controllers: [WebhookSubscriptionController, WebhookDeliveryController],
	providers: [
		WebhookSubscriptionService,
		WebhookDeliveryService,
		// The signing secret is encrypted at rest, and this is the only service that may read it back.
		EncryptionService,
		// The producers, declared beside the services that call them: a subscription is fed from one
		// place or it is fed inconsistently, and these are the two facts this domain streams.
		WebhookEventPublisher,
		WebhookResolver,
		TypeOrmWebhookSubscriptionRepository,
		MikroOrmWebhookSubscriptionRepository,
		TypeOrmWebhookDeliveryRepository,
		MikroOrmWebhookDeliveryRepository
	],
	exports: [
		WebhookSubscriptionService,
		WebhookDeliveryService,
		WebhookEventPublisher,
		WebhookResolver,
		TypeOrmWebhookSubscriptionRepository,
		MikroOrmWebhookSubscriptionRepository,
		TypeOrmWebhookDeliveryRepository,
		MikroOrmWebhookDeliveryRepository
	]
})
export class WebhookModule {}
