import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddIdToTaskProjectSequence1746089221966 implements MigrationInterface {
	name = 'AddIdToTaskProjectSequence1746089221966';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(`DROP INDEX "public"."IDX_86f4bd7d26fc9f9fbcfd9ff3a3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_afecce26acb3f52cdc936fe3e9"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "deletedAt"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "createdAt"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "updatedAt"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "isActive"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "isArchived"`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP COLUMN "archivedAt"`);
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

		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "isArchived" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "isActive" boolean DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
		await queryRunner.query(`ALTER TABLE "task_project_sequence" ADD "deletedAt" TIMESTAMP`);
		await queryRunner.query(
			`CREATE INDEX "IDX_afecce26acb3f52cdc936fe3e9" ON "task_project_sequence" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86f4bd7d26fc9f9fbcfd9ff3a3" ON "task_project_sequence" ("isActive") `
		);
	}
}
