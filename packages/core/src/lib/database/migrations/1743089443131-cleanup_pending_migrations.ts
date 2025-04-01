import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CleanupPendingMigrations1743089443131 implements MigrationInterface {
	name = 'CleanupPendingMigrations1743089443131';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "fix_relational_custom_fields"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "repositoryId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "fix_relational_custom_fields"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "fix_relational_custom_fields"`);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(`ALTER TABLE "tag" ADD "fix_relational_custom_fields" boolean`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "fix_relational_custom_fields" boolean`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "repositoryId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee" ADD "fix_relational_custom_fields" boolean`);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}
}
