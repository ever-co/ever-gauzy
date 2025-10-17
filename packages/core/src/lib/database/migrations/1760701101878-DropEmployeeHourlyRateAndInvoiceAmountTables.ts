import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class DropEmployeeHourlyRateAndInvoiceAmountTables1760701101878 implements MigrationInterface {
	name = 'DropEmployeeHourlyRateAndInvoiceAmountTables1760701101878';

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
		// Drop constraints first
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_fa2971f1065c6ecf64ba5751ef4"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_7096117cce755ff238ec753383f"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_0fd8897992e10c4dd859e1aa8a7"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_0caa517682fe26493d245b71212"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_33fa640e4bed11186c25df43823"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" DROP CONSTRAINT IF EXISTS "FK_a29f881662e2f22ac136797d857"`
		);

		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_7954aa432887e1cfd5642722de8"`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_6d27b3bebd314c13693443d644c"`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_9928a2e0aa0fbfb757348f9fa50"`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_d15694c79a6a27d5cf0bb20c08c"`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_37efac4da805e463681d2176cf9"`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" DROP CONSTRAINT IF EXISTS "FK_c7a1697f2356c6af661c6b04304"`
		);

		// Drop indexes
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fa2971f1065c6ecf64ba5751ef"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_d1743871f2c33fda51fa0c9c60"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cac6469572d8f88e8d2dba864b"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_7096117cce755ff238ec753383"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_0fd8897992e10c4dd859e1aa8a"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_3ede07ea4e2d2e7d754145235e"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ee46d8c98712067aac95ce567e"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_0caa517682fe26493d245b7121"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_33fa640e4bed11186c25df4382"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_a29f881662e2f22ac136797d85"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_7954aa432887e1cfd5642722de"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_6d27b3bebd314c13693443d644"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_9928a2e0aa0fbfb757348f9fa5"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_8e15e07dac0502af4c799d963c"`);

		// Drop tables
		await queryRunner.query(`DROP TABLE IF EXISTS "employee_hourly_rate" CASCADE`);
		await queryRunner.query(`DROP TABLE IF EXISTS "invoice_amount" CASCADE`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`
            CREATE TABLE "employee_hourly_rate" (
                "deletedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdByUserId" uuid,
                "updatedByUserId" uuid,
                "deletedByUserId" uuid,
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "isActive" boolean DEFAULT true,
                "isArchived" boolean DEFAULT false,
                "archivedAt" TIMESTAMP,
                "tenantId" uuid,
                "organizationId" uuid,
                "entity" character varying NOT NULL,
                "entityId" character varying NOT NULL,
                "billRateValue" integer,
                "minimumBillingRate" integer,
                "billRateCurrency" character varying,
                "lastUpdate" TIMESTAMP NOT NULL DEFAULT now(),
                "employeeId" uuid,
                CONSTRAINT "PK_abbb9c9e334132c635108b245af" PRIMARY KEY ("id")
            )
        `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a29f881662e2f22ac136797d85" ON "employee_hourly_rate" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_33fa640e4bed11186c25df4382" ON "employee_hourly_rate" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0caa517682fe26493d245b7121" ON "employee_hourly_rate" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_ee46d8c98712067aac95ce567e" ON "employee_hourly_rate" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_3ede07ea4e2d2e7d754145235e" ON "employee_hourly_rate" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_0fd8897992e10c4dd859e1aa8a" ON "employee_hourly_rate" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7096117cce755ff238ec753383" ON "employee_hourly_rate" ("organizationId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_cac6469572d8f88e8d2dba864b" ON "employee_hourly_rate" ("entity")`);
		await queryRunner.query(`CREATE INDEX "IDX_d1743871f2c33fda51fa0c9c60" ON "employee_hourly_rate" ("entityId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa2971f1065c6ecf64ba5751ef" ON "employee_hourly_rate" ("employeeId")`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_a29f881662e2f22ac136797d857" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_33fa640e4bed11186c25df43823" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_0caa517682fe26493d245b71212" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_0fd8897992e10c4dd859e1aa8a7" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_7096117cce755ff238ec753383f" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_hourly_rate" ADD CONSTRAINT "FK_fa2971f1065c6ecf64ba5751ef4" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(`
            CREATE TABLE "invoice_amount" (
                "deletedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdByUserId" uuid,
                "updatedByUserId" uuid,
                "deletedByUserId" uuid,
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "isActive" boolean DEFAULT true,
                "isArchived" boolean DEFAULT false,
                "archivedAt" TIMESTAMP,
                "tenantId" uuid,
                "organizationId" uuid,
                "totalValue" numeric,
                "currency" character varying,
                "invoiceId" uuid,
                CONSTRAINT "PK_08acf694acac8004aa6c9a88610" PRIMARY KEY ("id")
            )
        `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7a1697f2356c6af661c6b0430" ON "invoice_amount" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_37efac4da805e463681d2176cf" ON "invoice_amount" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d15694c79a6a27d5cf0bb20c08" ON "invoice_amount" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_9d8a66cdbc3a704dc763ce63bc" ON "invoice_amount" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_8e15e07dac0502af4c799d963c" ON "invoice_amount" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_9928a2e0aa0fbfb757348f9fa5" ON "invoice_amount" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_6d27b3bebd314c13693443d644" ON "invoice_amount" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_7954aa432887e1cfd5642722de" ON "invoice_amount" ("invoiceId")`);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_c7a1697f2356c6af661c6b04304" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_37efac4da805e463681d2176cf9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_d15694c79a6a27d5cf0bb20c08c" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_9928a2e0aa0fbfb757348f9fa50" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_6d27b3bebd314c13693443d644c" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_7954aa432887e1cfd5642722de8" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "employee_hourly_rate"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "invoice_amount"`);
	}

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
