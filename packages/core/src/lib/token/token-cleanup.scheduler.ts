import { isNotEmpty } from '@gauzy/utils';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupExpiredTokensCommand, CleanupInactiveTokensCommand } from './commands';
import { TokenConfigRegistry } from './token-config.registry';

/**
 * Token Cleanup Scheduler
 * Automatically cleans up expired and inactive tokens
 */
@Injectable()
export class TokenCleanupScheduler {
	private readonly logger = new Logger(TokenCleanupScheduler.name);

	constructor(private readonly commandBus: CommandBus, private readonly configRegistry: TokenConfigRegistry) {}

	/**
	 * Run every hour to mark expired tokens
	 */
	@Cron(CronExpression.EVERY_HOUR)
	async handleExpiredTokens(): Promise<void> {
		try {
			this.logger.log('Starting expired token cleanup');
			const count = await this.commandBus.execute(new CleanupExpiredTokensCommand());
			this.logger.log(`Marked ${count} tokens as expired`);
		} catch (error) {
			this.logger.error('Failed to cleanup expired tokens', error);
		}
	}

	/**
	 * Run every 6 hours to revoke inactive tokens
	 */
	@Cron(CronExpression.EVERY_6_HOURS)
	async handleInactiveTokens(): Promise<void> {
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
