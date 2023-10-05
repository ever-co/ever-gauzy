import { Module } from '@nestjs/common';
import { JitsuAnalyticsService } from './jitsu-analytics.service';
import { EntityEventsSubscriber } from './entity-event-subscriber/entity-event-subscriber';

@Module({
	providers: [JitsuAnalyticsService, EntityEventsSubscriber],
})
export class JitsuAnalyticsModule {}
