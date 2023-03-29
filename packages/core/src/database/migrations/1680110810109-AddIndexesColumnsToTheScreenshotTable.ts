import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesColumnsToTheScreenshotTable1680110810109 implements MigrationInterface {
	name = 'AddIndexesColumnsToTheScreenshotTable1680110810109';

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
		await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_2b374e5cdee1145ebb2a832f20"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_785958f324b568a307c9496909"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3d7feb5fe793e4811cdb79f983"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE INDEX "IDX_3d7feb5fe793e4811cdb79f983" ON "screenshot" ("recordedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_785958f324b568a307c9496909" ON "screenshot" ("deletedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b374e5cdee1145ebb2a832f20" ON "screenshot" ("storageProvider") `);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_2b374e5cdee1145ebb2a832f20"`);
		await queryRunner.query(`DROP INDEX "IDX_785958f324b568a307c9496909"`);
		await queryRunner.query(`DROP INDEX "IDX_3d7feb5fe793e4811cdb79f983"`);
	}
}
