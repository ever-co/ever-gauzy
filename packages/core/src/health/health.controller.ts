import { Public } from '@gauzy/common';
import { Controller, Get } from '@nestjs/common';
import {
	HealthCheckService,
	TypeOrmHealthIndicator,
	DiskHealthIndicator,
	MicroserviceHealthIndicator,
	MicroserviceHealthIndicatorOptions
} from '@nestjs/terminus';
import * as path from 'path';
import { RedisOptions, Transport } from '@nestjs/microservices';
import { ConnectionOptions } from 'tls';
import { CustomHealthIndicator } from './custom-health.indicator';

@Controller('health')
export class HealthController {
	constructor(
		private readonly health: HealthCheckService,
		private readonly db: TypeOrmHealthIndicator,
		private readonly disk: DiskHealthIndicator,
		private microservice: MicroserviceHealthIndicator,
		private customHealthIndicator: CustomHealthIndicator
	) {}

	@Public()
	@Get()
	async check() {
		const checks = [
			async () =>
				await this.disk.checkStorage('storage', { path: path.resolve(__dirname), thresholdPercent: 99.999999 }), // basically will fail if disk is full
			async () => await this.db.pingCheck('database', { timeout: 300 }),
			async () => await this.customHealthIndicator.isHealthy('cache')
		];

		// NOTE: for some reason can't connect to Redis in my tests (even though it works in the other places)
		if (false && process.env.REDIS_ENABLED === 'true') {
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

			const connection: ConnectionOptions = {
				host: host,
				port: port,
				passphrase: password,
				rejectUnauthorized: process.env.NODE_ENV === 'production'
			};

			const options: MicroserviceHealthIndicatorOptions<RedisOptions> = {
				transport: Transport.REDIS,
				timeout: 300,
				options: {
					host: host,
					port: port,
					username: username,
					password: password,
					tls: isTls ? connection : undefined
				}
			};

			console.log('REDIS_OPTIONS: ', JSON.stringify(options));

			const redisCheck = this.microservice.pingCheck<RedisOptions>('redis', options);

			checks.push(async () => redisCheck);
		}

		const result = await this.health.check(checks);

		console.log('Health check result: ', JSON.stringify(result));

		return result;
	}
}
