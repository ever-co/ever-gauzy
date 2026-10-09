import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `payroll_run` and `payroll_item` — the payroll module of issue #2453.
 *
 * Pure additive DDL: two new tables, their indexes and their foreign keys. No existing table,
 * column or row is touched, and `down()` drops exactly what `up()` created.
 *
 * Money columns are `numeric(14,2)` (`decimal(14,2)` on MySQL), never a floating point type.
 * `payroll_item.quantity` gets four decimal places because an hourly line can be a fraction of an
 * hour, while every currency amount stays at two.
 *
 * `payroll_item.employeeId` is nullable with `ON DELETE SET NULL` on purpose: a paid payroll run
 * is a financial record and must survive the removal of the employee record it paid.
 */
export class CreatePayrollTables1790000012000 implements MigrationInterface {
	name = 'CreatePayrollTables1790000012000';

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
			`CREATE TABLE "payroll_run" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "periodStart" date NOT NULL, "periodEnd" date NOT NULL, "payDate" date NOT NULL, "frequency" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "currency" character varying(3) NOT NULL, "totalGross" numeric(14,2) NOT NULL DEFAULT '0', "totalDeductions" numeric(14,2) NOT NULL DEFAULT '0', "totalNet" numeric(14,2) NOT NULL DEFAULT '0', "notes" character varying, "approvedAt" TIMESTAMP, "paidAt" TIMESTAMP, "approvedByUserId" uuid, CONSTRAINT "PK_payroll_run_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_createdByUserId" ON "payroll_run" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_updatedByUserId" ON "payroll_run" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_deletedByUserId" ON "payroll_run" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_isActive" ON "payroll_run" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_isArchived" ON "payroll_run" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_tenantId" ON "payroll_run" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_organizationId" ON "payroll_run" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_periodStart" ON "payroll_run" ("periodStart") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_status" ON "payroll_run" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_run_approvedByUserId" ON "payroll_run" ("approvedByUserId") `
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_run" ADD CONSTRAINT "FK_payroll_run_approvedByUserId" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "payroll_item" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "type" character varying NOT NULL, "category" character varying NOT NULL, "description" character varying, "amount" numeric(14,2) NOT NULL DEFAULT '0', "quantity" numeric(14,4), "unitPrice" numeric(14,2), "taxable" boolean NOT NULL DEFAULT true, "payrollRunId" uuid NOT NULL, "employeeId" uuid, CONSTRAINT "PK_payroll_item_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_createdByUserId" ON "payroll_item" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_updatedByUserId" ON "payroll_item" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_deletedByUserId" ON "payroll_item" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_isActive" ON "payroll_item" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_isArchived" ON "payroll_item" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_tenantId" ON "payroll_item" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_organizationId" ON "payroll_item" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_type" ON "payroll_item" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_category" ON "payroll_item" ("category") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_payrollRunId" ON "payroll_item" ("payrollRunId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_employeeId" ON "payroll_item" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_payrollRunId" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payroll_item" ADD CONSTRAINT "FK_payroll_item_employeeId" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_employeeId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_payrollRunId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_organizationId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_tenantId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_deletedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payroll_item" DROP CONSTRAINT "FK_payroll_item_createdByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_employeeId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_payrollRunId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_category"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_type"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_item_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "payroll_item"`);

		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_approvedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_organizationId"`);
		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_tenantId"`);
		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_deletedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payroll_run" DROP CONSTRAINT "FK_payroll_run_createdByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_approvedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_status"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_periodStart"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_organizationId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_tenantId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_isArchived"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_isActive"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_payroll_run_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "payroll_run"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "payroll_run" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "periodStart" date NOT NULL, "periodEnd" date NOT NULL, "payDate" date NOT NULL, "frequency" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('DRAFT'), "currency" varchar(3) NOT NULL, "totalGross" numeric(14,2) NOT NULL DEFAULT (0), "totalDeductions" numeric(14,2) NOT NULL DEFAULT (0), "totalNet" numeric(14,2) NOT NULL DEFAULT (0), "notes" varchar, "approvedAt" datetime, "paidAt" datetime, "approvedByUserId" varchar, CONSTRAINT "FK_payroll_run_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_run_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_run_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_run_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_run_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_payroll_run_approvedByUserId" FOREIGN KEY ("approvedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_createdByUserId" ON "payroll_run" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_updatedByUserId" ON "payroll_run" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_deletedByUserId" ON "payroll_run" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_isActive" ON "payroll_run" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_isArchived" ON "payroll_run" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_tenantId" ON "payroll_run" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_organizationId" ON "payroll_run" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_periodStart" ON "payroll_run" ("periodStart") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_run_status" ON "payroll_run" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_run_approvedByUserId" ON "payroll_run" ("approvedByUserId") `
		);

		await queryRunner.query(
			`CREATE TABLE "payroll_item" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar NOT NULL, "category" varchar NOT NULL, "description" varchar, "amount" numeric(14,2) NOT NULL DEFAULT (0), "quantity" numeric(14,4), "unitPrice" numeric(14,2), "taxable" boolean NOT NULL DEFAULT (1), "payrollRunId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_payroll_item_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_item_updatedByUserId" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_item_deletedByUserId" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_item_tenantId" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_item_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_payroll_item_payrollRunId" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_payroll_item_employeeId" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_createdByUserId" ON "payroll_item" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_updatedByUserId" ON "payroll_item" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_payroll_item_deletedByUserId" ON "payroll_item" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_isActive" ON "payroll_item" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_isArchived" ON "payroll_item" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_tenantId" ON "payroll_item" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_organizationId" ON "payroll_item" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_type" ON "payroll_item" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_category" ON "payroll_item" ("category") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_payrollRunId" ON "payroll_item" ("payrollRunId") `);
		await queryRunner.query(`CREATE INDEX "IDX_payroll_item_employeeId" ON "payroll_item" ("employeeId") `);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_employeeId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_payrollRunId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_category"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_type"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_item_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "payroll_item"`);

		await queryRunner.query(`DROP INDEX "IDX_payroll_run_approvedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_status"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_periodStart"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_organizationId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_tenantId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_isArchived"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_isActive"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_deletedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_updatedByUserId"`);
		await queryRunner.query(`DROP INDEX "IDX_payroll_run_createdByUserId"`);
		await queryRunner.query(`DROP TABLE "payroll_run"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`payroll_run\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`periodStart\` date NOT NULL, \`periodEnd\` date NOT NULL, \`payDate\` date NOT NULL, \`frequency\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'DRAFT', \`currency\` varchar(3) NOT NULL, \`totalGross\` decimal(14,2) NOT NULL DEFAULT '0.00', \`totalDeductions\` decimal(14,2) NOT NULL DEFAULT '0.00', \`totalNet\` decimal(14,2) NOT NULL DEFAULT '0.00', \`notes\` varchar(255) NULL, \`approvedAt\` datetime NULL, \`paidAt\` datetime NULL, \`approvedByUserId\` varchar(255) NULL, INDEX \`IDX_payroll_run_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_payroll_run_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_payroll_run_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_payroll_run_isActive\` (\`isActive\`), INDEX \`IDX_payroll_run_isArchived\` (\`isArchived\`), INDEX \`IDX_payroll_run_tenantId\` (\`tenantId\`), INDEX \`IDX_payroll_run_organizationId\` (\`organizationId\`), INDEX \`IDX_payroll_run_periodStart\` (\`periodStart\`), INDEX \`IDX_payroll_run_status\` (\`status\`), INDEX \`IDX_payroll_run_approvedByUserId\` (\`approvedByUserId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_run\` ADD CONSTRAINT \`FK_payroll_run_approvedByUserId\` FOREIGN KEY (\`approvedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`payroll_item\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`type\` varchar(255) NOT NULL, \`category\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`quantity\` decimal(14,4) NULL, \`unitPrice\` decimal(14,2) NULL, \`taxable\` tinyint NOT NULL DEFAULT 1, \`payrollRunId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_payroll_item_createdByUserId\` (\`createdByUserId\`), INDEX \`IDX_payroll_item_updatedByUserId\` (\`updatedByUserId\`), INDEX \`IDX_payroll_item_deletedByUserId\` (\`deletedByUserId\`), INDEX \`IDX_payroll_item_isActive\` (\`isActive\`), INDEX \`IDX_payroll_item_isArchived\` (\`isArchived\`), INDEX \`IDX_payroll_item_tenantId\` (\`tenantId\`), INDEX \`IDX_payroll_item_organizationId\` (\`organizationId\`), INDEX \`IDX_payroll_item_type\` (\`type\`), INDEX \`IDX_payroll_item_category\` (\`category\`), INDEX \`IDX_payroll_item_payrollRunId\` (\`payrollRunId\`), INDEX \`IDX_payroll_item_employeeId\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_createdByUserId\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_updatedByUserId\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_deletedByUserId\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_tenantId\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_organizationId\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_payrollRunId\` FOREIGN KEY (\`payrollRunId\`) REFERENCES \`payroll_run\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payroll_item\` ADD CONSTRAINT \`FK_payroll_item_employeeId\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_employeeId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_payrollRunId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_organizationId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_tenantId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_deletedByUserId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_updatedByUserId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_item\` DROP FOREIGN KEY \`FK_payroll_item_createdByUserId\``);
		await queryRunner.query(`DROP TABLE \`payroll_item\``);

		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_approvedByUserId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_organizationId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_tenantId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_deletedByUserId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_updatedByUserId\``);
		await queryRunner.query(`ALTER TABLE \`payroll_run\` DROP FOREIGN KEY \`FK_payroll_run_createdByUserId\``);
		await queryRunner.query(`DROP TABLE \`payroll_run\``);
	}
}
