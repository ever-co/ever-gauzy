import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { v4 as uuid } from 'uuid';
import { createClient } from 'redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		if (key == 'redis') {
			const isHealthy = await this.checkRedis();
			return this.getStatus(key, isHealthy);
		}
	}

	// Note: this actually duplicate another health indicator we created in CustomHealthIndicator.
	// However in CustomHealthIndicator we use different method of testing Caching (can be Redis or Memory), but here
	// we explicitly test Redis. This is because we want to test Redis connection (if it's enabled) in this health check,
	// even if caching is not working for some reason.
	private async checkRedis(): Promise<boolean> {
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
				min: 10,
				max: 100
			},
			socket: {
				tls: isTls,
				host: host,
				port: port,
				passphrase: password,
				rejectUnauthorized: process.env.NODE_ENV === 'production'
			}
		};

		const client = await createClient(redisConnectionOptions).on('error', (err) =>
			console.log('Redis Client Error', err)
		);

		let isRedisHealthy = false;

		try {
			await client.connect();

			const randomKey = 'redis-health-check-' + uuid();

			await client.set(randomKey, 'redis');
			const value = await client.get(randomKey);

			if (value === 'redis') isRedisHealthy = true;

			await client.disconnect();
		} catch (error) {
			console.log('Redis Error: ', error);
		}

		return isRedisHealthy;
	}
}
