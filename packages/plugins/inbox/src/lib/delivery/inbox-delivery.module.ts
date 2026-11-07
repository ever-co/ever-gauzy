import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSendModule } from '@gauzy/core';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryMailer } from './inbox-delivery-mailer';
import { InboxDeliveryService } from './inbox-delivery.service';
import { InboxDeliveryPusher } from './push/inbox-delivery-pusher';
import { InboxPushController } from './push/inbox-push.controller';
import { InboxPushSubscription } from './push/inbox-push-subscription.entity';
import { InboxPushSubscriptionService } from './push/inbox-push-subscription.service';

export const INBOX_DELIVERY_ENTITIES = [InboxDelivery, InboxPushSubscription];

/** The delivery lane's services: the sweep and the mailer. The schedule lives in `InboxDeliveryMaintenanceModule`. */
@Module({
	imports: [TypeOrmModule.forFeature(INBOX_DELIVERY_ENTITIES), MikroOrmModule.forFeature(INBOX_DELIVERY_ENTITIES), EmailSendModule],
	// The push routes (the caller's devices) answer 404 where web push is off; the sweep's push step reads the same store.
	controllers: [InboxPushController],
	providers: [InboxDeliveryMailer, InboxDeliveryPusher, InboxPushSubscriptionService, InboxDeliveryService],
	exports: [InboxDeliveryService, InboxPushSubscriptionService]
})
export class InboxDeliveryModule {}
