import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
	constructor(
		@Inject(CACHE_MANAGER)
		private cacheManager: Cache
	) {
		super();
	}

	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		if (key == 'cache') {
			const randomKey = 'health-check-' + uuid();

			let isHealthy = false;

			try {
				// we try to save data and load it again
				await this.cacheManager.set(randomKey, 'health', 60 * 1000);
				isHealthy = (await this.cacheManager.get(randomKey)) === 'health';
			} catch (err) {
				console.error('Error to save / get data from Cache', err);
			}

			const result = this.getStatus(key, isHealthy, {
				cacheType: process.env.REDIS_ENABLED === 'true' ? 'redis' : 'memory'
			});

			if (isHealthy) {
				return result;
			}

			throw new HealthCheckError('Cache Health failed', result);
		}
	}
}
