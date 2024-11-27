import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSubscriptionTable1732685369636 implements MigrationInterface {
	name = 'CreateSubscriptionTable1732685369636';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		Logger.debug(yellow(this.name + ' start running!'), 'Migration');

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "subscription" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entityId" character varying NOT NULL, "entity" character varying NOT NULL, "subscriptionType" character varying NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_a0ce0007cfcc8e6ee405d0272f" ON "subscription" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6eafe9ba53fdd744cd1cffede8" ON "subscription" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c86077795cb9a3ce80d19d670a" ON "subscription" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ccdfc22892c16950b568145d5" ON "subscription" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_404bc7ad0e4734744372d656fe" ON "subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb98de07e0868a9951e4d9b353" ON "subscription" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_59d935a1de99d140f45550f344" ON "subscription" ("subscriptionType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cc906b4bc892b048f1b654d2aa" ON "subscription" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_c86077795cb9a3ce80d19d670a5" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_8ccdfc22892c16950b568145d53" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD CONSTRAINT "FK_cc906b4bc892b048f1b654d2aa0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_cc906b4bc892b048f1b654d2aa0"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_8ccdfc22892c16950b568145d53"`);
		await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_c86077795cb9a3ce80d19d670a5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cc906b4bc892b048f1b654d2aa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_59d935a1de99d140f45550f344"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cb98de07e0868a9951e4d9b353"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_404bc7ad0e4734744372d656fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8ccdfc22892c16950b568145d5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c86077795cb9a3ce80d19d670a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6eafe9ba53fdd744cd1cffede8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a0ce0007cfcc8e6ee405d0272f"`);
		await queryRunner.query(`DROP TABLE "subscription"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
