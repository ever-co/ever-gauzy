import { Module } from '@nestjs/common';
import { JitsuAnalyticsService } from './jitsu-analytics.service';
import { JitsuEventsSubscriber } from './jitsu-events-subscriber';

@Module({
	providers: [JitsuAnalyticsService, JitsuEventsSubscriber],
})
export class JitsuAnalyticsModule {}
