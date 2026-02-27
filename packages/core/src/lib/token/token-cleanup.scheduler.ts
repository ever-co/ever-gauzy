import { ScheduledJob } from '@gauzy/scheduler';
import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ITokenJob } from './interfaces';
import {
	TOKEN_CLEANUP_EXPIRED_JOB,
	TOKEN_CLEANUP_INACTIVE_JOB,
	TOKEN_CLEANUP_INACTIVE_SCHEDULER,
	TOKEN_QUEUE_NAME
} from './token-constant';

@Injectable()
export class TokenCleanupScheduler {
	private readonly logger = new Logger(TokenCleanupScheduler.name);

	@ScheduledJob({
		name: TOKEN_CLEANUP_EXPIRED_JOB,
		cron: CronExpression.EVERY_10_SECONDS,
		queueName: TOKEN_QUEUE_NAME,
		queueJobName: TOKEN_CLEANUP_EXPIRED_JOB,
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
		cron: CronExpression.EVERY_30_SECONDS,
		queueName: TOKEN_QUEUE_NAME,
		queueJobName: TOKEN_CLEANUP_INACTIVE_JOB,
		runOnStart: true
	})
	async enqueueInactiveCleanup(): Promise<ITokenJob> {
		const requestedAt = new Date().toISOString();
		this.logger.log(`Queue inactive cleanup at ${requestedAt}`);
		return { requestedAt };
	}
}
