import { ScheduledJob } from '@gauzy/scheduler';
import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ITokenJob } from './interfaces';
import {
	TOKEN_CLEANUP_EXPIRED_JOB,
	TOKEN_CLEANUP_INACTIVE_JOB,
	TOKEN_CLEANUP_INACTIVE_SCHEDULER,
	TOKEN_QUEUE_NAME,
	TOKEN_WORKER_ENABLED
} from './token-constant';

@Injectable()
export class TokenCleanupScheduler {
	private readonly logger = new Logger(TokenCleanupScheduler.name);

	@ScheduledJob({
		name: TOKEN_CLEANUP_EXPIRED_JOB,
		cron: CronExpression.EVERY_HOUR,
		queueName: TOKEN_QUEUE_NAME,
		queueJobName: TOKEN_CLEANUP_EXPIRED_JOB,
		enabled: TOKEN_WORKER_ENABLED,
		runOnStart: true,
		preventOverlap: true
	})
	async enqueueExpiredCleanup(): Promise<ITokenJob> {
		const requestedAt = new Date().toISOString();
		this.logger.log(`Queue expired cleanup at ${requestedAt}`);
		return { requestedAt };
	}

	@ScheduledJob({
		name: TOKEN_CLEANUP_INACTIVE_SCHEDULER,
		cron: CronExpression.EVERY_6_HOURS,
		queueName: TOKEN_QUEUE_NAME,
		queueJobName: TOKEN_CLEANUP_INACTIVE_JOB,
		enabled: TOKEN_WORKER_ENABLED,
		runOnStart: true
	})
	async enqueueInactiveCleanup(): Promise<ITokenJob> {
		const requestedAt = new Date().toISOString();
		this.logger.log(`Queue inactive cleanup at ${requestedAt}`);
		return { requestedAt };
	}
}
