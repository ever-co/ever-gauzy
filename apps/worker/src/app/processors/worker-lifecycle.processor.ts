import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { WORKER_DEFAULT_QUEUE } from '../worker.constants';

interface WorkerLifecyclePayload {
	timestamp: string;
}

@Injectable()
@QueueWorker(WORKER_DEFAULT_QUEUE)
export class WorkerLifecycleProcessor extends QueueWorkerHost {
	private readonly logger = new Logger(WorkerLifecycleProcessor.name);

	@QueueJobHandler('worker.startup')
	async handleStartup(job: Job<WorkerLifecyclePayload>): Promise<void> {
		this.logger.log(`Worker startup event processed at ${job.data.timestamp}`);
	}

	@QueueJobHandler('worker.heartbeat')
	async handleHeartbeat(job: Job<WorkerLifecyclePayload>): Promise<void> {
		this.logger.log(`Worker heartbeat processed at ${job.data.timestamp}`);
	}
}
