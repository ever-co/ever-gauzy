import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateResourceLinkTable1728798743598 implements MigrationInterface {
	name = 'CreateResourceLinkTable1728798743598';

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
			`CREATE TABLE "resource_link" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "title" character varying NOT NULL, "url" text NOT NULL, "metaData" json, "creatorId" uuid, CONSTRAINT "PK_c4bd5617a9b97fff39d02de2456" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_95603855ae10050123e48a66881" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_2ef674d18792e8864fd8d484eac" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_2ef674d18792e8864fd8d484eac"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_95603855ae10050123e48a66881"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(`DROP TABLE "resource_link"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar, CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_95603855ae10050123e48a66881" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2ef674d18792e8864fd8d484eac" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "resource_link"`
		);
		await queryRunner.query(`DROP TABLE "resource_link"`);
		await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);
		await queryRunner.query(
			`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "temporary_resource_link"`
		);
		await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(`DROP TABLE "resource_link"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`resource_link\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`title\` varchar(255) NOT NULL, \`url\` text NOT NULL, \`metaData\` json NULL, \`creatorId\` varchar(255) NULL, INDEX \`IDX_841b729b80bc03ea38d16b8508\` (\`isActive\`), INDEX \`IDX_4c25c2c9d7ebbd0c07edd824ff\` (\`isArchived\`), INDEX \`IDX_f9438f82f6e93bd6a87b8216af\` (\`tenantId\`), INDEX \`IDX_95603855ae10050123e48a6688\` (\`organizationId\`), INDEX \`IDX_44100d3eaf418ee67fa7a756f1\` (\`entity\`), INDEX \`IDX_b73c278619bd8fb7f30f93182c\` (\`entityId\`), INDEX \`IDX_2ef674d18792e8864fd8d484ea\` (\`creatorId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_f9438f82f6e93bd6a87b8216af9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_95603855ae10050123e48a66881\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_2ef674d18792e8864fd8d484eac\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_2ef674d18792e8864fd8d484eac\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_95603855ae10050123e48a66881\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_f9438f82f6e93bd6a87b8216af9\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ef674d18792e8864fd8d484ea\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_b73c278619bd8fb7f30f93182c\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_44100d3eaf418ee67fa7a756f1\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_95603855ae10050123e48a6688\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_f9438f82f6e93bd6a87b8216af\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_4c25c2c9d7ebbd0c07edd824ff\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_841b729b80bc03ea38d16b8508\` ON \`resource_link\``);
		await queryRunner.query(`DROP TABLE \`resource_link\``);
	}
}
