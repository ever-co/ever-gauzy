import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { WorkerLifecycleJob } from './jobs/worker-lifecycle.job';
import { WorkerLifecycleProcessor } from './processors/worker-lifecycle.processor';
import { WORKER_DEFAULT_QUEUE, WORKER_QUEUE_ENABLED } from './worker.constants';

const providers = WORKER_QUEUE_ENABLED
	? [WorkerLifecycleJob, WorkerLifecycleProcessor]
	: [WorkerLifecycleJob];

@Module({
	imports: [
		SchedulerModule.forFeature({
			jobProviders: providers,
			queues: WORKER_QUEUE_ENABLED ? [WORKER_DEFAULT_QUEUE] : []
		})
	]
})
export class WorkerJobsModule {}
