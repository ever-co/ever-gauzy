# @gauzy/scheduler

Reusable background jobs for NestJS modules using:

- `@nestjs/schedule` for cron/interval triggers
- `@nestjs/bullmq` + `bullmq` for queue-backed execution

## What you get

- `@ScheduledJob(...)` for declarative background jobs
- Queue-aware jobs (`queueName`, `queueJobName`, `queueJobOptions`)
- Worker abstraction: `@QueueWorker(...)` + `QueueWorkerHost` + `@QueueJobHandler(...)`
- Auto-discovery of decorated jobs from providers/controllers
- Runtime APIs via `SchedulerService` (`listJobs`, `triggerNow`, `enqueue`)
- Safety defaults (overlap prevention, retries, timeout, jitter)

## Usage model

Use the scheduler in 2 layers:

1. Root setup once in your application (or worker application) with `SchedulerModule.forRoot(...)`.
2. Feature setup per domain with `SchedulerModule.forFeature(...)` to register queues and job providers.

## 1) Root setup (global)

```ts
import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { TokenCleanupJobsModule } from './token-cleanup-jobs.module';

@Module({
	imports: [
		SchedulerModule.forRoot({
			enabled: true,
			enableQueueing: true,
			defaultTimezone: 'UTC',
			defaultQueueName: 'background',
			defaultJobOptions: {
				enabled: true,
				preventOverlap: true,
				retries: 1,
				retryDelayMs: 5000,
				timeoutMs: 30000,
				maxRandomDelayMs: 0
			}
		}),
		TokenCleanupJobsModule
	]
})
export class AppModule {}
```

Notes:

- `enableQueueing` defaults to `process.env.REDIS_ENABLED === 'true'`.
- If `queueConnection` is omitted, scheduler resolves Redis connection from:
  - `REDIS_URL`, or
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_TLS`.

## 2) Scheduled producer job

Decorate a method with `@ScheduledJob`. If `queueName` is set, the method return value is enqueued as BullMQ job data.

```ts
import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';

@Injectable()
export class TokenCleanupScheduler {
 private readonly logger = new Logger(TokenCleanupScheduler.name);

 @ScheduledJob({
  name: 'token.cleanup.expired.scheduler',
  cron: CronExpression.EVERY_HOUR,
  queueName: 'token-maintenance',
  queueJobName: 'token.cleanup.expired',
  preventOverlap: true
 })
 async enqueueExpiredCleanup(): Promise<{ requestedAt: string }> {
  const requestedAt = new Date().toISOString();
  this.logger.log(`Queue expired cleanup at ${requestedAt}`);
  return { requestedAt };
 }

 @ScheduledJob({
  name: 'token.cleanup.inactive.scheduler',
  cron: CronExpression.EVERY_6_HOURS,
  queueName: 'token-maintenance',
  queueJobName: 'token.cleanup.inactive'
 })
 async enqueueInactiveCleanup(): Promise<{ requestedAt: string }> {
  return { requestedAt: new Date().toISOString() };
 }
}
```

## 3) Queue worker (job consumer)

Use `QueueWorkerHost` and map queue job names to handlers with `@QueueJobHandler(...)`.

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';

@Injectable()
@QueueWorker('token-maintenance')
export class TokenCleanupWorker extends QueueWorkerHost {
 private readonly logger = new Logger(TokenCleanupWorker.name);

 @QueueJobHandler('token.cleanup.expired')
 async handleExpired(job: Job<{ requestedAt: string }>): Promise<void> {
  this.logger.log(`Process expired cleanup requested at ${job.data.requestedAt}`);
  // Execute business logic (CQRS command, service call, etc.)
 }

 @QueueJobHandler('token.cleanup.inactive')
 async handleInactive(job: Job<{ requestedAt: string }>): Promise<void> {
  this.logger.log(`Process inactive cleanup requested at ${job.data.requestedAt}`);
 }
}
```

## 4) Feature registration

Register queues and providers for the feature.

```ts
import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { TokenCleanupScheduler } from './token-cleanup.scheduler';
import { TokenCleanupWorker } from './token-cleanup.worker';

@Module({
 imports: [
  SchedulerModule.forFeature({
   queues: ['token-maintenance'],
   jobProviders: [TokenCleanupScheduler, TokenCleanupWorker]
  })
 ]
})
export class TokenCleanupJobsModule {}
```

## 5) Runtime control (optional)

```ts
import { Controller, Get, Param, Post } from '@nestjs/common';
import { SchedulerService } from '@gauzy/scheduler';

@Controller('scheduler')
export class SchedulerController {
 constructor(private readonly scheduler: SchedulerService) {}

 @Get('jobs')
 listJobs() {
  return this.scheduler.listJobs();
 }

 @Post('jobs/:id/trigger')
 async trigger(@Param('id') id: string) {
  await this.scheduler.triggerNow(id);
  return { ok: true };
 }
}
```

## ScheduledJob options

- `name`: custom job id (default: `ProviderName.methodName`)
- `cron`: cron expression schedule
- `intervalMs`: interval schedule (mutually exclusive with `cron`)
- `runOnStart`: execute once at bootstrap
- `enabled`: enable/disable a job
- `preventOverlap`: skip new run if previous run is still active
- `retries`, `retryDelayMs`: retry behavior
- `timeoutMs`: max execution time per attempt
- `maxRandomDelayMs`: jitter before each scheduled execution
- `queueName`: queue target (if set, execution result is enqueued)
- `queueJobName`: BullMQ job name (default: scheduler job id)
- `queueJobOptions`: BullMQ `JobsOptions`

## Common pitfalls

- Queue job without queue registration:
  - Ensure the queue exists in `SchedulerModule.forFeature({ queues: [...] })`.
- Queueing disabled:
  - If `enableQueueing` is `false`, jobs with `queueName` will fail by design.
- Duplicate job names:
  - `name` must be unique across all discovered scheduled jobs.

## Build

```bash
nx build scheduler
```
