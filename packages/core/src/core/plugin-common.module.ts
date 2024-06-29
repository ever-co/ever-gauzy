import { Module } from '@nestjs/common';
import { EventBusModule } from '../event-bus/event-bus.module';

@Module({
	imports: [EventBusModule],
	exports: [EventBusModule]
})
export class PluginCommonModule {}
