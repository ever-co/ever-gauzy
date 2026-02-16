import { Global, Logger, Module, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { createClient } from 'redis';

export const EVER_REDIS_CLIENT = 'EVER_REDIS_CLIENT';

@Global()
@Module({
	providers: [
		{
			provide: EVER_REDIS_CLIENT,
			useFactory: async () => {
				if (process.env.REDIS_ENABLED !== 'true') return null;

				const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD, REDIS_TLS } = process.env;
				if (!REDIS_URL && (!REDIS_HOST || !REDIS_PORT)) return null;

				const url =
					REDIS_URL ||
					(() => {
						const proto = REDIS_TLS === 'true' ? 'rediss' : 'redis';
						const auth = REDIS_PASSWORD
							? `${REDIS_USER || ''}:${REDIS_PASSWORD}@`
							: '';
						return `${proto}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
					})();

				try {
					const client = createClient({ url });
					client.on('error', (err) => Logger.error('Redis client error', err, 'RedisModule'));
					await client.connect();
					Logger.log('Redis client connected for atomic operations', 'RedisModule');
					return client;
				} catch (error) {
					Logger.warn('Redis client connection failed, falling back to cache-manager', 'RedisModule');
					return null;
				}
			}
		}
	],
	exports: [EVER_REDIS_CLIENT]
})
export class RedisModule implements OnModuleDestroy {
	constructor(
		@Optional() @Inject(EVER_REDIS_CLIENT) private readonly redisClient: ReturnType<typeof createClient> | null
	) {}

	async onModuleDestroy(): Promise<void> {
		if (this.redisClient) {
			try {
				await this.redisClient.quit();
				Logger.log('Redis client disconnected gracefully', 'RedisModule');
			} catch (error) {
				Logger.error('Error disconnecting Redis client', error, 'RedisModule');
			}
		}
	}
}
