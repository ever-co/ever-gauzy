import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidV4 } from 'uuid';
import { DEFAULT_GLOBAL_STATUSES } from '../../tasks/statuses/default-global-statuses';
import { DatabaseTypeEnum } from "@gauzy/config";

export class SeedDefaultGlobalTaskStatus1674044473393 implements MigrationInterface {
	name = 'SeedDefaultGlobalTaskStatus1674044473393';

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
				await this.sqliteSeedDefaultTaskStatus(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresSeedDefaultTaskStatus(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlSeedDefaultTaskStatus(queryRunner);
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
	 * Sqlite Seed Default task status
	 *
	 * @param queryRunner
	 */
	public async sqliteSeedDefaultTaskStatus(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		try {
			const DEFAULT_STATUSES = DEFAULT_GLOBAL_STATUSES.map(({ name, value, description, icon, color, isSystem }) => ({
				name,
				value,
				description,
				icon,
				color,
				isSystem
			}));

			const DEFAULT_STATUSES_SQLITE = DEFAULT_STATUSES.map((status) => ({
				...status,
				isSystem: status.isSystem === true ? 1 : 0 // Transform boolean true to integer 1, if the given database connection type is SQLite.
			}));

			for await (const status of DEFAULT_STATUSES_SQLITE) {
				const payload = Object.values(status);
				payload.push(uuidV4());

				const query = `INSERT INTO "status" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES(?, ?, ?, ?, ?, ?, ?)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task statuses in production server', error);
		}
	}

	/**
	 * Postgres Seed default task status
	 *
	 * @param queryRunner
	 */
	public async postgresSeedDefaultTaskStatus(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		try {
			const DEFAULT_STATUSES = DEFAULT_GLOBAL_STATUSES.map(({ name, value, description, icon, color, isSystem }) => ({
				name,
				value,
				description,
				icon,
				color,
				isSystem
			}));

			for await (const status of DEFAULT_STATUSES) {
				const payload = Object.values(status);

				const query = `INSERT INTO "status" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
				await queryRunner.connection.manager.query(query, payload);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global task statuses in production server', error);
		}
	}

	/**
	 * MySQL Seed default task status
	 *
	 * @param queryRunner
	 */
	public async mysqlSeedDefaultTaskStatus(queryRunner: QueryRunner): Promise<any> { }

}
