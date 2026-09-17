import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EncryptionService } from '../common/encryption/encryption.service';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { TypeOrmWebhookDeliveryRepository } from './repository/type-orm-webhook-delivery.repository';
import { TypeOrmWebhookSubscriptionRepository } from './repository/type-orm-webhook-subscription.repository';
import { MikroOrmWebhookDeliveryRepository } from './repository/mikro-orm-webhook-delivery.repository';
import { MikroOrmWebhookSubscriptionRepository } from './repository/mikro-orm-webhook-subscription.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery]),
		MikroOrmModule.forFeature([WebhookSubscription, WebhookDelivery])
	],
	providers: [
		WebhookSubscriptionService,
		WebhookDeliveryService,
		// The signing secret is encrypted at rest, and this is the only service that may read it back.
		EncryptionService,
		TypeOrmWebhookSubscriptionRepository,
		MikroOrmWebhookSubscriptionRepository,
		TypeOrmWebhookDeliveryRepository,
		MikroOrmWebhookDeliveryRepository
	],
	exports: [
		WebhookSubscriptionService,
		WebhookDeliveryService,
		TypeOrmWebhookSubscriptionRepository,
		MikroOrmWebhookSubscriptionRepository,
		TypeOrmWebhookDeliveryRepository,
		MikroOrmWebhookDeliveryRepository
	]
})
export class WebhookModule {}
