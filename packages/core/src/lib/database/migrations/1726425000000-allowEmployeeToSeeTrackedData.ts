import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AllowEmployeeToSeeTrackedData1726425000000 implements MigrationInterface {
	name = 'AllowEmployeeToSeeTrackedData1726425000000';

	private static readonly DIALECTS = {
		postgres: {
			addColumn: `ALTER TABLE "organization" ADD "allowEmployeeToSeeTrackedData" boolean NOT NULL DEFAULT true`,
			dropColumn: `ALTER TABLE "organization" DROP COLUMN "allowEmployeeToSeeTrackedData"`
		},
		sqlite: {
			addColumn: `ALTER TABLE "organization" ADD COLUMN "allowEmployeeToSeeTrackedData" boolean NOT NULL DEFAULT 1`,
			dropColumn: `ALTER TABLE "organization" DROP COLUMN "allowEmployeeToSeeTrackedData"`
		},
		mysql: {
			addColumn: 'ALTER TABLE `organization` ADD `allowEmployeeToSeeTrackedData` tinyint NOT NULL DEFAULT 1',
			dropColumn: 'ALTER TABLE `organization` DROP COLUMN `allowEmployeeToSeeTrackedData`'
		}
	} as const;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));
		const dialect = this.dialectFor(queryRunner);
		await queryRunner.query(dialect.addColumn);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} reverting changes!`));
		const dialect = this.dialectFor(queryRunner);
		await queryRunner.query(dialect.dropColumn);
	}

	private dialectFor(queryRunner: QueryRunner) {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		if (type === DatabaseTypeEnum.postgres) return AllowEmployeeToSeeTrackedData1726425000000.DIALECTS.postgres;
		if (type === DatabaseTypeEnum.mysql) return AllowEmployeeToSeeTrackedData1726425000000.DIALECTS.mysql;
		if (type === DatabaseTypeEnum.sqlite || type === DatabaseTypeEnum.betterSqlite3) {
			return AllowEmployeeToSeeTrackedData1726425000000.DIALECTS.sqlite;
		}
		throw new Error(`Unsupported database: ${type}`);
	}
}
