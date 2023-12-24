import { Public } from '@gauzy/common';
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';
import * as path from 'path';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { v4 as uuid } from 'uuid';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
	constructor(
		private readonly dataSource: DataSource,
		private readonly health: HealthCheckService,
		private readonly db: TypeOrmHealthIndicator,
		private readonly disk: DiskHealthIndicator,
		private readonly cacheHealthIndicator: CacheHealthIndicator,
		private readonly redisHealthIndicator: RedisHealthIndicator
	) {}

	@Public()
	@Get()
	async check() {
		const uniqueLabel = `HealthCheckExecutionTimer-${uuid()}`;
		console.log('Health check started: ', uniqueLabel);
		console.time(uniqueLabel);

		const queryRunner = this.dataSource.createQueryRunner();

		try {
			await queryRunner.connect();

			const checks = [
				async () =>
					await this.disk.checkStorage('storage', {
						path: path.resolve(__dirname),
						// basically will fail if disk is full
						thresholdPercent: 99.999999
					}),
				async () =>
					await this.db.pingCheck('database', {
						connection: queryRunner.connection,
						timeout: 60000
					}),
				async () => await this.cacheHealthIndicator.isHealthy('cache'),
				async () => await this.redisHealthIndicator.isHealthy('redis')
			];

			if (process.env.REDIS_ENABLED === 'true') {
				checks.push(async () => await this.redisHealthIndicator.isHealthy('redis'));
			}

			const result = await this.health.check(checks);

			console.timeEnd(uniqueLabel);

			console.log('Health check result: ', JSON.stringify(result));

			return result;
		} finally {
			await queryRunner.release();
		}
	}
}
