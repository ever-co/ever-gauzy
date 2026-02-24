# @gauzy/scheduler

Reusable background job scheduling for NestJS modules using `@nestjs/schedule`, `@nestjs/bullmq`, and `bullmq`.

## Features

- `@ScheduledJob(...)` method decorator
- Queue-aware scheduled jobs (`queueName`, `queueJobName`, `queueJobOptions`)
- BullMQ queue registration through `SchedulerModule.forFeature({ queues: [...] })`
- Lightweight queue worker API: `@QueueWorker(...)` + `QueueWorkerHost` + `@QueueJobHandler(...)`
- Automatic job discovery across providers/controllers
- `cron`, `interval`, and `runOnStart` support
- Built-in overlap protection, retries, timeout, and optional jitter
- Runtime controls via `SchedulerService` (`listJobs`, `triggerNow`, `enqueue`)

## Quick start

```ts
import { Module } from '@nestjs/common';
import { RedisModule } from '@gauzy/core/redis';
import { SchedulerModule } from '@gauzy/scheduler';
import { CleanupJobsModule } from './cleanup-jobs.module';

@Module({
	imports: [
		RedisModule,
		SchedulerModule.forRoot({
			enabled: true,
			enableQueueing: true,
			defaultTimezone: 'UTC',
			defaultQueueName: 'background',
			defaultJobOptions: {
				preventOverlap: true,
				retries: 1,
				retryDelayMs: 5000
			}
		}),
		CleanupJobsModule
	]
})
export class AppModule {}
```

## Define jobs with low effort

```ts
import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';

@Injectable()
export class CleanupJob {
	private readonly logger = new Logger(CleanupJob.name);

	@ScheduledJob({
		name: 'enqueue.cleanup.tokens',
		cron: CronExpression.EVERY_HOUR,
		runOnStart: true,
		preventOverlap: true,
		queueName: 'background',
		queueJobName: 'cleanup.tokens'
	})
	async enqueueCleanup(): Promise<{ requestedAt: string }> {
		this.logger.log('Queueing token cleanup...');
		return { requestedAt: new Date().toISOString() };
	}
}
```

Process queued jobs with minimal boilerplate:

```ts
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';

@Injectable()
@QueueWorker('background')
export class CleanupWorker extends QueueWorkerHost {
	private readonly logger = new Logger(CleanupWorker.name);

	@QueueJobHandler('cleanup.tokens')
	async handleCleanup(job: Job<{ requestedAt: string }>): Promise<void> {
		this.logger.log(`Cleanup requested at ${job.data.requestedAt}`);
	}
}
```

Register providers and queues through feature module:

```ts
import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { CleanupJob } from './cleanup.job';
import { CleanupWorker } from './cleanup.worker';

@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: ['background'],
			jobProviders: [CleanupJob, CleanupWorker]
		})
	]
})
export class CleanupJobsModule {}
```

## Build

Run `nx build scheduler`.
