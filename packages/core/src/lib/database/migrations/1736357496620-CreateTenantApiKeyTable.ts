import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTenantApiKeyTable1736357496620 implements MigrationInterface {
	name = 'CreateTenantApiKeyTable1736357496620';

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
			`CREATE TABLE "tenant_api_key" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "apiKey" character varying NOT NULL, "apiSecret" character varying NOT NULL, CONSTRAINT "PK_83032288ad7173ddc31dc5a0c34" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_686a4464635f3dbb77411dd5e8" ON "tenant_api_key" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_21056fa2d8b060d3049f50ec0b" ON "tenant_api_key" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_df44cc2b5ba1a4cc95850eea7c" ON "tenant_api_key" ("tenantId") `);
		await queryRunner.query(
			`ALTER TABLE "tenant_api_key" ADD CONSTRAINT "FK_df44cc2b5ba1a4cc95850eea7c2" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "tenant_api_key" DROP CONSTRAINT "FK_df44cc2b5ba1a4cc95850eea7c2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_df44cc2b5ba1a4cc95850eea7c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_21056fa2d8b060d3049f50ec0b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_686a4464635f3dbb77411dd5e8"`);
		await queryRunner.query(`DROP TABLE "tenant_api_key"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "tenant_api_key" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "apiKey" varchar NOT NULL, "apiSecret" varchar NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_686a4464635f3dbb77411dd5e8" ON "tenant_api_key" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_21056fa2d8b060d3049f50ec0b" ON "tenant_api_key" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_df44cc2b5ba1a4cc95850eea7c" ON "tenant_api_key" ("tenantId") `);
		await queryRunner.query(`DROP INDEX "IDX_686a4464635f3dbb77411dd5e8"`);
		await queryRunner.query(`DROP INDEX "IDX_21056fa2d8b060d3049f50ec0b"`);
		await queryRunner.query(`DROP INDEX "IDX_df44cc2b5ba1a4cc95850eea7c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_tenant_api_key" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "apiKey" varchar NOT NULL, "apiSecret" varchar NOT NULL, CONSTRAINT "FK_df44cc2b5ba1a4cc95850eea7c2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_tenant_api_key"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "apiKey", "apiSecret") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "apiKey", "apiSecret" FROM "tenant_api_key"`
		);
		await queryRunner.query(`DROP TABLE "tenant_api_key"`);
		await queryRunner.query(`ALTER TABLE "temporary_tenant_api_key" RENAME TO "tenant_api_key"`);
		await queryRunner.query(`CREATE INDEX "IDX_686a4464635f3dbb77411dd5e8" ON "tenant_api_key" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_21056fa2d8b060d3049f50ec0b" ON "tenant_api_key" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_df44cc2b5ba1a4cc95850eea7c" ON "tenant_api_key" ("tenantId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_df44cc2b5ba1a4cc95850eea7c"`);
		await queryRunner.query(`DROP INDEX "IDX_21056fa2d8b060d3049f50ec0b"`);
		await queryRunner.query(`DROP INDEX "IDX_686a4464635f3dbb77411dd5e8"`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" RENAME TO "temporary_tenant_api_key"`);
		await queryRunner.query(
			`CREATE TABLE "tenant_api_key" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "apiKey" varchar NOT NULL, "apiSecret" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "tenant_api_key"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "apiKey", "apiSecret") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "apiKey", "apiSecret" FROM "temporary_tenant_api_key"`
		);
		await queryRunner.query(`DROP TABLE "temporary_tenant_api_key"`);
		await queryRunner.query(`CREATE INDEX "IDX_df44cc2b5ba1a4cc95850eea7c" ON "tenant_api_key" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_21056fa2d8b060d3049f50ec0b" ON "tenant_api_key" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_686a4464635f3dbb77411dd5e8" ON "tenant_api_key" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_df44cc2b5ba1a4cc95850eea7c"`);
		await queryRunner.query(`DROP INDEX "IDX_21056fa2d8b060d3049f50ec0b"`);
		await queryRunner.query(`DROP INDEX "IDX_686a4464635f3dbb77411dd5e8"`);
		await queryRunner.query(`DROP TABLE "tenant_api_key"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`tenant_api_key\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`apiKey\` varchar(255) NOT NULL, \`apiSecret\` varchar(255) NOT NULL, INDEX \`IDX_686a4464635f3dbb77411dd5e8\` (\`isActive\`), INDEX \`IDX_21056fa2d8b060d3049f50ec0b\` (\`isArchived\`), INDEX \`IDX_df44cc2b5ba1a4cc95850eea7c\` (\`tenantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`tenant_api_key\` ADD CONSTRAINT \`FK_df44cc2b5ba1a4cc95850eea7c2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`tenant_api_key\` DROP FOREIGN KEY \`FK_df44cc2b5ba1a4cc95850eea7c2\``);
		await queryRunner.query(`DROP INDEX \`IDX_df44cc2b5ba1a4cc95850eea7c\` ON \`tenant_api_key\``);
		await queryRunner.query(`DROP INDEX \`IDX_21056fa2d8b060d3049f50ec0b\` ON \`tenant_api_key\``);
		await queryRunner.query(`DROP INDEX \`IDX_686a4464635f3dbb77411dd5e8\` ON \`tenant_api_key\``);
		await queryRunner.query(`DROP TABLE \`tenant_api_key\``);
	}
}
