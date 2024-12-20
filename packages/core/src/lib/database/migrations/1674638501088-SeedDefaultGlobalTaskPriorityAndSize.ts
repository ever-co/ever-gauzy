import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidV4 } from 'uuid';
import { DEFAULT_GLOBAL_PRIORITIES } from '../../tasks/priorities/default-global-priorities';
import { DEFAULT_GLOBAL_SIZES } from '../../tasks/sizes/default-global-sizes';
import { DatabaseTypeEnum } from "@gauzy/config";

export class SeedDefaultGlobalTaskPriorityAndSize1674638501088 implements MigrationInterface {
	name = 'SeedDefaultGlobalTaskPriorityAndSize1674638501088';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteSeedDefaultTaskPriorities(queryRunner);
				await this.sqliteSeedDefaultTaskSizes(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresSeedDefaultTaskPriorities(queryRunner);
				await this.postgresSeedDefaultTaskSizes(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlSeedDefaultTastPriorities(queryRunner);
				await this.mysqlSeedDefaultTaskSizes(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> { }

	/**
	 * Sqlite default task priorities
	 *
	 * @param queryRunner
	 */
	async sqliteSeedDefaultTaskPriorities(queryRunner: QueryRunner) {
		try {
			const DEFAULT_GLOBAL_PRIORITIES_SQLITE = DEFAULT_GLOBAL_PRIORITIES.map((priority) => {
				return {
					...priority,
					isSystem: 1 // Transform boolean true to integer 1
				};
			});

			for await (const priority of DEFAULT_GLOBAL_PRIORITIES_SQLITE) {
				const payload = Object.values(priority);
				payload.push(uuidV4());
				const query = `INSERT INTO "task_priority" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES(?, ?, ?, ?, ?, ?, ?)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task priorities in production server', error);
		}
	}

	/**
	 * Sqlite default task sizes
	 *
	 * @param queryRunner
	 */
	async sqliteSeedDefaultTaskSizes(queryRunner: QueryRunner) {
		try {
			const DEFAULT_GLOBAL_SIZES_SQLITE = DEFAULT_GLOBAL_SIZES.map((priority) => {
				return {
					...priority,
					isSystem: 1 // Transform boolean true to integer 1
				};
			});

			for await (const size of DEFAULT_GLOBAL_SIZES_SQLITE) {
				const payload = Object.values(size);
				payload.push(uuidV4());
				const query = `INSERT INTO "task_size" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES(?, ?, ?, ?, ?, ?, ?)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task sizes in production server', error);
		}
	}
	/**
	 * Postgres default task priorities
	 *
	 * @param queryRunner
	 */
	async postgresSeedDefaultTaskPriorities(queryRunner: QueryRunner) {
		try {
			for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
				const payload = Object.values(priority);
				const query = `INSERT INTO "task_priority" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task priorities in production server', error);
		}
	}

	/**
	 * Postgres default task sizes
	 *
	 * @param queryRunner
	 */
	async postgresSeedDefaultTaskSizes(queryRunner: QueryRunner) {
		try {
			for await (const size of DEFAULT_GLOBAL_SIZES) {
				const payload = Object.values(size);
				const query = `INSERT INTO "task_size" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task sizes in production server', error);
		}
	}

	/**
	 * MySQL default task priorities
	 *
	 * @param queryRunner
	 */
	public async mysqlSeedDefaultTastPriorities(queryRunner: QueryRunner): Promise<any> {
	}

	/**
	 * MySQL default task sizes
	 *
	 * @param queryRunner
	 */
	public async mysqlSeedDefaultTaskSizes(queryRunner: QueryRunner): Promise<any> {
	}
}
