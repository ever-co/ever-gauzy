import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateActivityLogTable1726648418130 implements MigrationInterface {
	name = 'CreateActivityLogTable1726648418130';

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
			`CREATE TABLE "activity_log" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "action" character varying NOT NULL, "actorType" character varying, "description" text, "updatedFields" jsonb, "previousValues" jsonb, "updatedValues" jsonb, "previousEntities" jsonb, "updatedEntities" jsonb, "data" jsonb, "creatorId" uuid, CONSTRAINT "PK_067d761e2956b77b14e534fd6f1" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_d42f36e39404cb6455254deb360"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP TABLE "activity_log"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar, CONSTRAINT "FK_d42f36e39404cb6455254deb360" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3e7ec906ac1026a6c9779e82a21" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "activity_log"`
		);
		await queryRunner.query(`DROP TABLE "activity_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_activity_log" RENAME TO "activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`ALTER TABLE "activity_log" RENAME TO "temporary_activity_log"`);
		await queryRunner.query(
			`CREATE TABLE "activity_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "action" varchar NOT NULL, "actorType" varchar, "description" text, "updatedFields" text, "previousValues" text, "updatedValues" text, "previousEntities" text, "updatedEntities" text, "data" text, "creatorId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "activity_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "action", "actorType", "description", "updatedFields", "previousValues", "updatedValues", "previousEntities", "updatedEntities", "data", "creatorId" FROM "temporary_activity_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_activity_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_691ba0d5b57cd5adea2c9cc285" ON "activity_log" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_695624cb02a5da0e86cd4489c0" ON "activity_log" ("action") `);
		await queryRunner.query(`CREATE INDEX "IDX_ef0a3bcee9c0305f755d5add13" ON "activity_log" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c60ac1ac95c2d901afd2f68909" ON "activity_log" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e7ec906ac1026a6c9779e82a2" ON "activity_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d42f36e39404cb6455254deb36" ON "activity_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eb63f18992743f35225ae4e77c" ON "activity_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_4a88f1b97dd306d919f844828d" ON "activity_log" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);
		await queryRunner.query(`DROP INDEX "IDX_691ba0d5b57cd5adea2c9cc285"`);
		await queryRunner.query(`DROP INDEX "IDX_695624cb02a5da0e86cd4489c0"`);
		await queryRunner.query(`DROP INDEX "IDX_ef0a3bcee9c0305f755d5add13"`);
		await queryRunner.query(`DROP INDEX "IDX_c60ac1ac95c2d901afd2f68909"`);
		await queryRunner.query(`DROP INDEX "IDX_3e7ec906ac1026a6c9779e82a2"`);
		await queryRunner.query(`DROP INDEX "IDX_d42f36e39404cb6455254deb36"`);
		await queryRunner.query(`DROP INDEX "IDX_eb63f18992743f35225ae4e77c"`);
		await queryRunner.query(`DROP INDEX "IDX_4a88f1b97dd306d919f844828d"`);
		await queryRunner.query(`DROP TABLE "activity_log"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`activity_log\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`action\` varchar(255) NOT NULL, \`actorType\` varchar(255) NULL, \`description\` text NULL, \`updatedFields\` json NULL, \`previousValues\` json NULL, \`updatedValues\` json NULL, \`previousEntities\` json NULL, \`updatedEntities\` json NULL, \`data\` json NULL, \`creatorId\` varchar(255) NULL, INDEX \`IDX_4a88f1b97dd306d919f844828d\` (\`isActive\`), INDEX \`IDX_eb63f18992743f35225ae4e77c\` (\`isArchived\`), INDEX \`IDX_d42f36e39404cb6455254deb36\` (\`tenantId\`), INDEX \`IDX_3e7ec906ac1026a6c9779e82a2\` (\`organizationId\`), INDEX \`IDX_c60ac1ac95c2d901afd2f68909\` (\`entity\`), INDEX \`IDX_ef0a3bcee9c0305f755d5add13\` (\`entityId\`), INDEX \`IDX_695624cb02a5da0e86cd4489c0\` (\`action\`), INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` (\`actorType\`), INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` (\`creatorId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity_log\` ADD CONSTRAINT \`FK_d42f36e39404cb6455254deb360\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity_log\` ADD CONSTRAINT \`FK_3e7ec906ac1026a6c9779e82a21\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity_log\` ADD CONSTRAINT \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_b6e9a5c3e1ee65a3bcb8a00de2b\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_3e7ec906ac1026a6c9779e82a21\``);
		await queryRunner.query(`ALTER TABLE \`activity_log\` DROP FOREIGN KEY \`FK_d42f36e39404cb6455254deb360\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6e9a5c3e1ee65a3bcb8a00de2\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_691ba0d5b57cd5adea2c9cc285\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_695624cb02a5da0e86cd4489c0\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_ef0a3bcee9c0305f755d5add13\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_c60ac1ac95c2d901afd2f68909\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e7ec906ac1026a6c9779e82a2\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_d42f36e39404cb6455254deb36\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_eb63f18992743f35225ae4e77c\` ON \`activity_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_4a88f1b97dd306d919f844828d\` ON \`activity_log\``);
		await queryRunner.query(`DROP TABLE \`activity_log\``);
	}
}
