import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddDomainFieldToOrganization1742316363177 implements MigrationInterface {
	name = 'AddDomainFieldToOrganization1742316363177';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
			throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
		await queryRunner.query(`ALTER TABLE "organization" ADD "emailDomain" character varying(1024) DEFAULT NULL`);
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
		await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "emailDomain"`);
	}
}
