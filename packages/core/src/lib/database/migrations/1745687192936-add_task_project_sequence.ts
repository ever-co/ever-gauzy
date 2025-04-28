import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddTaskProjectSequence1745687192936 implements MigrationInterface {
	name = 'AddTaskProjectSequence1745687192936';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(
			`CREATE TABLE "task_project_sequence" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "projectId" uuid NOT NULL, "taskNumber" integer NOT NULL, CONSTRAINT "REL_6c230afbc105b456796500a538" UNIQUE ("projectId"), CONSTRAINT "PK_53e8ac60d8d22a250d7511a6f8c" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86f4bd7d26fc9f9fbcfd9ff3a3" ON "task_project_sequence" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_afecce26acb3f52cdc936fe3e9" ON "task_project_sequence" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c230afbc105b456796500a538" ON "task_project_sequence" ("projectId") `
		);
		await queryRunner.query(`CREATE UNIQUE INDEX "projectSequence" ON "task_project_sequence" ("projectId") `);
		await queryRunner.query(
			`ALTER TABLE "task_project_sequence" ADD CONSTRAINT "FK_6c230afbc105b456796500a538b" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
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

		await queryRunner.query(`ALTER TABLE "task_project_sequence" DROP CONSTRAINT "FK_6c230afbc105b456796500a538b"`);
		await queryRunner.query(`DROP INDEX "public"."projectSequence"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c230afbc105b456796500a538"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_afecce26acb3f52cdc936fe3e9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_86f4bd7d26fc9f9fbcfd9ff3a3"`);
		await queryRunner.query(`DROP TABLE "task_project_sequence"`);
	}
}
