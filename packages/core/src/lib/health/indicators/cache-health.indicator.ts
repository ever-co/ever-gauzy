import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
	constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
		super();
	}

	/**
	 * Checks the health status of a specified service.
	 *
	 * @param {string} key - The service key to check (e.g., 'cache').
	 * @returns {Promise<HealthIndicatorResult>} - A promise resolving to the health check result.
	 *
	 * @throws {HealthCheckError} - Throws an error if the health check fails.
	 *
	 * @description
	 * This method verifies the health of the cache system by attempting to set and retrieve a test key.
	 * If the cache system is enabled (Redis or in-memory), it ensures that data can be stored and retrieved successfully.
	 * If the health check fails, it throws a `HealthCheckError`.
	 *
	 * @example
	 * ```ts
	 * const isCacheHealthy = await healthService.isHealthy('cache');
	 * console.log(isCacheHealthy);
	 * ```
	 */
	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		if (key !== 'cache') {
			throw new HealthCheckError('Invalid key for health check', { key });
		}

		const randomKey = `health-check-${uuid()}`;
		let isHealthy = false;

		try {
			// Attempt to set and retrieve a test key from the cache
			await this.cacheManager.set(randomKey, 'health', 60 * 1000);
			isHealthy = (await this.cacheManager.get(randomKey)) === 'health';
		} catch (error) {
			console.error('Error saving/retrieving data from cache:', error);
		}

		// Determine cache type (Redis or in-memory)
		const cacheType = process.env.REDIS_ENABLED === 'true' ? 'redis' : 'memory';

		// Build health check result
		const result = this.getStatus(key, isHealthy, { cacheType });

		if (isHealthy) {
			return result;
		}

		// Throw an error if the health check fails
		throw new HealthCheckError('Cache health check failed', result);
	}
}
