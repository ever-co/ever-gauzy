import { Public } from '@gauzy/common';
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@Controller('health')
export class HealthController {
	constructor(
		@InjectDataSource()
		private readonly dataSource: DataSource,
		private readonly health: HealthCheckService,
		private readonly db: TypeOrmHealthIndicator,
		private readonly disk: DiskHealthIndicator,
		private readonly cacheHealthIndicator: CacheHealthIndicator,
		private readonly redisHealthIndicator: RedisHealthIndicator
	) { }

	@Public()
	@Get()
	async check() {
		const uniqueLabel = `HealthCheckExecutionTimer-${uuid()}`;
		console.log('Health check started: ', uniqueLabel);
		console.time(uniqueLabel);

		const queryRunner = this.dataSource.createQueryRunner();

		try {
			await queryRunner.connect();

			const checks = [];

			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Database...`);
				const resDatabase = await this.db.pingCheck('database', {
					connection: queryRunner.connection,
					timeout: 60000
				});
				console.log(`Database check ${uniqueLabel} completed`);
				return resDatabase;
			});

			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Storage...`);
				const resStorage = await this.disk.checkStorage('storage', {
					path: path.resolve(__dirname),
					// basically will fail if disk is full
					thresholdPercent: 99.999999
				});
				console.log(`Storage check ${uniqueLabel} completed`);
				return resStorage;
			});

			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Cache...`);
				const resCache = await this.cacheHealthIndicator.isHealthy('cache');
				console.log(`Cache check ${uniqueLabel} completed`);
				return resCache;
			});

			if (process.env.REDIS_ENABLED === 'true') {
				checks.push(async () => {
					console.log(`Checking ${uniqueLabel} Redis...`);
					const resRedis = await this.redisHealthIndicator.isHealthy('redis');
					console.log(`Redis check ${uniqueLabel} completed`);
					return resRedis;
				});
			}

			const result = await this.health.check(checks);

			console.timeEnd(uniqueLabel);

			console.log(`Health check ${uniqueLabel} result: ${JSON.stringify(result)}`);

			return result;
		} finally {
			await queryRunner.release();
		}
	}
}
