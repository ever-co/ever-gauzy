import { MikroInjectRepository, Public } from '@gauzy/common';
import { Controller, Get } from '@nestjs/common';
import {
	HealthCheckService,
	TypeOrmHealthIndicator,
	DiskHealthIndicator,
	MikroOrmHealthIndicator
} from '@nestjs/terminus';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { getORMType, MultiORM, MultiORMEnum } from 'core/utils';
import { User } from 'user/user.entity';
import { EntityRepository } from '@mikro-orm/core';

@Controller('health')
export class HealthController {
	constructor(
		@InjectDataSource()
		private readonly dataSource: DataSource,
		private readonly health: HealthCheckService,
		private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
		private readonly mikroOrmHealthIndicator: MikroOrmHealthIndicator,
		private readonly disk: DiskHealthIndicator,
		private readonly cacheHealthIndicator: CacheHealthIndicator,
		private readonly redisHealthIndicator: RedisHealthIndicator,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@MikroInjectRepository(User)
		private readonly mikroUserRepository: EntityRepository<User>
	) {
		this.ormType = getORMType();
	}

	private readonly ormType: MultiORM;

	@Public()
	@Get()
	async check() {
		const uniqueLabel = `HealthCheckExecutionTimer-${uuid()}`;
		console.log('Health check started: ', uniqueLabel);
		console.time(uniqueLabel);

		const checks = [];

		checks.push(async () => {
			console.log(`Checking ${uniqueLabel} Database...`);
			switch (this.ormType) {
				case MultiORMEnum.TypeORM:
					const queryRunner = this.dataSource.createQueryRunner();
					try {
						const resDatabase = await this.typeOrmHealthIndicator.pingCheck('database', {
							connection: queryRunner.connection,
							timeout: 60000
						});

						const usersCount = await this.userRepository.count();

						console.log(`Database (TypeORM) users count ${uniqueLabel} is ${usersCount}`);

						console.log(`Database (TypeORM) check ${uniqueLabel} completed`);
						return resDatabase;
					} catch (err) {
						console.error(`Database (TypeORM) check ${uniqueLabel} failed`, err);
						return {
							database: {
								status: 'down',
								message: err.message
							}
						};
					} finally {
						await queryRunner.release();
					}
				case MultiORMEnum.MikroORM:
					try {
						const resDatabase = await this.mikroOrmHealthIndicator.pingCheck('database', {
							timeout: 60000
						});

						const usersCount = await this.mikroUserRepository.count();

						console.log(`Database (MikroORM) users count ${uniqueLabel} is ${usersCount}`);

						console.log(`Database (MikroORM) check ${uniqueLabel} completed`);
						return resDatabase;
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
	}
}
