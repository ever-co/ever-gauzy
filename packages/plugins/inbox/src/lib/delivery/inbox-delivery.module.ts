import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSendModule } from '@gauzy/core';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryMailer } from './inbox-delivery-mailer';
import { InboxDeliveryService } from './inbox-delivery.service';

export const INBOX_DELIVERY_ENTITIES = [InboxDelivery];

/** The delivery lane's services: the sweep and the mailer. The schedule lives in `InboxDeliveryMaintenanceModule`. */
@Module({
	imports: [TypeOrmModule.forFeature(INBOX_DELIVERY_ENTITIES), MikroOrmModule.forFeature(INBOX_DELIVERY_ENTITIES), EmailSendModule],
	providers: [InboxDeliveryMailer, InboxDeliveryService],
	exports: [InboxDeliveryService]
})
export class InboxDeliveryModule {}
