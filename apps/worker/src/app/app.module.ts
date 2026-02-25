import { SchedulerModule } from '@gauzy/scheduler';
import { Module } from '@nestjs/common';
import { WorkerJobsModule } from './worker-jobs.module';
import { WORKER_DEFAULT_QUEUE, WORKER_QUEUE_ENABLED } from './worker.constants';

@Module({
	imports: [
		SchedulerModule.forRoot({
			enabled: process.env.WORKER_SCHEDULER_ENABLED !== 'false',
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
	],
})
export class AppModule {}
