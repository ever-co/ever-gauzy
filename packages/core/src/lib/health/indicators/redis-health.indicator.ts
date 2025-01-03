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

	private async startRedis(): Promise<boolean> {
		if (process.env.REDIS_ENABLED === 'true') {
			console.log('Starting Redis for Health Check...');

			const url =
				process.env.REDIS_URL ||
				(process.env.REDIS_TLS === 'true'
					? `rediss://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
					: `redis://${process.env.REDIS_USER}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

			console.log('REDIS_URL: ', url);

			let host, port, username, password;

			const isTls = url.startsWith('rediss://');

			// Removing the protocol part
			let authPart = url.split('://')[1];

			// Check if the URL contains '@' (indicating the presence of username/password)
			if (authPart.includes('@')) {
				// Splitting user:password and host:port
				let [userPass, hostPort] = authPart.split('@');
				[username, password] = userPass.split(':');
				[host, port] = hostPort.split(':');
			} else {
				// If there is no '@', it means there is no username/password
				[host, port] = authPart.split(':');
			}

			port = parseInt(port);

			const redisConnectionOptions = {
				url: url,
				username: username,
				password: password,
				isolationPoolOptions: {
					min: 1,
					max: 10 // we don't need a lot of connections max for Health checks
				},
				socket: {
					tls: isTls,
					host: host,
					port: port,
					passphrase: password,
					rejectUnauthorized: process.env.NODE_ENV === 'production'
				},
				ttl: 60 * 60 * 1 * 1 // 1 hour
			};

			this._client = await createClient(redisConnectionOptions).on('error', (err) =>
				console.error('Redis Health Client Error', err)
			);

			try {
				await this._client.connect();
				return true;
			} catch (error) {
				console.error('Redis Health Connect Error: ', error);
				return false;
			}
		} else {
			console.warn('Redis Health Client is not enabled.');
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
