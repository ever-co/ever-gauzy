import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateEmployeeRecentVisitTable1746005191501 implements MigrationInterface {
	name = 'CreateEmployeeRecentVisitTable1746005191501';

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
			`CREATE TABLE "employee_recent_visit" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "visitedAt" TIMESTAMP NOT NULL, "data" jsonb, "employeeId" uuid, CONSTRAINT "PK_337d10740e5c38a4dd99e9168a0" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_29a13d42e1686288790b91631d" ON "employee_recent_visit" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_603d9f9c3b23f6cbf87a761aa9" ON "employee_recent_visit" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c472474d0a5a5d777a12d4200" ON "employee_recent_visit" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ba966575ea180d929e446307c9" ON "employee_recent_visit" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0fe0610d218d4362ccab57fd6d" ON "employee_recent_visit" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_effb569c0a0b84712024421280" ON "employee_recent_visit" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6b98339cd0a8b36e7b929cfd9" ON "employee_recent_visit" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5a460b235a6e64ab903e0ac6b9" ON "employee_recent_visit" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3cb1ed116242e84629d3ebc35" ON "employee_recent_visit" ("entityId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_45efdea12a6aead0412829553e" ON "employee_recent_visit" ("employeeId") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_29a13d42e1686288790b91631d0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_603d9f9c3b23f6cbf87a761aa9d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_1c472474d0a5a5d777a12d42009" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_effb569c0a0b84712024421280b" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_d6b98339cd0a8b36e7b929cfd95" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recent_visit" ADD CONSTRAINT "FK_45efdea12a6aead0412829553e4" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_45efdea12a6aead0412829553e4"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_d6b98339cd0a8b36e7b929cfd95"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_effb569c0a0b84712024421280b"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_1c472474d0a5a5d777a12d42009"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_603d9f9c3b23f6cbf87a761aa9d"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" DROP CONSTRAINT "FK_29a13d42e1686288790b91631d0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_45efdea12a6aead0412829553e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3cb1ed116242e84629d3ebc35"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5a460b235a6e64ab903e0ac6b9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d6b98339cd0a8b36e7b929cfd9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_effb569c0a0b84712024421280"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0fe0610d218d4362ccab57fd6d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ba966575ea180d929e446307c9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c472474d0a5a5d777a12d4200"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_603d9f9c3b23f6cbf87a761aa9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_29a13d42e1686288790b91631d"`);
		await queryRunner.query(`DROP TABLE "employee_recent_visit"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "employee_recent_visit" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "visitedAt" datetime NOT NULL, "data" text, "employeeId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_29a13d42e1686288790b91631d" ON "employee_recent_visit" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_603d9f9c3b23f6cbf87a761aa9" ON "employee_recent_visit" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c472474d0a5a5d777a12d4200" ON "employee_recent_visit" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ba966575ea180d929e446307c9" ON "employee_recent_visit" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0fe0610d218d4362ccab57fd6d" ON "employee_recent_visit" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_effb569c0a0b84712024421280" ON "employee_recent_visit" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6b98339cd0a8b36e7b929cfd9" ON "employee_recent_visit" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5a460b235a6e64ab903e0ac6b9" ON "employee_recent_visit" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3cb1ed116242e84629d3ebc35" ON "employee_recent_visit" ("entityId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_45efdea12a6aead0412829553e" ON "employee_recent_visit" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_29a13d42e1686288790b91631d"`);
		await queryRunner.query(`DROP INDEX "IDX_603d9f9c3b23f6cbf87a761aa9"`);
		await queryRunner.query(`DROP INDEX "IDX_1c472474d0a5a5d777a12d4200"`);
		await queryRunner.query(`DROP INDEX "IDX_ba966575ea180d929e446307c9"`);
		await queryRunner.query(`DROP INDEX "IDX_0fe0610d218d4362ccab57fd6d"`);
		await queryRunner.query(`DROP INDEX "IDX_effb569c0a0b84712024421280"`);
		await queryRunner.query(`DROP INDEX "IDX_d6b98339cd0a8b36e7b929cfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_5a460b235a6e64ab903e0ac6b9"`);
		await queryRunner.query(`DROP INDEX "IDX_f3cb1ed116242e84629d3ebc35"`);
		await queryRunner.query(`DROP INDEX "IDX_45efdea12a6aead0412829553e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_recent_visit" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "visitedAt" datetime NOT NULL, "data" text, "employeeId" varchar, CONSTRAINT "FK_29a13d42e1686288790b91631d0" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_603d9f9c3b23f6cbf87a761aa9d" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c472474d0a5a5d777a12d42009" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_effb569c0a0b84712024421280b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d6b98339cd0a8b36e7b929cfd95" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_45efdea12a6aead0412829553e4" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_recent_visit"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "visitedAt", "data", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "visitedAt", "data", "employeeId" FROM "employee_recent_visit"`
		);
		await queryRunner.query(`DROP TABLE "employee_recent_visit"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_recent_visit" RENAME TO "employee_recent_visit"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_29a13d42e1686288790b91631d" ON "employee_recent_visit" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_603d9f9c3b23f6cbf87a761aa9" ON "employee_recent_visit" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c472474d0a5a5d777a12d4200" ON "employee_recent_visit" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ba966575ea180d929e446307c9" ON "employee_recent_visit" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0fe0610d218d4362ccab57fd6d" ON "employee_recent_visit" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_effb569c0a0b84712024421280" ON "employee_recent_visit" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6b98339cd0a8b36e7b929cfd9" ON "employee_recent_visit" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5a460b235a6e64ab903e0ac6b9" ON "employee_recent_visit" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3cb1ed116242e84629d3ebc35" ON "employee_recent_visit" ("entityId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_45efdea12a6aead0412829553e" ON "employee_recent_visit" ("employeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_45efdea12a6aead0412829553e"`);
		await queryRunner.query(`DROP INDEX "IDX_f3cb1ed116242e84629d3ebc35"`);
		await queryRunner.query(`DROP INDEX "IDX_5a460b235a6e64ab903e0ac6b9"`);
		await queryRunner.query(`DROP INDEX "IDX_d6b98339cd0a8b36e7b929cfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_effb569c0a0b84712024421280"`);
		await queryRunner.query(`DROP INDEX "IDX_0fe0610d218d4362ccab57fd6d"`);
		await queryRunner.query(`DROP INDEX "IDX_ba966575ea180d929e446307c9"`);
		await queryRunner.query(`DROP INDEX "IDX_1c472474d0a5a5d777a12d4200"`);
		await queryRunner.query(`DROP INDEX "IDX_603d9f9c3b23f6cbf87a761aa9"`);
		await queryRunner.query(`DROP INDEX "IDX_29a13d42e1686288790b91631d"`);
		await queryRunner.query(`ALTER TABLE "employee_recent_visit" RENAME TO "temporary_employee_recent_visit"`);
		await queryRunner.query(
			`CREATE TABLE "employee_recent_visit" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "visitedAt" datetime NOT NULL, "data" text, "employeeId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_recent_visit"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "visitedAt", "data", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "visitedAt", "data", "employeeId" FROM "temporary_employee_recent_visit"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_recent_visit"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_45efdea12a6aead0412829553e" ON "employee_recent_visit" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f3cb1ed116242e84629d3ebc35" ON "employee_recent_visit" ("entityId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5a460b235a6e64ab903e0ac6b9" ON "employee_recent_visit" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6b98339cd0a8b36e7b929cfd9" ON "employee_recent_visit" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_effb569c0a0b84712024421280" ON "employee_recent_visit" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0fe0610d218d4362ccab57fd6d" ON "employee_recent_visit" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ba966575ea180d929e446307c9" ON "employee_recent_visit" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c472474d0a5a5d777a12d4200" ON "employee_recent_visit" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_603d9f9c3b23f6cbf87a761aa9" ON "employee_recent_visit" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_29a13d42e1686288790b91631d" ON "employee_recent_visit" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_45efdea12a6aead0412829553e"`);
		await queryRunner.query(`DROP INDEX "IDX_f3cb1ed116242e84629d3ebc35"`);
		await queryRunner.query(`DROP INDEX "IDX_5a460b235a6e64ab903e0ac6b9"`);
		await queryRunner.query(`DROP INDEX "IDX_d6b98339cd0a8b36e7b929cfd9"`);
		await queryRunner.query(`DROP INDEX "IDX_effb569c0a0b84712024421280"`);
		await queryRunner.query(`DROP INDEX "IDX_0fe0610d218d4362ccab57fd6d"`);
		await queryRunner.query(`DROP INDEX "IDX_ba966575ea180d929e446307c9"`);
		await queryRunner.query(`DROP INDEX "IDX_1c472474d0a5a5d777a12d4200"`);
		await queryRunner.query(`DROP INDEX "IDX_603d9f9c3b23f6cbf87a761aa9"`);
		await queryRunner.query(`DROP INDEX "IDX_29a13d42e1686288790b91631d"`);
		await queryRunner.query(`DROP TABLE "employee_recent_visit"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`employee_recent_visit\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`visitedAt\` datetime NOT NULL, \`data\` json NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_29a13d42e1686288790b91631d\` (\`createdByUserId\`), INDEX \`IDX_603d9f9c3b23f6cbf87a761aa9\` (\`updatedByUserId\`), INDEX \`IDX_1c472474d0a5a5d777a12d4200\` (\`deletedByUserId\`), INDEX \`IDX_ba966575ea180d929e446307c9\` (\`isActive\`), INDEX \`IDX_0fe0610d218d4362ccab57fd6d\` (\`isArchived\`), INDEX \`IDX_effb569c0a0b84712024421280\` (\`tenantId\`), INDEX \`IDX_d6b98339cd0a8b36e7b929cfd9\` (\`organizationId\`), INDEX \`IDX_5a460b235a6e64ab903e0ac6b9\` (\`entity\`), INDEX \`IDX_f3cb1ed116242e84629d3ebc35\` (\`entityId\`), INDEX \`IDX_45efdea12a6aead0412829553e\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_29a13d42e1686288790b91631d0\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_603d9f9c3b23f6cbf87a761aa9d\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_1c472474d0a5a5d777a12d42009\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_effb569c0a0b84712024421280b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_d6b98339cd0a8b36e7b929cfd95\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` ADD CONSTRAINT \`FK_45efdea12a6aead0412829553e4\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_45efdea12a6aead0412829553e4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_d6b98339cd0a8b36e7b929cfd95\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_effb569c0a0b84712024421280b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_1c472474d0a5a5d777a12d42009\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_603d9f9c3b23f6cbf87a761aa9d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recent_visit\` DROP FOREIGN KEY \`FK_29a13d42e1686288790b91631d0\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_45efdea12a6aead0412829553e\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3cb1ed116242e84629d3ebc35\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a460b235a6e64ab903e0ac6b9\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_d6b98339cd0a8b36e7b929cfd9\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_effb569c0a0b84712024421280\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_0fe0610d218d4362ccab57fd6d\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_ba966575ea180d929e446307c9\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c472474d0a5a5d777a12d4200\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_603d9f9c3b23f6cbf87a761aa9\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP INDEX \`IDX_29a13d42e1686288790b91631d\` ON \`employee_recent_visit\``);
		await queryRunner.query(`DROP TABLE \`employee_recent_visit\``);
	}
}
