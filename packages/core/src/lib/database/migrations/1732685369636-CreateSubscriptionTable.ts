import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSubscriptionTable1732685369636 implements MigrationInterface {
	name = 'CreateSubscriptionTable1732685369636';

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
			`CREATE TABLE "subscription" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entityId" character varying NOT NULL, "entity" character varying NOT NULL, "type" character varying NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_a0ce0007cfcc8e6ee405d0272f" ON "subscription" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6eafe9ba53fdd744cd1cffede8" ON "subscription" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c86077795cb9a3ce80d19d670a" ON "subscription" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ccdfc22892c16950b568145d5" ON "subscription" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_404bc7ad0e4734744372d656fe" ON "subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb98de07e0868a9951e4d9b353" ON "subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9817a3b53c5dd074af96276d" ON "subscription" ("type") `);
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
		await queryRunner.query(`DROP INDEX "public"."IDX_ec9817a3b53c5dd074af96276d"`);
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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "userId" varchar NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_a0ce0007cfcc8e6ee405d0272f" ON "subscription" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6eafe9ba53fdd744cd1cffede8" ON "subscription" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c86077795cb9a3ce80d19d670a" ON "subscription" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ccdfc22892c16950b568145d5" ON "subscription" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_404bc7ad0e4734744372d656fe" ON "subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb98de07e0868a9951e4d9b353" ON "subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9817a3b53c5dd074af96276d" ON "subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_cc906b4bc892b048f1b654d2aa" ON "subscription" ("userId") `);
		await queryRunner.query(`DROP INDEX "IDX_a0ce0007cfcc8e6ee405d0272f"`);
		await queryRunner.query(`DROP INDEX "IDX_6eafe9ba53fdd744cd1cffede8"`);
		await queryRunner.query(`DROP INDEX "IDX_c86077795cb9a3ce80d19d670a"`);
		await queryRunner.query(`DROP INDEX "IDX_8ccdfc22892c16950b568145d5"`);
		await queryRunner.query(`DROP INDEX "IDX_404bc7ad0e4734744372d656fe"`);
		await queryRunner.query(`DROP INDEX "IDX_cb98de07e0868a9951e4d9b353"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9817a3b53c5dd074af96276d"`);
		await queryRunner.query(`DROP INDEX "IDX_cc906b4bc892b048f1b654d2aa"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "FK_c86077795cb9a3ce80d19d670a5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8ccdfc22892c16950b568145d53" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_cc906b4bc892b048f1b654d2aa0" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "userId" FROM "subscription"`
		);
		await queryRunner.query(`DROP TABLE "subscription"`);
		await queryRunner.query(`ALTER TABLE "temporary_subscription" RENAME TO "subscription"`);
		await queryRunner.query(`CREATE INDEX "IDX_a0ce0007cfcc8e6ee405d0272f" ON "subscription" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_6eafe9ba53fdd744cd1cffede8" ON "subscription" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c86077795cb9a3ce80d19d670a" ON "subscription" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ccdfc22892c16950b568145d5" ON "subscription" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_404bc7ad0e4734744372d656fe" ON "subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb98de07e0868a9951e4d9b353" ON "subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9817a3b53c5dd074af96276d" ON "subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_cc906b4bc892b048f1b654d2aa" ON "subscription" ("userId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_cc906b4bc892b048f1b654d2aa"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9817a3b53c5dd074af96276d"`);
		await queryRunner.query(`DROP INDEX "IDX_cb98de07e0868a9951e4d9b353"`);
		await queryRunner.query(`DROP INDEX "IDX_404bc7ad0e4734744372d656fe"`);
		await queryRunner.query(`DROP INDEX "IDX_8ccdfc22892c16950b568145d5"`);
		await queryRunner.query(`DROP INDEX "IDX_c86077795cb9a3ce80d19d670a"`);
		await queryRunner.query(`DROP INDEX "IDX_6eafe9ba53fdd744cd1cffede8"`);
		await queryRunner.query(`DROP INDEX "IDX_a0ce0007cfcc8e6ee405d0272f"`);
		await queryRunner.query(`ALTER TABLE "subscription" RENAME TO "temporary_subscription"`);
		await queryRunner.query(
			`CREATE TABLE "subscription" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "type" varchar NOT NULL, "userId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "subscription"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "type", "userId" FROM "temporary_subscription"`
		);
		await queryRunner.query(`DROP TABLE "temporary_subscription"`);
		await queryRunner.query(`CREATE INDEX "IDX_cc906b4bc892b048f1b654d2aa" ON "subscription" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ec9817a3b53c5dd074af96276d" ON "subscription" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb98de07e0868a9951e4d9b353" ON "subscription" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_404bc7ad0e4734744372d656fe" ON "subscription" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ccdfc22892c16950b568145d5" ON "subscription" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c86077795cb9a3ce80d19d670a" ON "subscription" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6eafe9ba53fdd744cd1cffede8" ON "subscription" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_a0ce0007cfcc8e6ee405d0272f" ON "subscription" ("isActive") `);

		await queryRunner.query(`DROP INDEX "IDX_cc906b4bc892b048f1b654d2aa"`);
		await queryRunner.query(`DROP INDEX "IDX_ec9817a3b53c5dd074af96276d"`);
		await queryRunner.query(`DROP INDEX "IDX_cb98de07e0868a9951e4d9b353"`);
		await queryRunner.query(`DROP INDEX "IDX_404bc7ad0e4734744372d656fe"`);
		await queryRunner.query(`DROP INDEX "IDX_8ccdfc22892c16950b568145d5"`);
		await queryRunner.query(`DROP INDEX "IDX_c86077795cb9a3ce80d19d670a"`);
		await queryRunner.query(`DROP INDEX "IDX_6eafe9ba53fdd744cd1cffede8"`);
		await queryRunner.query(`DROP INDEX "IDX_a0ce0007cfcc8e6ee405d0272f"`);
		await queryRunner.query(`DROP TABLE "subscription"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`subscription\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entityId\` varchar(255) NOT NULL, \`entity\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, \`userId\` varchar(255) NOT NULL, INDEX \`IDX_a0ce0007cfcc8e6ee405d0272f\` (\`isActive\`), INDEX \`IDX_6eafe9ba53fdd744cd1cffede8\` (\`isArchived\`), INDEX \`IDX_c86077795cb9a3ce80d19d670a\` (\`tenantId\`), INDEX \`IDX_8ccdfc22892c16950b568145d5\` (\`organizationId\`), INDEX \`IDX_404bc7ad0e4734744372d656fe\` (\`entityId\`), INDEX \`IDX_cb98de07e0868a9951e4d9b353\` (\`entity\`), INDEX \`IDX_ec9817a3b53c5dd074af96276d\` (\`type\`), INDEX \`IDX_cc906b4bc892b048f1b654d2aa\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_c86077795cb9a3ce80d19d670a5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_8ccdfc22892c16950b568145d53\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`subscription\` ADD CONSTRAINT \`FK_cc906b4bc892b048f1b654d2aa0\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_cc906b4bc892b048f1b654d2aa0\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_8ccdfc22892c16950b568145d53\``);
		await queryRunner.query(`ALTER TABLE \`subscription\` DROP FOREIGN KEY \`FK_c86077795cb9a3ce80d19d670a5\``);

		await queryRunner.query(`DROP INDEX \`IDX_cc906b4bc892b048f1b654d2aa\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_ec9817a3b53c5dd074af96276d\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_cb98de07e0868a9951e4d9b353\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_404bc7ad0e4734744372d656fe\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_8ccdfc22892c16950b568145d5\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_c86077795cb9a3ce80d19d670a\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_6eafe9ba53fdd744cd1cffede8\` ON \`subscription\``);
		await queryRunner.query(`DROP INDEX \`IDX_a0ce0007cfcc8e6ee405d0272f\` ON \`subscription\``);
		await queryRunner.query(`DROP TABLE \`subscription\``);
	}
}
