import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Leave management backend for issue #314:
 *
 *  - `official_holiday` — the "OfficialHolidays" table the issue asks for, so the "Add Holidays"
 *    dialog can offer a predefined list per country and pre-fill the From/To dates.
 *  - `time_off_balance` — accrued / taken / carried-forward days per employee, per policy, per
 *    year. `(tenantId, organizationId, employeeId, policyId, year)` is UNIQUE: without it two
 *    concurrent allocations would each insert a row, and days deducted from one balance would
 *    still look available on the other.
 *  - Seven additive, NULLABLE columns on `time_off_policy` carrying the entitlement and accrual
 *    configuration the balances are computed from.
 *
 * Additive only. Two new tables plus nullable columns — nothing is dropped, renamed or retyped
 * and no row is written, so this is safe to run against a populated database.
 *
 * SQLite has no `ALTER TABLE ... ADD COLUMN` limitation that matters here (all seven columns are
 * nullable or carry a constant default), so the policy columns are added in place rather than by
 * rebuilding the table — a rebuild would have to copy every existing policy row for no reason.
 */
export class CreateTimeOffLeaveManagement1790000011000 implements MigrationInterface {
	name = 'CreateTimeOffLeaveManagement1790000011000';

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
			`CREATE TABLE "official_holiday" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "countryCode" character varying(2) NOT NULL, "date" date NOT NULL, "endDate" date, "isRecurring" boolean DEFAULT true, CONSTRAINT "PK_official_holiday_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_createdByUserId" ON "official_holiday" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_updatedByUserId" ON "official_holiday" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_deletedByUserId" ON "official_holiday" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_isActive" ON "official_holiday" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_isArchived" ON "official_holiday" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_tenantId" ON "official_holiday" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_organizationId" ON "official_holiday" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_name" ON "official_holiday" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_countryCode" ON "official_holiday" ("countryCode") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_date" ON "official_holiday" ("date") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_official_holiday_unique" ON "official_holiday" ("tenantId", "organizationId", "countryCode", "date", "name") `
		);
		await queryRunner.query(
			`ALTER TABLE "official_holiday" ADD CONSTRAINT "FK_official_holiday_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "official_holiday" ADD CONSTRAINT "FK_official_holiday_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "official_holiday" ADD CONSTRAINT "FK_official_holiday_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "official_holiday" ADD CONSTRAINT "FK_official_holiday_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "official_holiday" ADD CONSTRAINT "FK_official_holiday_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);

		await queryRunner.query(
			`CREATE TABLE "time_off_balance" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "year" integer NOT NULL, "accrued" numeric(10,2) NOT NULL DEFAULT '0', "taken" numeric(10,2) NOT NULL DEFAULT '0', "carriedForward" numeric(10,2) NOT NULL DEFAULT '0', "carriedOut" numeric(10,2) NOT NULL DEFAULT '0', "remaining" numeric(10,2) NOT NULL DEFAULT '0', "employeeId" uuid NOT NULL, "policyId" uuid NOT NULL, CONSTRAINT "PK_time_off_balance_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_createdByUserId" ON "time_off_balance" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_updatedByUserId" ON "time_off_balance" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_deletedByUserId" ON "time_off_balance" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_isActive" ON "time_off_balance" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_isArchived" ON "time_off_balance" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_tenantId" ON "time_off_balance" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_organizationId" ON "time_off_balance" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_year" ON "time_off_balance" ("year") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_employeeId" ON "time_off_balance" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_policyId" ON "time_off_balance" ("policyId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_time_off_balance_unique" ON "time_off_balance" ("tenantId", "organizationId", "employeeId", "policyId", "year") `
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_employeeId" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_balance" ADD CONSTRAINT "FK_time_off_balance_policyId" FOREIGN KEY ("policyId") REFERENCES "time_off_policy"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "leaveType" character varying`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "maxDaysPerYear" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "allowCarryForward" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "maxCarryForwardDays" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "accrualRate" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "accrualFrequency" character varying`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "isDefault" boolean DEFAULT false`);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_policy_leaveType" ON "time_off_policy" ("leaveType") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_policy_isDefault" ON "time_off_policy" ("isDefault") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_policy_isDefault"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_policy_leaveType"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "isDefault"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "accrualFrequency"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "accrualRate"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "maxCarryForwardDays"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "allowCarryForward"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "maxDaysPerYear"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "leaveType"`);

		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_policyId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_employeeId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_organizationId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_tenantId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_deletedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_balance" DROP CONSTRAINT "FK_time_off_balance_createdByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_unique"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_policyId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_employeeId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_year"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_time_off_balance_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "time_off_balance"`);

		await queryRunner.query(`ALTER TABLE "official_holiday" DROP CONSTRAINT "FK_official_holiday_organizationId"`);
		await queryRunner.query(`ALTER TABLE "official_holiday" DROP CONSTRAINT "FK_official_holiday_tenantId"`);
		await queryRunner.query(`ALTER TABLE "official_holiday" DROP CONSTRAINT "FK_official_holiday_deletedByUserId"`);
		await queryRunner.query(`ALTER TABLE "official_holiday" DROP CONSTRAINT "FK_official_holiday_updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "official_holiday" DROP CONSTRAINT "FK_official_holiday_createdByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_unique"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_date"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_countryCode"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_name"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_official_holiday_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "official_holiday"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "official_holiday" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "countryCode" varchar(2) NOT NULL, "date" date NOT NULL, "endDate" date, "isRecurring" boolean DEFAULT (1), CONSTRAINT "FK_official_holiday_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_official_holiday_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_official_holiday_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_official_holiday_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_official_holiday_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_createdByUserId" ON "official_holiday" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_updatedByUserId" ON "official_holiday" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_deletedByUserId" ON "official_holiday" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_isActive" ON "official_holiday" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_isArchived" ON "official_holiday" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_tenantId" ON "official_holiday" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_organizationId" ON "official_holiday" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_name" ON "official_holiday" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_official_holiday_countryCode" ON "official_holiday" ("countryCode") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_official_holiday_date" ON "official_holiday" ("date") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_official_holiday_unique" ON "official_holiday" ("tenantId", "organizationId", "countryCode", "date", "name") `
		);

		await queryRunner.query(
			`CREATE TABLE "time_off_balance" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "year" integer NOT NULL, "accrued" numeric(10,2) NOT NULL DEFAULT (0), "taken" numeric(10,2) NOT NULL DEFAULT (0), "carriedForward" numeric(10,2) NOT NULL DEFAULT (0), "carriedOut" numeric(10,2) NOT NULL DEFAULT (0), "remaining" numeric(10,2) NOT NULL DEFAULT (0), "employeeId" varchar NOT NULL, "policyId" varchar NOT NULL, CONSTRAINT "FK_time_off_balance_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_time_off_balance_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_time_off_balance_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_time_off_balance_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_time_off_balance_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_time_off_balance_employeeId" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_time_off_balance_policyId" FOREIGN KEY ("policyId") REFERENCES "time_off_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_createdByUserId" ON "time_off_balance" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_updatedByUserId" ON "time_off_balance" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_deletedByUserId" ON "time_off_balance" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_isActive" ON "time_off_balance" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_isArchived" ON "time_off_balance" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_tenantId" ON "time_off_balance" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_time_off_balance_organizationId" ON "time_off_balance" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_year" ON "time_off_balance" ("year") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_employeeId" ON "time_off_balance" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_balance_policyId" ON "time_off_balance" ("policyId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_time_off_balance_unique" ON "time_off_balance" ("tenantId", "organizationId", "employeeId", "policyId", "year") `
		);

		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "leaveType" varchar`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "maxDaysPerYear" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "allowCarryForward" boolean DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "maxCarryForwardDays" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "accrualRate" numeric(10,2)`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "accrualFrequency" varchar`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD COLUMN "isDefault" boolean DEFAULT (0)`);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_policy_leaveType" ON "time_off_policy" ("leaveType") `);
		await queryRunner.query(`CREATE INDEX "IDX_time_off_policy_isDefault" ON "time_off_policy" ("isDefault") `);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_time_off_policy_isDefault"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_policy_leaveType"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "isDefault"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "accrualFrequency"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "accrualRate"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "maxCarryForwardDays"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "allowCarryForward"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "maxDaysPerYear"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "leaveType"`);

		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_policyId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_employeeId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_year"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_time_off_balance_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "time_off_balance"`);

		await queryRunner.query(`DROP INDEX "IDX_official_holiday_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_date"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_countryCode"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_name"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_official_holiday_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "official_holiday"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`official_holiday\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`countryCode\` varchar(2) NOT NULL, \`date\` date NOT NULL, \`endDate\` date NULL, \`isRecurring\` tinyint NULL DEFAULT 1, INDEX \`IDX_official_holiday_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_official_holiday_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_official_holiday_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_official_holiday_isActive\` (\`isActive\`), INDEX \`IDX_official_holiday_isArchived\` (\`isArchived\`), INDEX \`IDX_official_holiday_tenantId\` (\`tenantId\`), INDEX \`IDX_official_holiday_organizationId\` (\`organizationId\`), INDEX \`IDX_official_holiday_name\` (\`name\`), INDEX \`IDX_official_holiday_countryCode\` (\`countryCode\`), INDEX \`IDX_official_holiday_date\` (\`date\`), UNIQUE INDEX \`IDX_official_holiday_unique\` (\`tenantId\`, \`organizationId\`, \`countryCode\`, \`date\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` ADD CONSTRAINT \`FK_official_holiday_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` ADD CONSTRAINT \`FK_official_holiday_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` ADD CONSTRAINT \`FK_official_holiday_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` ADD CONSTRAINT \`FK_official_holiday_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` ADD CONSTRAINT \`FK_official_holiday_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);

		await queryRunner.query(
			`CREATE TABLE \`time_off_balance\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`year\` int NOT NULL, \`accrued\` decimal(10,2) NOT NULL DEFAULT '0', \`taken\` decimal(10,2) NOT NULL DEFAULT '0', \`carriedForward\` decimal(10,2) NOT NULL DEFAULT '0', \`carriedOut\` decimal(10,2) NOT NULL DEFAULT '0', \`remaining\` decimal(10,2) NOT NULL DEFAULT '0', \`employeeId\` varchar(255) NOT NULL, \`policyId\` varchar(255) NOT NULL, INDEX \`IDX_time_off_balance_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_time_off_balance_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_time_off_balance_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_time_off_balance_isActive\` (\`isActive\`), INDEX \`IDX_time_off_balance_isArchived\` (\`isArchived\`), INDEX \`IDX_time_off_balance_tenantId\` (\`tenantId\`), INDEX \`IDX_time_off_balance_organizationId\` (\`organizationId\`), INDEX \`IDX_time_off_balance_year\` (\`year\`), INDEX \`IDX_time_off_balance_employeeId\` (\`employeeId\`), INDEX \`IDX_time_off_balance_policyId\` (\`policyId\`), UNIQUE INDEX \`IDX_time_off_balance_unique\` (\`tenantId\`, \`organizationId\`, \`employeeId\`, \`policyId\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_employeeId\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` ADD CONSTRAINT \`FK_time_off_balance_policyId\` FOREIGN KEY (\`policyId\`) REFERENCES \`time_off_policy\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`leaveType\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`maxDaysPerYear\` decimal(10,2) NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`allowCarryForward\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`maxCarryForwardDays\` decimal(10,2) NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`accrualRate\` decimal(10,2) NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`accrualFrequency\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`isDefault\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_time_off_policy_leaveType\` ON \`time_off_policy\` (\`leaveType\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_time_off_policy_isDefault\` ON \`time_off_policy\` (\`isDefault\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_time_off_policy_isDefault\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_time_off_policy_leaveType\` ON \`time_off_policy\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`isDefault\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`accrualFrequency\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`accrualRate\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`maxCarryForwardDays\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`allowCarryForward\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`maxDaysPerYear\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`leaveType\``);

		await queryRunner.query(`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_policyId\``);
		await queryRunner.query(`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_organizationId\``
		);
		await queryRunner.query(`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_tenantId\``);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_deletedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_updatedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_balance\` DROP FOREIGN KEY \`FK_time_off_balance_createdByUserId\``
		);
		await queryRunner.query(`DROP TABLE \`time_off_balance\``);

		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` DROP FOREIGN KEY \`FK_official_holiday_organizationId\``
		);
		await queryRunner.query(`ALTER TABLE \`official_holiday\` DROP FOREIGN KEY \`FK_official_holiday_tenantId\``);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` DROP FOREIGN KEY \`FK_official_holiday_deletedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` DROP FOREIGN KEY \`FK_official_holiday_updatedByUserId\``
		);
		await queryRunner.query(
			`ALTER TABLE \`official_holiday\` DROP FOREIGN KEY \`FK_official_holiday_createdByUserId\``
		);
		await queryRunner.query(`DROP TABLE \`official_holiday\``);
	}
}
