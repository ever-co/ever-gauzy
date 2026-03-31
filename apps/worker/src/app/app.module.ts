import { DatabaseModule, TokenModule } from '@gauzy/core';
import { SchedulerModule } from '@gauzy/scheduler';
import { Module } from '@nestjs/common';
import { WorkerJobsModule } from './worker-jobs.module';
import { WORKER_DEFAULT_QUEUE, WORKER_QUEUE_ENABLED, WORKER_SCHEDULER_ENABLED } from './worker.constants';

@Module({
	imports: [
		DatabaseModule,
		TokenModule.forRoot({
			enableScheduler: WORKER_SCHEDULER_ENABLED
		}),
		SchedulerModule.forRoot({
			enabled: WORKER_SCHEDULER_ENABLED,
			enableQueueing: WORKER_QUEUE_ENABLED,
			defaultQueueName: WORKER_DEFAULT_QUEUE,
			defaultTimezone: process.env.WORKER_TIMEZONE,
			defaultJobOptions: {
				preventOverlap: true,
				retries: 1,
				retryDelayMs: 5000
			}
		}),
		WorkerJobsModule
	]
})
export class AppModule {}
