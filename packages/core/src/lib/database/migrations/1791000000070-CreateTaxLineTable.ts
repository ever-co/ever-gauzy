import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the tax ledger.
 *
 * One row per rate that applied to one taxed object, so a compound or multi-jurisdiction tax is fully
 * represented rather than collapsed into an amount. The table is part of the platform kernel because
 * every taxed document on the platform writes its breakdown here — an order line, an invoice line, a
 * return line — and because a second tax mechanism is how two documents come to disagree about the tax
 * on the same sale.
 *
 * There is no foreign key to a rate table: the rate is contributed by the tax capability, an
 * installation may compute tax through an external engine, and `name` and `rate` are snapshots taken
 * when the tax was computed precisely so that the ledger does not depend on the rate row surviving.
 */
export class CreateTaxLineTable1791000000070 implements MigrationInterface {
	name = 'CreateTaxLineTable1791000000070';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
			`CREATE TABLE "tax_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "ownerType" character varying(16) NOT NULL DEFAULT 'CART_LINE', "ownerId" uuid NOT NULL, "taxRateId" uuid, "code" character varying(64), "name" character varying(255) NOT NULL, "rate" numeric(9,6) NOT NULL, "isCompound" boolean NOT NULL DEFAULT false, "isInclusive" boolean NOT NULL DEFAULT false, "baseAmount" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "providerKey" character varying(64), "metadata" jsonb, CONSTRAINT "PK_tax_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_created_by_user" ON "tax_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_updated_by_user" ON "tax_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_deleted_by_user" ON "tax_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_is_active" ON "tax_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_is_archived" ON "tax_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_tenant" ON "tax_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_organization" ON "tax_line" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_tax_rate" ON "tax_line" ("taxRateId")`);
		// The ledger is summed per owner on every totals recomputation, reconciled per rate, and reported
		// per organization over a period.
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_owner" ON "tax_line" ("ownerType", "ownerId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_rate" ON "tax_line" ("taxRateId") WHERE "taxRateId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_org_created" ON "tax_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "tax_line"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "tax_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "ownerType" varchar NOT NULL DEFAULT ('CART_LINE'), "ownerId" varchar NOT NULL, "taxRateId" varchar, "code" varchar, "name" varchar NOT NULL, "rate" numeric(9,6) NOT NULL, "isCompound" boolean NOT NULL DEFAULT (0), "isInclusive" boolean NOT NULL DEFAULT (0), "baseAmount" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "providerKey" varchar, "metadata" text)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_created_by_user" ON "tax_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_updated_by_user" ON "tax_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_deleted_by_user" ON "tax_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_is_active" ON "tax_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_is_archived" ON "tax_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_tenant" ON "tax_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_organization" ON "tax_line" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_tax_line_tax_rate" ON "tax_line" ("taxRateId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_owner" ON "tax_line" ("ownerType", "ownerId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_rate" ON "tax_line" ("taxRateId") WHERE "taxRateId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tax_line_org_created" ON "tax_line" ("organizationId", "createdAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_tax_line_org_created"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_rate"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_owner"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_tax_rate"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_tax_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "tax_line"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`tax_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`ownerType\` varchar(16) NOT NULL DEFAULT 'CART_LINE', \`ownerId\` varchar(36) NOT NULL, \`taxRateId\` varchar(36) NULL, \`code\` varchar(64) NULL, \`name\` varchar(255) NOT NULL, \`rate\` decimal(9,6) NOT NULL, \`isCompound\` tinyint NOT NULL DEFAULT 0, \`isInclusive\` tinyint NOT NULL DEFAULT 0, \`baseAmount\` decimal(20,6) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`providerKey\` varchar(64) NULL, \`metadata\` json NULL, INDEX \`IDX_tax_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_tax_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_tax_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_tax_line_is_active\` (\`isActive\`), INDEX \`IDX_tax_line_is_archived\` (\`isArchived\`), INDEX \`IDX_tax_line_tenant\` (\`tenantId\`), INDEX \`IDX_tax_line_organization\` (\`organizationId\`), INDEX \`IDX_tax_line_tax_rate\` (\`taxRateId\`), INDEX \`IDX_tax_line_owner\` (\`ownerType\`, \`ownerId\`), INDEX \`IDX_tax_line_rate\` (\`taxRateId\`), INDEX \`IDX_tax_line_org_created\` (\`organizationId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`tax_line\``);
	}
}
