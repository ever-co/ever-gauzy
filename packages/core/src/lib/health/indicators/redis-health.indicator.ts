import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { v4 as uuid } from 'uuid';
import { createClient } from 'redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
	// Redis Client
	private _client: any;

	/**
	 *
	 */
	constructor() {
		super();
		// Start Redis asynchronously
		// (no need to wait for it to finish, we just need to start it once and let it run in the background)
		this.startRedis();
	}

	/**
	 * Checks the health status of a specified service.
	 *
	 * @param {string} key - The service key to check (e.g., 'redis').
	 * @returns {Promise<HealthIndicatorResult>} - A promise resolving to the health check result.
	 *
	 * @throws {HealthCheckError} - Throws an error if the health check fails.
	 *
	 * @description
	 * This method checks the health status of Redis. If the key is 'redis', it verifies whether Redis
	 * is accessible by calling `checkRedis()`. If the check fails, it throws a `HealthCheckError`.
	 */
	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		if (key == 'redis') {
			const isHealthy = await this.checkRedis();

			const result = this.getStatus(key, isHealthy, {});

			if (isHealthy) {
				return result;
			}

			throw new HealthCheckError('Cache Health failed', result);
		}
	}

	/**
	 * Starts a Redis client for health checks.
	 *
	 * @returns {Promise<boolean>} - A promise resolving to `true` if Redis is successfully connected, otherwise `false`.
	 *
	 * @description
	 * This method initializes a Redis connection based on environment variables.
	 * If Redis is enabled (`REDIS_ENABLED` is `'true'`), it constructs the connection URL,
	 * parses authentication details, and attempts to connect using a Redis client.
	 *
	 * @throws {Error} - Logs errors if Redis connection fails.
	 *
	 * @example
	 * ```ts
	 * const isRedisConnected = await this.startRedis();
	 * console.log(isRedisConnected ? 'Redis is healthy' : 'Redis is not available');
	 * ```
	 */
	private async startRedis(): Promise<boolean> {
		if (process.env.REDIS_ENABLED !== 'true') {
			console.warn('Redis Health Client is not enabled.');
			return false;
		}

		console.log('Starting Redis for Health Check...');

		// Construct Redis URL dynamically
		const redisProtocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
		const { REDIS_URL, REDIS_USER, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT } = process.env;

		const redisUrl =
			REDIS_URL || `${redisProtocol}://${REDIS_USER || ''}:${REDIS_PASSWORD || ''}@${REDIS_HOST}:${REDIS_PORT}`;

		console.log('REDIS_URL:', redisUrl);

		try {
			// Parse Redis URL
			const isTls = redisUrl.startsWith('rediss://');
			const [authPart, hostPort] = redisUrl.split('://')[1].split('@');
			const [username, password] = authPart?.split(':') || [];
			const [host, port] = hostPort?.split(':') || [];

			const redisConnectionOptions = {
				url: redisUrl,
				username,
				password,
				isolationPoolOptions: { min: 1, max: 10 }, // Limited connections for health checks
				socket: {
					tls: isTls,
					host,
					port: parseInt(port),
					passphrase: password,
					rejectUnauthorized: process.env.NODE_ENV === 'production'
				},
				ttl: 60 * 60 // 1 hour
			};

			// Create Redis client
			this._client = createClient(redisConnectionOptions).on('error', (err) =>
				console.error('Redis Health Client Error', err)
			);

			await this._client.connect();
			console.log('Redis connected successfully.');
			return true;
		} catch (error) {
			console.error('Redis Health Connect Error:', error);
			return false;
		}
	}

	// TODO: we probably have to call this somehow on app shutdown event
	private async stopRedis(): Promise<void> {
		if (this._client) {
			try {
				await this._client.disconnect();
			} catch (error) {
				console.error('Redis Health Disconnect Error: ', error);
			}
		}
	}

	// Note: this actually duplicate another health indicator we created in CustomHealthIndicator.
	// However in CustomHealthIndicator we use different method of testing Caching (can be Redis or Memory), but here
	// we explicitly test Redis. This is because we want to test Redis connection (if it's enabled) in this health check,
	// even if caching is not working for some reason.
	private async checkRedis(): Promise<boolean> {
		const randomKey = 'redis-health-check-' + uuid();

		let isRedisHealthy = false;

		if (this._client) {
			try {
				await this._client.set(randomKey, 'redis');
				const value = await this._client.get(randomKey);

				if (value === 'redis') isRedisHealthy = true;
			} catch (error) {
				console.error('Redis Health Error: ', error);
			}
		}

		return isRedisHealthy;
	}
}
