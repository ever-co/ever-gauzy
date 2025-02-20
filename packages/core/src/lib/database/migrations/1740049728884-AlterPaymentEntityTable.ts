import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterPaymentEntityTable1740049728884 implements MigrationInterface {
	name = 'AlterPaymentEntityTable1740049728884';

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
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
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
	public async down(queryRunner: QueryRunner): Promise<void> {
		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_3f13c738eff604a85700746ec7d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3f13c738eff604a85700746ec7"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME COLUMN "recordedById" TO "createdByUserId"`);
		await queryRunner.query(`CREATE INDEX "IDX_6337f8d52d8eea1055ca8e3570" ON "payment" ("createdByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "payment"
			ADD CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6337f8d52d8eea1055ca8e3570"`);
		await queryRunner.query(`ALTER TABLE "payment" RENAME COLUMN "createdByUserId" TO "recordedById"`);
		await queryRunner.query(`CREATE INDEX "IDX_3f13c738eff604a85700746ec7" ON "payment" ("recordedById") `);
		await queryRunner.query(
			`ALTER TABLE "payment"
			ADD CONSTRAINT "FK_3f13c738eff604a85700746ec7d" FOREIGN KEY ("recordedById") REFERENCES "user"("id")
			ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
