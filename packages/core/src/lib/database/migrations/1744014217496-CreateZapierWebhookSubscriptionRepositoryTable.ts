import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateZapierWebhookSubscriptionRepositoryTable1744014217496 implements MigrationInterface {
	name = 'CreateZapierWebhookSubscriptionRepositoryTable1744014217496';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

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
			`CREATE TABLE "zapier_webhook_subscription" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "targetUrl" character varying NOT NULL, "event" character varying NOT NULL, "integrationId" uuid, CONSTRAINT "PK_cc4ce4940b0ce5072d58a82532e" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bb6329dba3611e13d777e77178" ON "zapier_webhook_subscription" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_faf0707617abf423320b5a8377" ON "zapier_webhook_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3bf7411675f6cb093aadd19689" ON "zapier_webhook_subscription" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_08f81916eaa1967b6f6b1903bd" ON "zapier_webhook_subscription" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e6ce7627d2bb5bd4ba0ed53217" ON "zapier_webhook_subscription" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4481c88f8c66731a436bb3d5d8" ON "zapier_webhook_subscription" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_14479d220903bd9110f0267072" ON "zapier_webhook_subscription" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_22d421bdeb03778ca787febacf" ON "zapier_webhook_subscription" ("targetUrl") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8ca54536e5f73094ccc51a74ea" ON "zapier_webhook_subscription" ("event") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9bb1dffd8837c6909ec342a7d" ON "zapier_webhook_subscription" ("integrationId") `
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_bb6329dba3611e13d777e771787" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_faf0707617abf423320b5a8377f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_3bf7411675f6cb093aadd19689f" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_4481c88f8c66731a436bb3d5d8a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_14479d220903bd9110f02670723" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" ADD CONSTRAINT "FK_b9bb1dffd8837c6909ec342a7df" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_b9bb1dffd8837c6909ec342a7df"`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_14479d220903bd9110f02670723"`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_4481c88f8c66731a436bb3d5d8a"`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_3bf7411675f6cb093aadd19689f"`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_faf0707617abf423320b5a8377f"`
		);
		await queryRunner.query(
			`ALTER TABLE "zapier_webhook_subscription" DROP CONSTRAINT "FK_bb6329dba3611e13d777e771787"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_b9bb1dffd8837c6909ec342a7d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8ca54536e5f73094ccc51a74ea"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_22d421bdeb03778ca787febacf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_14479d220903bd9110f0267072"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4481c88f8c66731a436bb3d5d8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e6ce7627d2bb5bd4ba0ed53217"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_08f81916eaa1967b6f6b1903bd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3bf7411675f6cb093aadd19689"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_faf0707617abf423320b5a8377"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bb6329dba3611e13d777e77178"`);
		await queryRunner.query(`DROP TABLE "zapier_webhook_subscription"`);
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
