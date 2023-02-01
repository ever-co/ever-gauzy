import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterUserTable1675224588607 implements MigrationInterface {
	name = 'AlterUserTable1675224588607';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.connection.options.type === 'sqlite') {
			await this.sqliteUpQueryRunner(queryRunner);
		} else {
			await this.postgresUpQueryRunner(queryRunner);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.connection.options.type === 'sqlite') {
			await this.sqliteDownQueryRunner(queryRunner);
		} else {
			await this.postgresDownQueryRunner(queryRunner);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "phoneNumber" character varying`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(
		queryRunner: QueryRunner
	): Promise<any> {
		await queryRunner.query(
			`DROP INDEX "public"."IDX_f2578043e491921209f5dadd08"`
		);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumber"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "phoneNumber" character varying`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DROP INDEX "public"."IDX_f2578043e491921209f5dadd08"`
		);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumber"`);
	}
}
