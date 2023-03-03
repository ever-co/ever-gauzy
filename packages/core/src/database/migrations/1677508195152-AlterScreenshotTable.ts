import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterScreenshotTable1677508195152 implements MigrationInterface {
	name = 'AlterScreenshotTable1677508195152';

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
			`ALTER TYPE "public"."screenshot_storageprovider_enum" RENAME TO "screenshot_storageprovider_enum_old"`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."screenshot_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY')`
		);
		await queryRunner.query(
			`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum"`
		);
		await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum_old"`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TYPE "public"."screenshot_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI')`
		);
		await queryRunner.query(
			`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum_old"`
		);
		await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum"`);
		await queryRunner.query(
			`ALTER TYPE "public"."screenshot_storageprovider_enum_old" RENAME TO "screenshot_storageprovider_enum"`
		);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
