import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { EVER_REDIS_CLIENT } from '@gauzy/core/redis';
import { createClient } from 'redis';

@Injectable()
export class WorkerRedisIntegrationService implements OnModuleInit {
	private readonly logger = new Logger(WorkerRedisIntegrationService.name);

	constructor(
		@Optional()
		@Inject(EVER_REDIS_CLIENT)
		private readonly redisClient: ReturnType<typeof createClient> | null
	) {}

	onModuleInit(): void {
		if (this.redisClient) {
			this.logger.log('EVER_REDIS_CLIENT is available for worker jobs.');
			return;
		}

		this.logger.warn('EVER_REDIS_CLIENT is not available. Queue-based jobs may be disabled or degraded.');
	}
}
