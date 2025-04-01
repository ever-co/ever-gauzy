import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddUserRelationshipToInvoice1743090970356 implements MigrationInterface {
	name = 'AddUserRelationshipToInvoice1743090970356';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		// Add the columns with nullable constraint
		await queryRunner.query(`ALTER TABLE "invoice" ADD "fromUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice" ADD "createdById" uuid`);

		// Find the first user to use as default for existing invoices
		const firstUser = await queryRunner.query(`SELECT id FROM "user" LIMIT 1`);
		if (firstUser && firstUser.length > 0) {
			const userId = firstUser[0].id;
			// Update existing invoices to set the user relationships
			await queryRunner.query(`
				UPDATE "invoice"
				SET "createdById" = '${userId}'
				WHERE "createdById" IS NULL
			`);
		}

		// Make the createdById column NOT NULL
		await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "createdById" SET NOT NULL`);

		// Add the indexes and constraints
		await queryRunner.query(`CREATE INDEX "IDX_8495235c265b32da92a9f3998d" ON "invoice" ("fromUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4bcf3dbe297a9bafbadec5a801" ON "invoice" ("createdById") `);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_8495235c265b32da92a9f3998d4" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_4bcf3dbe297a9bafbadec5a801e" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
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

		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_4bcf3dbe297a9bafbadec5a801e"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_8495235c265b32da92a9f3998d4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bcf3dbe297a9bafbadec5a801"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8495235c265b32da92a9f3998d"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "createdById"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "fromUserId"`);
	}
}
