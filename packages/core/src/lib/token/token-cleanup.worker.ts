import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { isNotEmpty } from '@gauzy/utils';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import { CleanupExpiredTokensCommand, CleanupInactiveTokensCommand } from './commands';
import { ITokenJob } from './interfaces';
import { TokenConfigRegistry } from './token-config.registry';
import { TOKEN_CLEANUP_EXPIRED_JOB, TOKEN_CLEANUP_INACTIVE_JOB, TOKEN_QUEUE_NAME } from './token-constant';

@Injectable()
@QueueWorker(TOKEN_QUEUE_NAME)
export class TokenCleanupWorker extends QueueWorkerHost {
	private readonly logger = new Logger(TokenCleanupWorker.name);

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly configRegistry: TokenConfigRegistry
	) {
		super();
	}

	private get commandBus(): CommandBus {
		const commandBus = this.moduleRef.get(CommandBus, { strict: false });
		if (!commandBus) {
			throw new Error('CommandBus is not available in the current application context');
		}
		return commandBus;
	}

	@QueueJobHandler(TOKEN_CLEANUP_EXPIRED_JOB)
	public async handleExpired(job: Job<ITokenJob>): Promise<void> {
		this.logger.log(`Process expired cleanup requested at ${job.data.requestedAt}`);
		try {
			this.logger.log('Starting expired token cleanup');
			const count = await this.commandBus.execute(new CleanupExpiredTokensCommand());
			this.logger.log(`Marked ${count} tokens as expired`);
		} catch (error) {
			this.logger.error('Failed to cleanup expired tokens', error);
		}
	}

	@QueueJobHandler(TOKEN_CLEANUP_INACTIVE_JOB)
	public async handleInactive(job: Job<ITokenJob>): Promise<void> {
		this.logger.log(`Process inactive cleanup requested at ${job.data.requestedAt}`);
		try {
			this.logger.log('Starting inactive token cleanup');
			const registeredTypes = this.configRegistry.getRegisteredTypes();
			let totalRevoked = 0;

			for (const tokenType of registeredTypes) {
				const config = this.configRegistry.getConfig(tokenType);
				if (isNotEmpty(config.threshold)) {
					const count = await this.commandBus.execute(
						new CleanupInactiveTokensCommand(tokenType, config.threshold)
					);
					totalRevoked += count;
					this.logger.log(`Revoked ${count} inactive ${tokenType} tokens`);
				}
			}

			this.logger.log(`Total inactive tokens revoked: ${totalRevoked}`);
		} catch (error) {
			this.logger.error('Failed to cleanup inactive tokens', error);
		}
	}
}
