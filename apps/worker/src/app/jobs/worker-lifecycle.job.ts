import { ScheduledJob } from '@gauzy/scheduler';
import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { WORKER_DEFAULT_QUEUE, WORKER_QUEUE_ENABLED } from '../worker.constants';

@Injectable()
export class WorkerLifecycleJob {
	private readonly logger = new Logger(WorkerLifecycleJob.name);

	@ScheduledJob({
		name: 'worker.startup.scheduler',
		enabled: WORKER_QUEUE_ENABLED,
		runOnStart: true,
		preventOverlap: true,
		queueName: WORKER_DEFAULT_QUEUE,
		queueJobName: 'worker.startup'
	})
	async announceStartup(): Promise<{ timestamp: string }> {
		this.logger.log('Queueing worker startup job.');
		return { timestamp: new Date().toISOString() };
	}

	@ScheduledJob({
		name: 'worker.heartbeat.scheduler',
		enabled: WORKER_QUEUE_ENABLED && process.env.WORKER_HEARTBEAT_ENABLED !== 'false',
		cron: CronExpression.EVERY_30_SECONDS,
		queueName: WORKER_DEFAULT_QUEUE,
		queueJobName: 'worker.heartbeat'
	})
	async heartbeat(): Promise<{ timestamp: string }> {
		this.logger.log('Queueing worker heartbeat job...');
		return { timestamp: new Date().toISOString() };
	}
}
