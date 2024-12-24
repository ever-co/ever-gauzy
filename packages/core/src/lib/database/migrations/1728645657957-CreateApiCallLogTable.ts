import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateApiCallLogTable1728645657957 implements MigrationInterface {
	name = 'CreateApiCallLogTable1728645657957';

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
			`CREATE TABLE "api_call_log" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "correlationId" character varying NOT NULL, "url" character varying NOT NULL, "method" integer NOT NULL, "requestHeaders" jsonb NOT NULL, "requestBody" jsonb NOT NULL, "responseBody" jsonb NOT NULL, "statusCode" integer NOT NULL, "requestTime" TIMESTAMP NOT NULL, "responseTime" TIMESTAMP NOT NULL, "ipAddress" character varying, "protocol" character varying, "userAgent" character varying, "origin" character varying, "userId" uuid, CONSTRAINT "PK_ba8bfaffbb35aff7026eecae2a7" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
		await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
		await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
		await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
		await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "api_call_log" ADD CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "api_call_log" ADD CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "api_call_log" ADD CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP CONSTRAINT "FK_ada33b1685138be7798aea280b2"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP CONSTRAINT "FK_89292145eeceb7ff32dac0de83b"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ada33b1685138be7798aea280b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_964d6a55608f67f7d92e9827db"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_085b00c43479478866d7a27ca9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_66f2fd42fa8f00e11d6960cb39"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1d6cb060eba156d1e50f7ea4a0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5820fe8a6385bfc0338c49a508"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0a62fc4546d596f9e9ce305ecb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b484d5942747f0c19372ae8fcd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c74a2db6a95bb3a5b788e23a50"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_89292145eeceb7ff32dac0de83"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_94c4d067f73d90faaad8c2d3db"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_85c20063cd74c766533fd08389"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3505a1756b04b59626d1bd836"`);
		await queryRunner.query(`DROP TABLE "api_call_log"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar, "userAgent" varchar, "origin" varchar, "userId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
		await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
		await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
		await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
		await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
		await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
		await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
		await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
		await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
		await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
		await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
		await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
		await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
		await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
		await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
		await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
		await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
		await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar, "userAgent" varchar, "origin" varchar, "userId" varchar, CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "origin", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "origin", "userId" FROM "api_call_log"`
		);
		await queryRunner.query(`DROP TABLE "api_call_log"`);
		await queryRunner.query(`ALTER TABLE "temporary_api_call_log" RENAME TO "api_call_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
		await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
		await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
		await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
		await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
		await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
		await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
		await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
		await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
		await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
		await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
		await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
		await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
		await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
		await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
		await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
		await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" RENAME TO "temporary_api_call_log"`);
		await queryRunner.query(
			`CREATE TABLE "api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar, "userAgent" varchar, "origin" varchar, "userId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "origin", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "origin", "userId" FROM "temporary_api_call_log"`
		);
		await queryRunner.query(`DROP TABLE "temporary_api_call_log"`);
		await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
		await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
		await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
		await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
		await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
		await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
		await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
		await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
		await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
		await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
		await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
		await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
		await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
		await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
		await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
		await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
		await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
		await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
		await queryRunner.query(`DROP TABLE "api_call_log"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`api_call_log\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`correlationId\` varchar(255) NOT NULL, \`url\` varchar(255) NOT NULL, \`method\` int NOT NULL, \`requestHeaders\` json NOT NULL, \`requestBody\` json NOT NULL, \`responseBody\` json NOT NULL, \`statusCode\` int NOT NULL, \`requestTime\` datetime NOT NULL, \`responseTime\` datetime NOT NULL, \`ipAddress\` varchar(255) NULL, \`protocol\` varchar(255) NULL, \`userAgent\` varchar(255) NULL, \`origin\` varchar(255) NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_f3505a1756b04b59626d1bd836\` (\`isActive\`), INDEX \`IDX_85c20063cd74c766533fd08389\` (\`isArchived\`), INDEX \`IDX_94c4d067f73d90faaad8c2d3db\` (\`tenantId\`), INDEX \`IDX_89292145eeceb7ff32dac0de83\` (\`organizationId\`), INDEX \`IDX_c74a2db6a95bb3a5b788e23a50\` (\`correlationId\`), INDEX \`IDX_b484d5942747f0c19372ae8fcd\` (\`url\`), INDEX \`IDX_0a62fc4546d596f9e9ce305ecb\` (\`method\`), INDEX \`IDX_5820fe8a6385bfc0338c49a508\` (\`statusCode\`), INDEX \`IDX_1d6cb060eba156d1e50f7ea4a0\` (\`requestTime\`), INDEX \`IDX_66f2fd42fa8f00e11d6960cb39\` (\`responseTime\`), INDEX \`IDX_085b00c43479478866d7a27ca9\` (\`ipAddress\`), INDEX \`IDX_964d6a55608f67f7d92e9827db\` (\`protocol\`), INDEX \`IDX_ada33b1685138be7798aea280b\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`api_call_log\` ADD CONSTRAINT \`FK_94c4d067f73d90faaad8c2d3dbd\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`api_call_log\` ADD CONSTRAINT \`FK_89292145eeceb7ff32dac0de83b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`api_call_log\` ADD CONSTRAINT \`FK_ada33b1685138be7798aea280b2\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`api_call_log\` DROP FOREIGN KEY \`FK_ada33b1685138be7798aea280b2\``);
		await queryRunner.query(`ALTER TABLE \`api_call_log\` DROP FOREIGN KEY \`FK_89292145eeceb7ff32dac0de83b\``);
		await queryRunner.query(`ALTER TABLE \`api_call_log\` DROP FOREIGN KEY \`FK_94c4d067f73d90faaad8c2d3dbd\``);
		await queryRunner.query(`DROP INDEX \`IDX_ada33b1685138be7798aea280b\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_964d6a55608f67f7d92e9827db\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_085b00c43479478866d7a27ca9\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_66f2fd42fa8f00e11d6960cb39\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_1d6cb060eba156d1e50f7ea4a0\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_5820fe8a6385bfc0338c49a508\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_0a62fc4546d596f9e9ce305ecb\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_b484d5942747f0c19372ae8fcd\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_c74a2db6a95bb3a5b788e23a50\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_89292145eeceb7ff32dac0de83\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_94c4d067f73d90faaad8c2d3db\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_85c20063cd74c766533fd08389\` ON \`api_call_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3505a1756b04b59626d1bd836\` ON \`api_call_log\``);
		await queryRunner.query(`DROP TABLE \`api_call_log\``);
	}
}
