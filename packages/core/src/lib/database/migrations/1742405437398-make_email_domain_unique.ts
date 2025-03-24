import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class MakeEmailDomainUnique1742405437398 implements MigrationInterface {
	name = 'MakeEmailDomainUnique1742405437398';

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
			`CREATE UNIQUE INDEX "IDX_20ff57b9178bf4ee401365fe6c" ON "organization" ("emailDomain") WHERE "emailDomain" IS NOT NULL`
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
		await queryRunner.query(`DROP INDEX "public"."IDX_20ff57b9178bf4ee401365fe6c"`);
	}
}
