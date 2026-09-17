import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxService } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';
import { MikroOrmEventDeliveryRepository } from './repository/mikro-orm-event-delivery.repository';
import { MikroOrmEventOutboxRepository } from './repository/mikro-orm-event-outbox.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EventOutbox, EventDelivery]),
		MikroOrmModule.forFeature([EventOutbox, EventDelivery])
	],
	providers: [
		EventOutboxService,
		EventConsumerRegistry,
		TypeOrmEventOutboxRepository,
		MikroOrmEventOutboxRepository,
		TypeOrmEventDeliveryRepository,
		MikroOrmEventDeliveryRepository
	],
	exports: [
		EventOutboxService,
		EventConsumerRegistry,
		TypeOrmEventOutboxRepository,
		MikroOrmEventOutboxRepository,
		TypeOrmEventDeliveryRepository,
		MikroOrmEventDeliveryRepository
	]
})
export class EventOutboxModule {}
