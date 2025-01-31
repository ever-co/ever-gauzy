import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateUserNotificationSettingTable1738326053345 implements MigrationInterface {
	name = 'CreateUserNotificationSettingTable1738326053345';

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
			`CREATE TABLE "user_notification_setting" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "payment" boolean NOT NULL DEFAULT true, "assignment" boolean NOT NULL DEFAULT true, "invitation" boolean NOT NULL DEFAULT true, "mention" boolean NOT NULL DEFAULT true, "comment" boolean NOT NULL DEFAULT true, "message" boolean NOT NULL DEFAULT true, "preferences" jsonb NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "REL_e7ee7354867fcc26a11c583507" UNIQUE ("userId"), CONSTRAINT "PK_30a898263762c2e6fa9cbcb7bb6" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17dfb0f60ee41c72c575dbfb82" ON "user_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55b569561a58a7c064b002be72" ON "user_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e9a856b716dc6ed6b51cc7e6" ON "user_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_655d595f485040c3bc395280bb" ON "user_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7ee7354867fcc26a11c583507" ON "user_notification_setting" ("userId") `
		);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" ADD CONSTRAINT "FK_56e9a856b716dc6ed6b51cc7e6f" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" ADD CONSTRAINT "FK_655d595f485040c3bc395280bbc" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" ADD CONSTRAINT "FK_e7ee7354867fcc26a11c5835078" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" DROP CONSTRAINT "FK_e7ee7354867fcc26a11c5835078"`
		);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" DROP CONSTRAINT "FK_655d595f485040c3bc395280bbc"`
		);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" DROP CONSTRAINT "FK_56e9a856b716dc6ed6b51cc7e6f"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_e7ee7354867fcc26a11c583507"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_655d595f485040c3bc395280bb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_56e9a856b716dc6ed6b51cc7e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_55b569561a58a7c064b002be72"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_17dfb0f60ee41c72c575dbfb82"`);
		await queryRunner.query(`DROP TABLE "user_notification_setting"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "user_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "REL_e7ee7354867fcc26a11c583507" UNIQUE ("userId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17dfb0f60ee41c72c575dbfb82" ON "user_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55b569561a58a7c064b002be72" ON "user_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e9a856b716dc6ed6b51cc7e6" ON "user_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_655d595f485040c3bc395280bb" ON "user_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7ee7354867fcc26a11c583507" ON "user_notification_setting" ("userId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_17dfb0f60ee41c72c575dbfb82"`);
		await queryRunner.query(`DROP INDEX "IDX_55b569561a58a7c064b002be72"`);
		await queryRunner.query(`DROP INDEX "IDX_56e9a856b716dc6ed6b51cc7e6"`);
		await queryRunner.query(`DROP INDEX "IDX_655d595f485040c3bc395280bb"`);
		await queryRunner.query(`DROP INDEX "IDX_e7ee7354867fcc26a11c583507"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_user_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "REL_e7ee7354867fcc26a11c583507" UNIQUE ("userId"), CONSTRAINT "FK_56e9a856b716dc6ed6b51cc7e6f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_655d595f485040c3bc395280bbc" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e7ee7354867fcc26a11c5835078" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_user_notification_setting"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "userId" FROM "user_notification_setting"`
		);
		await queryRunner.query(`DROP TABLE "user_notification_setting"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_user_notification_setting" RENAME TO "user_notification_setting"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17dfb0f60ee41c72c575dbfb82" ON "user_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55b569561a58a7c064b002be72" ON "user_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e9a856b716dc6ed6b51cc7e6" ON "user_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_655d595f485040c3bc395280bb" ON "user_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7ee7354867fcc26a11c583507" ON "user_notification_setting" ("userId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_e7ee7354867fcc26a11c583507"`);
		await queryRunner.query(`DROP INDEX "IDX_655d595f485040c3bc395280bb"`);
		await queryRunner.query(`DROP INDEX "IDX_56e9a856b716dc6ed6b51cc7e6"`);
		await queryRunner.query(`DROP INDEX "IDX_55b569561a58a7c064b002be72"`);
		await queryRunner.query(`DROP INDEX "IDX_17dfb0f60ee41c72c575dbfb82"`);
		await queryRunner.query(
			`ALTER TABLE "user_notification_setting" RENAME TO "temporary_user_notification_setting"`
		);
		await queryRunner.query(
			`CREATE TABLE "user_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "REL_e7ee7354867fcc26a11c583507" UNIQUE ("userId"))`
		);
		await queryRunner.query(
			`INSERT INTO "user_notification_setting"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "userId" FROM "temporary_user_notification_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_user_notification_setting"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7ee7354867fcc26a11c583507" ON "user_notification_setting" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_655d595f485040c3bc395280bb" ON "user_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e9a856b716dc6ed6b51cc7e6" ON "user_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_55b569561a58a7c064b002be72" ON "user_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17dfb0f60ee41c72c575dbfb82" ON "user_notification_setting" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e7ee7354867fcc26a11c583507"`);
		await queryRunner.query(`DROP INDEX "IDX_655d595f485040c3bc395280bb"`);
		await queryRunner.query(`DROP INDEX "IDX_56e9a856b716dc6ed6b51cc7e6"`);
		await queryRunner.query(`DROP INDEX "IDX_55b569561a58a7c064b002be72"`);
		await queryRunner.query(`DROP INDEX "IDX_17dfb0f60ee41c72c575dbfb82"`);
		await queryRunner.query(`DROP TABLE "user_notification_setting"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`user_notification_setting\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`payment\` tinyint NOT NULL DEFAULT 1, \`assignment\` tinyint NOT NULL DEFAULT 1, \`invitation\` tinyint NOT NULL DEFAULT 1, \`mention\` tinyint NOT NULL DEFAULT 1, \`comment\` tinyint NOT NULL DEFAULT 1, \`message\` tinyint NOT NULL DEFAULT 1, \`preferences\` json NOT NULL, \`userId\` varchar(255) NOT NULL, INDEX \`IDX_17dfb0f60ee41c72c575dbfb82\` (\`isActive\`), INDEX \`IDX_55b569561a58a7c064b002be72\` (\`isArchived\`), INDEX \`IDX_56e9a856b716dc6ed6b51cc7e6\` (\`tenantId\`), INDEX \`IDX_655d595f485040c3bc395280bb\` (\`organizationId\`), INDEX \`IDX_e7ee7354867fcc26a11c583507\` (\`userId\`), UNIQUE INDEX \`REL_e7ee7354867fcc26a11c583507\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` ADD CONSTRAINT \`FK_56e9a856b716dc6ed6b51cc7e6f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` ADD CONSTRAINT \`FK_655d595f485040c3bc395280bbc\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` ADD CONSTRAINT \`FK_e7ee7354867fcc26a11c5835078\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` DROP FOREIGN KEY \`FK_e7ee7354867fcc26a11c5835078\``
		);
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` DROP FOREIGN KEY \`FK_655d595f485040c3bc395280bbc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`user_notification_setting\` DROP FOREIGN KEY \`FK_56e9a856b716dc6ed6b51cc7e6f\``
		);
		await queryRunner.query(`DROP INDEX \`REL_e7ee7354867fcc26a11c583507\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_e7ee7354867fcc26a11c583507\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_655d595f485040c3bc395280bb\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_56e9a856b716dc6ed6b51cc7e6\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_55b569561a58a7c064b002be72\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_17dfb0f60ee41c72c575dbfb82\` ON \`user_notification_setting\``);
		await queryRunner.query(`DROP TABLE \`user_notification_setting\``);
	}
}
