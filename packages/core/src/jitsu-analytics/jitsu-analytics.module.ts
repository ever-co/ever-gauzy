import { Module } from '@nestjs/common';
import { JitsuAnalyticsService } from './jitsu-analytics.service';

@Module({
	providers: [JitsuAnalyticsService],
})
export class JitsuAnalyticsModule { }
