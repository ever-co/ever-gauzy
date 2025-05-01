import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class RemoveCreatedByIdFromInvoices1746087197750 implements MigrationInterface {
	name = 'RemoveCreatedByIdFromInvoices1746087197750';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_4bcf3dbe297a9bafbadec5a801e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bcf3dbe297a9bafbadec5a801"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "createdById"`);
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

		await queryRunner.query(`ALTER TABLE "invoice" ADD "createdById" uuid NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_4bcf3dbe297a9bafbadec5a801" ON "invoice" ("createdById") `);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_4bcf3dbe297a9bafbadec5a801e" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
		);
	}
}
