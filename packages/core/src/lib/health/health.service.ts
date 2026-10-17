import { Injectable, Logger } from '@nestjs/common';
import {
	HealthCheckService,
	TypeOrmHealthIndicator,
	DiskHealthIndicator,
	MikroOrmHealthIndicator,
	HealthCheckResult
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as path from 'node:path';
import { getORMType, MultiORM, MultiORMEnum } from '../core/utils';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';


// Readiness probes call the health check every few seconds: its progress lines are debug-level (LOG_LEVEL).
const logger = new Logger('HealthService');
@Injectable()
export class HealthService {
	private readonly ormType: MultiORM;
	private readonly checkDb = true;
	private readonly checkStorage = true;
	private readonly checkCache = true;
	private readonly checkRedis = true;

	// Note: we disable by default because we notice some connection
	// related issues with Terminus DB checks (in MikroORM)
	private readonly checkDbWithTerminus = false;

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly diskHealthIndicator: DiskHealthIndicator,
		private readonly healthCheckService: HealthCheckService,
		private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
		private readonly mikroOrmHealthIndicator: MikroOrmHealthIndicator,
		private readonly cacheHealthIndicator: CacheHealthIndicator,
		private readonly redisHealthIndicator: RedisHealthIndicator,
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly mikroOrmUserRepository: MikroOrmUserRepository
	) {
		this.ormType = getORMType();
	}

	/**
	 * Checks the health status of the application.
	 *
	 * @returns {Promise<HealthIndicatorResult>} - A promise resolving to the health check result.
	 */
	async getHealthStatus(): Promise<HealthCheckResult> {
		const uniqueLabel = `HealthCheckExecutionTimer-${uuid()}`;
		logger.debug(`Health check started: ${uniqueLabel}`);
		const startedAt = Date.now();

		const checks = [];

		if (this.checkDb) {
			checks.push(async () => {
				logger.debug(`Checking ${uniqueLabel} Database...`);

				if (this.ormType === MultiORMEnum.TypeORM) {
					return await this.checkDatabaseTypeOrm(uniqueLabel);
				}

				if (this.ormType === MultiORMEnum.MikroORM) {
					return await this.checkDatabaseMikroOrm(uniqueLabel);
				}

				throw new Error('ORM not supported');
			});
		}

		if (this.checkStorage) {
			checks.push(async () => {
				logger.debug(`Checking ${uniqueLabel} Storage...`);
				try {
					const currentPath = path.resolve(__dirname);
					logger.debug(`Checking ${uniqueLabel} Storage at path: ${currentPath}`);
					const resStorage = await this.diskHealthIndicator.checkStorage('storage', {
						path: currentPath,
						// basically will fail if disk is full
						thresholdPercent: 99.999999
					});
					logger.debug(`Storage check ${uniqueLabel} completed`);
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
				logger.debug(`Checking ${uniqueLabel} Cache...`);
				const resCache = await this.cacheHealthIndicator.isHealthy('cache');
				logger.debug(`Cache check ${uniqueLabel} completed`);
				return resCache;
			});
		}

		if (this.checkRedis) {
			if (process.env.REDIS_ENABLED === 'true') {
				checks.push(async () => {
					logger.debug(`Checking ${uniqueLabel} Redis...`);
					const resRedis = await this.redisHealthIndicator.isHealthy('redis');
					logger.debug(`Redis check ${uniqueLabel} completed`);
					return resRedis;
				});
			}
		}

		const result = await this.healthCheckService.check(checks);

		const tookMs = Date.now() - startedAt;

		// Probes call this every few seconds on every pod: a healthy result is a debug line, anything else a warning.
		if (result?.status === 'ok') {
			logger.debug(`Health check ${uniqueLabel} result (${tookMs}ms): ${JSON.stringify(result)}`);
		} else {
			logger.warn(`Health check ${uniqueLabel} result (${tookMs}ms): ${JSON.stringify(result)}`);
		}

		return result;
	}

	/**
	 * Checks the health status of the TypeORM database.
	 *
	 * @param {string} uniqueLabel - The unique label for the health check.
	 * @returns {Promise<HealthCheckResult>} - A promise resolving to the health check result.
	 */
	private async checkDatabaseTypeOrm(uniqueLabel: string) {
		let queryRunner: QueryRunner;

		try {
			let message: string;

			if (this.checkDbWithTerminus) {
				queryRunner = this.dataSource.createQueryRunner();

				const resDatabase = await this.typeOrmHealthIndicator.pingCheck('database', {
					connection: queryRunner.dataSource,
					timeout: 60000
				});

				message = resDatabase?.database?.message;
			}

			const usersCount = await this.typeOrmUserRepository.count();
			logger.debug(`Database (TypeORM) users count ${uniqueLabel} is: ${usersCount}`);
			logger.debug(`Database (TypeORM) check ${uniqueLabel} completed`);

			return {
				database: {
					status: 'up',
					message
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
	}

	/**
	 * Checks the health status of the MikroORM database.
	 *
	 * @param {string} uniqueLabel - The unique label for the health check.
	 * @returns {Promise<HealthCheckResult>} - A promise resolving to the health check result.
	 */
	private async checkDatabaseMikroOrm(uniqueLabel: string) {
		try {
			let message: string;

			if (this.checkDbWithTerminus) {
				const resDatabase = await this.mikroOrmHealthIndicator.pingCheck('database', {
					timeout: 60000
				});

				message = resDatabase?.database?.message;
			}

			const usersCount = await this.mikroOrmUserRepository.count();
			logger.debug(`Database (MikroORM) users count ${uniqueLabel} is: ${usersCount}`);
			logger.debug(`Database (MikroORM) check ${uniqueLabel} completed`);

			return {
				database: {
					status: 'up',
					message
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
	}
}
