import { Controller, Get } from '@nestjs/common';
import {
	HealthCheckService,
	TypeOrmHealthIndicator,
	DiskHealthIndicator,
	MikroOrmHealthIndicator
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { Public } from '@gauzy/common';
import { getORMType, MultiORM, MultiORMEnum } from '../core/utils';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { MikroOrmUserRepository, TypeOrmUserRepository } from '../user/repository';

@Controller('/health')
export class HealthController {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly disk: DiskHealthIndicator,
		private readonly health: HealthCheckService,
		private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
		private readonly mikroOrmHealthIndicator: MikroOrmHealthIndicator,
		private readonly cacheHealthIndicator: CacheHealthIndicator,
		private readonly redisHealthIndicator: RedisHealthIndicator,
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly mikroOrmUserRepository: MikroOrmUserRepository
	) {
		this.ormType = getORMType();
	}

	private readonly ormType: MultiORM;
	private readonly checkDb = true;
	private readonly checkStorage = true;
	private readonly checkCache = true;
	private readonly checkRedis = true;

	// Note: we disable by default because we notice some connection
	// related issues with Terminus DB checks (in MikroORM)
	private readonly checkDbWithTerminus = false;

	@Public()
	@Get()
	async check() {
		const uniqueLabel = `HealthCheckExecutionTimer-${uuid()}`;
		console.log('Health check started: ', uniqueLabel);
		console.time(uniqueLabel);

		const checks = [];

		if (this.checkDb) {
			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Database...`);
				switch (this.ormType) {
					case MultiORMEnum.TypeORM:
						let queryRunner: QueryRunner;
						try {
							let message: string;

							if (this.checkDbWithTerminus) {
								queryRunner = this.dataSource.createQueryRunner();

								const resDatabase = await this.typeOrmHealthIndicator.pingCheck('database', {
									connection: queryRunner.connection,
									timeout: 60000
								});

								message = resDatabase?.database?.message;
							}

							const usersCount = await this.typeOrmUserRepository.count();

							console.log(`Database (TypeORM) users count ${uniqueLabel} is: ${usersCount}`);

							console.log(`Database (TypeORM) check ${uniqueLabel} completed`);

							return {
								database: {
									status: 'up',
									message: message
								}
							};
						} catch (err) {
							console.error(`Database (TypeORM) check ${uniqueLabel} failed`, err);
							return {
								database: {
									status: 'down',
									message: err.message
								}
							};
						} finally {
							if (this.checkDbWithTerminus && queryRunner) await queryRunner.release();
						}
					case MultiORMEnum.MikroORM:
						try {
							let message: string;

							if (this.checkDbWithTerminus) {
								const resDatabase = await this.mikroOrmHealthIndicator.pingCheck('database', {
									timeout: 60000
								});

								message = resDatabase?.database?.message;
							}

							const usersCount = await this.mikroOrmUserRepository.count();

							console.log(`Database (MikroORM) users count ${uniqueLabel} is: ${usersCount}`);

							console.log(`Database (MikroORM) check ${uniqueLabel} completed`);

							return {
								database: {
									status: 'up',
									message: message
								}
							};
						} catch (err) {
							console.error(`Database (MikroORM) check ${uniqueLabel} failed`, err);
							return {
								database: {
									status: 'down',
									message: err.message
								}
							};
						}
					default:
						throw new Error('ORM not supported');
				}
			});
		}

		if (this.checkStorage) {
			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Storage...`);
				try {
					const currentPath = path.resolve(__dirname);
					console.log(`Checking ${uniqueLabel} Storage at path: ${currentPath}`);
					const resStorage = await this.disk.checkStorage('storage', {
						path: currentPath,
						// basically will fail if disk is full
						thresholdPercent: 99.999999
					});
					console.log(`Storage check ${uniqueLabel} completed`);
					return resStorage;
				} catch (err) {
					console.error(`Storage check ${uniqueLabel} failed`, err);
					return {
						disk: {
							status: 'down',
							message: err.message
						}
					};
				}
			});
		}

		if (this.checkCache) {
			checks.push(async () => {
				console.log(`Checking ${uniqueLabel} Cache...`);
				const resCache = await this.cacheHealthIndicator.isHealthy('cache');
				console.log(`Cache check ${uniqueLabel} completed`);
				return resCache;
			});
		}

		if (this.checkRedis) {
			if (process.env.REDIS_ENABLED === 'true') {
				checks.push(async () => {
					console.log(`Checking ${uniqueLabel} Redis...`);
					const resRedis = await this.redisHealthIndicator.isHealthy('redis');
					console.log(`Redis check ${uniqueLabel} completed`);
					return resRedis;
				});
			}
		}

		const result = await this.health.check(checks);

		console.timeEnd(uniqueLabel);

		console.log(`Health check ${uniqueLabel} result: ${JSON.stringify(result)}`);

		return result;
	}
}
