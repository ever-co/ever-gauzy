import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateReactionTable1726231843184 implements MigrationInterface {
	name = 'CreateReactionTable1726231843184';

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
			`CREATE TABLE "reaction" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "emoji" character varying NOT NULL, "creatorId" uuid, CONSTRAINT "PK_41fbb346da22da4df129f14b11e" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "reaction" ADD CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "reaction" ADD CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "reaction" ADD CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_0f320e545c0e01268d5094c4339"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_f27bb1170c29785595c6ea142a8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_58350b19ecd6a1e287a09d36a2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6cbd023426eaa8c22a894ba7c3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dc28f2b25544432f3d0fddbc3b"`);
		await queryRunner.query(`DROP TABLE "reaction"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "reaction" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "emoji" varchar NOT NULL, "creatorId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_dc28f2b25544432f3d0fddbc3b"`);
		await queryRunner.query(`DROP INDEX "IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "IDX_6cbd023426eaa8c22a894ba7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_58350b19ecd6a1e287a09d36a2"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_reaction" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "emoji" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "FK_f27bb1170c29785595c6ea142a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0f320e545c0e01268d5094c4339" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_reaction"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "emoji", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "emoji", "creatorId" FROM "reaction"`
		);
		await queryRunner.query(`DROP TABLE "reaction"`);
		await queryRunner.query(`ALTER TABLE "temporary_reaction" RENAME TO "reaction"`);
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_58350b19ecd6a1e287a09d36a2"`);
		await queryRunner.query(`DROP INDEX "IDX_6cbd023426eaa8c22a894ba7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "IDX_dc28f2b25544432f3d0fddbc3b"`);
		await queryRunner.query(`ALTER TABLE "reaction" RENAME TO "temporary_reaction"`);
		await queryRunner.query(
			`CREATE TABLE "reaction" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "emoji" varchar NOT NULL, "creatorId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "reaction"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "emoji", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "emoji", "creatorId" FROM "temporary_reaction"`
		);
		await queryRunner.query(`DROP TABLE "temporary_reaction"`);
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cbd023426eaa8c22a894ba7c3" ON "reaction" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0617390fab6cec8855f601b293" ON "reaction" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_0f320e545c0e01268d5094c433" ON "reaction" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f27bb1170c29785595c6ea142a" ON "reaction" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_910d87dc5f24fdc66b90c4b23e" ON "reaction" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_dc28f2b25544432f3d0fddbc3b" ON "reaction" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_58350b19ecd6a1e287a09d36a2"`);
		await queryRunner.query(`DROP INDEX "IDX_6cbd023426eaa8c22a894ba7c3"`);
		await queryRunner.query(`DROP INDEX "IDX_0617390fab6cec8855f601b293"`);
		await queryRunner.query(`DROP INDEX "IDX_0f320e545c0e01268d5094c433"`);
		await queryRunner.query(`DROP INDEX "IDX_f27bb1170c29785595c6ea142a"`);
		await queryRunner.query(`DROP INDEX "IDX_910d87dc5f24fdc66b90c4b23e"`);
		await queryRunner.query(`DROP INDEX "IDX_dc28f2b25544432f3d0fddbc3b"`);
		await queryRunner.query(`DROP TABLE "reaction"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`reaction\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`emoji\` varchar(255) NOT NULL, \`creatorId\` varchar(255) NULL, INDEX \`IDX_dc28f2b25544432f3d0fddbc3b\` (\`isActive\`), INDEX \`IDX_910d87dc5f24fdc66b90c4b23e\` (\`isArchived\`), INDEX \`IDX_f27bb1170c29785595c6ea142a\` (\`tenantId\`), INDEX \`IDX_0f320e545c0e01268d5094c433\` (\`organizationId\`), INDEX \`IDX_0617390fab6cec8855f601b293\` (\`entity\`), INDEX \`IDX_6cbd023426eaa8c22a894ba7c3\` (\`entityId\`), INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` (\`creatorId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`reaction\` ADD CONSTRAINT \`FK_f27bb1170c29785595c6ea142a8\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`reaction\` ADD CONSTRAINT \`FK_0f320e545c0e01268d5094c4339\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`reaction\` ADD CONSTRAINT \`FK_58350b19ecd6a1e287a09d36a2e\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_58350b19ecd6a1e287a09d36a2e\``);
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_0f320e545c0e01268d5094c4339\``);
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_f27bb1170c29785595c6ea142a8\``);
		await queryRunner.query(`DROP INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_6cbd023426eaa8c22a894ba7c3\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_0617390fab6cec8855f601b293\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_0f320e545c0e01268d5094c433\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_f27bb1170c29785595c6ea142a\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_910d87dc5f24fdc66b90c4b23e\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_dc28f2b25544432f3d0fddbc3b\` ON \`reaction\``);
		await queryRunner.query(`DROP TABLE \`reaction\``);
	}
}
