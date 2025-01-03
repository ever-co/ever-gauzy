import { Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { EventHandlers } from './events/handlers';

@Module({
	imports: [],
	providers: [EventBus, ...EventHandlers],
	exports: [EventBus]
})
export class EventBusModule {}
