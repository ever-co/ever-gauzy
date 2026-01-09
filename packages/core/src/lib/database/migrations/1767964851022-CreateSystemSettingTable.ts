import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSystemSettingTable1767964851022 implements MigrationInterface {
	name = 'CreateSystemSettingTable1767964851022';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
			`CREATE TABLE "system_setting" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" text, CONSTRAINT "PK_88dbc9b10c8558420acf7ea642f" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4b463e697599946f1ce1f71c3b" ON "system_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55abcdef47f9115bfe788aeaf2" ON "system_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4ed4c1b25565cbac38e15a3ba" ON "system_setting" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6898dd873dbfd173c4d6d63cf5" ON "system_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_685732774ac601af35ddbfe87a" ON "system_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c8344a7f087ead5614f0e7e173" ON "system_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f1a78f4f45c80b041c68541db5" ON "system_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e92e92174dd8c3a33fb49aa23b" ON "system_setting" ("name") `);
		await queryRunner.query(
			`ALTER TABLE "system_setting" ADD CONSTRAINT "FK_4b463e697599946f1ce1f71c3b8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "system_setting" ADD CONSTRAINT "FK_55abcdef47f9115bfe788aeaf2b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "system_setting" ADD CONSTRAINT "FK_c4ed4c1b25565cbac38e15a3baf" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "system_setting" ADD CONSTRAINT "FK_c8344a7f087ead5614f0e7e1738" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "system_setting" ADD CONSTRAINT "FK_f1a78f4f45c80b041c68541db5a" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "system_setting" DROP CONSTRAINT "FK_f1a78f4f45c80b041c68541db5a"`);
		await queryRunner.query(`ALTER TABLE "system_setting" DROP CONSTRAINT "FK_c8344a7f087ead5614f0e7e1738"`);
		await queryRunner.query(`ALTER TABLE "system_setting" DROP CONSTRAINT "FK_c4ed4c1b25565cbac38e15a3baf"`);
		await queryRunner.query(`ALTER TABLE "system_setting" DROP CONSTRAINT "FK_55abcdef47f9115bfe788aeaf2b"`);
		await queryRunner.query(`ALTER TABLE "system_setting" DROP CONSTRAINT "FK_4b463e697599946f1ce1f71c3b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e92e92174dd8c3a33fb49aa23b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f1a78f4f45c80b041c68541db5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c8344a7f087ead5614f0e7e173"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_685732774ac601af35ddbfe87a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6898dd873dbfd173c4d6d63cf5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c4ed4c1b25565cbac38e15a3ba"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_55abcdef47f9115bfe788aeaf2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4b463e697599946f1ce1f71c3b"`);
		await queryRunner.query(`DROP TABLE "system_setting"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "system_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" text)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4b463e697599946f1ce1f71c3b" ON "system_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55abcdef47f9115bfe788aeaf2" ON "system_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4ed4c1b25565cbac38e15a3ba" ON "system_setting" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6898dd873dbfd173c4d6d63cf5" ON "system_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_685732774ac601af35ddbfe87a" ON "system_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c8344a7f087ead5614f0e7e173" ON "system_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f1a78f4f45c80b041c68541db5" ON "system_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e92e92174dd8c3a33fb49aa23b" ON "system_setting" ("name") `);
		await queryRunner.query(`DROP INDEX "IDX_4b463e697599946f1ce1f71c3b"`);
		await queryRunner.query(`DROP INDEX "IDX_55abcdef47f9115bfe788aeaf2"`);
		await queryRunner.query(`DROP INDEX "IDX_c4ed4c1b25565cbac38e15a3ba"`);
		await queryRunner.query(`DROP INDEX "IDX_6898dd873dbfd173c4d6d63cf5"`);
		await queryRunner.query(`DROP INDEX "IDX_685732774ac601af35ddbfe87a"`);
		await queryRunner.query(`DROP INDEX "IDX_c8344a7f087ead5614f0e7e173"`);
		await queryRunner.query(`DROP INDEX "IDX_f1a78f4f45c80b041c68541db5"`);
		await queryRunner.query(`DROP INDEX "IDX_e92e92174dd8c3a33fb49aa23b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_system_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" text, CONSTRAINT "FK_4b463e697599946f1ce1f71c3b8" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_55abcdef47f9115bfe788aeaf2b" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c4ed4c1b25565cbac38e15a3baf" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c8344a7f087ead5614f0e7e1738" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f1a78f4f45c80b041c68541db5a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_system_setting"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "value") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "value" FROM "system_setting"`
		);
		await queryRunner.query(`DROP TABLE "system_setting"`);
		await queryRunner.query(`ALTER TABLE "temporary_system_setting" RENAME TO "system_setting"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_4b463e697599946f1ce1f71c3b" ON "system_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55abcdef47f9115bfe788aeaf2" ON "system_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4ed4c1b25565cbac38e15a3ba" ON "system_setting" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6898dd873dbfd173c4d6d63cf5" ON "system_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_685732774ac601af35ddbfe87a" ON "system_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_c8344a7f087ead5614f0e7e173" ON "system_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f1a78f4f45c80b041c68541db5" ON "system_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e92e92174dd8c3a33fb49aa23b" ON "system_setting" ("name") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_e92e92174dd8c3a33fb49aa23b"`);
		await queryRunner.query(`DROP INDEX "IDX_f1a78f4f45c80b041c68541db5"`);
		await queryRunner.query(`DROP INDEX "IDX_c8344a7f087ead5614f0e7e173"`);
		await queryRunner.query(`DROP INDEX "IDX_685732774ac601af35ddbfe87a"`);
		await queryRunner.query(`DROP INDEX "IDX_6898dd873dbfd173c4d6d63cf5"`);
		await queryRunner.query(`DROP INDEX "IDX_c4ed4c1b25565cbac38e15a3ba"`);
		await queryRunner.query(`DROP INDEX "IDX_55abcdef47f9115bfe788aeaf2"`);
		await queryRunner.query(`DROP INDEX "IDX_4b463e697599946f1ce1f71c3b"`);
		await queryRunner.query(`ALTER TABLE "system_setting" RENAME TO "temporary_system_setting"`);
		await queryRunner.query(
			`CREATE TABLE "system_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" text)`
		);
		await queryRunner.query(
			`INSERT INTO "system_setting"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "value") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "value" FROM "temporary_system_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_system_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_e92e92174dd8c3a33fb49aa23b" ON "system_setting" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f1a78f4f45c80b041c68541db5" ON "system_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c8344a7f087ead5614f0e7e173" ON "system_setting" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_685732774ac601af35ddbfe87a" ON "system_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_6898dd873dbfd173c4d6d63cf5" ON "system_setting" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4ed4c1b25565cbac38e15a3ba" ON "system_setting" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55abcdef47f9115bfe788aeaf2" ON "system_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4b463e697599946f1ce1f71c3b" ON "system_setting" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e92e92174dd8c3a33fb49aa23b"`);
		await queryRunner.query(`DROP INDEX "IDX_f1a78f4f45c80b041c68541db5"`);
		await queryRunner.query(`DROP INDEX "IDX_c8344a7f087ead5614f0e7e173"`);
		await queryRunner.query(`DROP INDEX "IDX_685732774ac601af35ddbfe87a"`);
		await queryRunner.query(`DROP INDEX "IDX_6898dd873dbfd173c4d6d63cf5"`);
		await queryRunner.query(`DROP INDEX "IDX_c4ed4c1b25565cbac38e15a3ba"`);
		await queryRunner.query(`DROP INDEX "IDX_55abcdef47f9115bfe788aeaf2"`);
		await queryRunner.query(`DROP INDEX "IDX_4b463e697599946f1ce1f71c3b"`);
		await queryRunner.query(`DROP TABLE "system_setting"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`system_setting\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` text NULL, INDEX \`IDX_4b463e697599946f1ce1f71c3b\` (\`createdByUserId\`), INDEX \`IDX_55abcdef47f9115bfe788aeaf2\` (\`updatedByUserId\`), INDEX \`IDX_c4ed4c1b25565cbac38e15a3ba\` (\`deletedByUserId\`), INDEX \`IDX_6898dd873dbfd173c4d6d63cf5\` (\`isActive\`), INDEX \`IDX_685732774ac601af35ddbfe87a\` (\`isArchived\`), INDEX \`IDX_c8344a7f087ead5614f0e7e173\` (\`tenantId\`), INDEX \`IDX_f1a78f4f45c80b041c68541db5\` (\`organizationId\`), INDEX \`IDX_e92e92174dd8c3a33fb49aa23b\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`system_setting\` ADD CONSTRAINT \`FK_4b463e697599946f1ce1f71c3b8\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`system_setting\` ADD CONSTRAINT \`FK_55abcdef47f9115bfe788aeaf2b\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`system_setting\` ADD CONSTRAINT \`FK_c4ed4c1b25565cbac38e15a3baf\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`system_setting\` ADD CONSTRAINT \`FK_c8344a7f087ead5614f0e7e1738\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`system_setting\` ADD CONSTRAINT \`FK_f1a78f4f45c80b041c68541db5a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`system_setting\` DROP FOREIGN KEY \`FK_f1a78f4f45c80b041c68541db5a\``);
		await queryRunner.query(`ALTER TABLE \`system_setting\` DROP FOREIGN KEY \`FK_c8344a7f087ead5614f0e7e1738\``);
		await queryRunner.query(`ALTER TABLE \`system_setting\` DROP FOREIGN KEY \`FK_c4ed4c1b25565cbac38e15a3baf\``);
		await queryRunner.query(`ALTER TABLE \`system_setting\` DROP FOREIGN KEY \`FK_55abcdef47f9115bfe788aeaf2b\``);
		await queryRunner.query(`ALTER TABLE \`system_setting\` DROP FOREIGN KEY \`FK_4b463e697599946f1ce1f71c3b8\``);
		await queryRunner.query(`DROP INDEX \`IDX_e92e92174dd8c3a33fb49aa23b\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_f1a78f4f45c80b041c68541db5\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_c8344a7f087ead5614f0e7e173\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_685732774ac601af35ddbfe87a\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_6898dd873dbfd173c4d6d63cf5\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_c4ed4c1b25565cbac38e15a3ba\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_55abcdef47f9115bfe788aeaf2\` ON \`system_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b463e697599946f1ce1f71c3b\` ON \`system_setting\``);
		await queryRunner.query(`DROP TABLE \`system_setting\``);
	}
}
