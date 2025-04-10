import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddEmployeeFieldToInvoice1744227057054 implements MigrationInterface {
	name = 'AddEmployeeFieldToInvoice1744227057054';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		await queryRunner.query(`ALTER TABLE "invoice" ADD "employeeId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_613c4af16812ddfc39c6a6e41f" ON "invoice" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_613c4af16812ddfc39c6a6e41f6" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE`
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

		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_613c4af16812ddfc39c6a6e41f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_613c4af16812ddfc39c6a6e41f"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "employeeId"`);
	}
}
