import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddAllowEmployeeToSeeTrackedDataToOrganization1790000015000 implements MigrationInterface {
	name = 'AddAllowEmployeeToSeeTrackedDataToOrganization1790000015000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));
		const dbEngine = queryRunner.connection.options.type as DatabaseTypeEnum;
		const queryMap: Record<string, string> = {
			[DatabaseTypeEnum.postgres]: `ALTER TABLE "organization" ADD "allowEmployeeToSeeTrackedData" boolean NOT NULL DEFAULT true`,
			[DatabaseTypeEnum.sqlite]: `ALTER TABLE "organization" ADD COLUMN "allowEmployeeToSeeTrackedData" boolean NOT NULL DEFAULT 1`,
			[DatabaseTypeEnum.betterSqlite3]: `ALTER TABLE "organization" ADD COLUMN "allowEmployeeToSeeTrackedData" boolean NOT NULL DEFAULT 1`,
			[DatabaseTypeEnum.mysql]: 'ALTER TABLE `organization` ADD `allowEmployeeToSeeTrackedData` tinyint NOT NULL DEFAULT 1'
		};
		const sql = queryMap[dbEngine];
		if (!sql) {
			throw new Error(`Unsupported database engine: ${dbEngine}`);
		}
		await queryRunner.query(sql);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} reverting changes!`));
		const dbEngine = queryRunner.connection.options.type as DatabaseTypeEnum;
		const revertMap: Record<string, string> = {
			[DatabaseTypeEnum.postgres]: `ALTER TABLE "organization" DROP COLUMN "allowEmployeeToSeeTrackedData"`,
			[DatabaseTypeEnum.sqlite]: `ALTER TABLE "organization" DROP COLUMN "allowEmployeeToSeeTrackedData"`,
			[DatabaseTypeEnum.betterSqlite3]: `ALTER TABLE "organization" DROP COLUMN "allowEmployeeToSeeTrackedData"`,
			[DatabaseTypeEnum.mysql]: 'ALTER TABLE `organization` DROP COLUMN `allowEmployeeToSeeTrackedData`',
		};
		const sql = revertMap[dbEngine];
		if (!sql) {
			throw new Error(`Unsupported database engine: ${dbEngine}`);
		}
		await queryRunner.query(sql);
	}
}
