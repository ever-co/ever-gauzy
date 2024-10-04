import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterTokenColumnTypeToTextInPasswordResetTable1727954184608 implements MigrationInterface {
	name = 'AlterTokenColumnTypeToTextInPasswordResetTable1727954184608';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		await queryRunner.query(`DROP INDEX "public"."IDX_36e929b98372d961bb63bd4b4e"`);
		// Modify the column type to 'text' without dropping the column
		await queryRunner.query(`ALTER TABLE "password_reset" ALTER COLUMN "token" TYPE text`);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_36e929b98372d961bb63bd4b4e"`);
		// Revert the column type back to 'character varying'
		await queryRunner.query(`ALTER TABLE "password_reset" ALTER COLUMN "token" TYPE character varying`);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
		await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
		await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
		await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
		await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar, "archivedAt" datetime, CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt" FROM "password_reset"`
		);
		await queryRunner.query(`DROP TABLE "password_reset"`);
		await queryRunner.query(`ALTER TABLE "temporary_password_reset" RENAME TO "password_reset"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
		await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
		await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
		await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
		await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
		await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
		await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" text NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar, "archivedAt" datetime, CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt" FROM "password_reset"`
		);
		await queryRunner.query(`DROP TABLE "password_reset"`);
		await queryRunner.query(`ALTER TABLE "temporary_password_reset" RENAME TO "password_reset"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
		await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
		await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
		await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
		await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
		await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
		await queryRunner.query(`ALTER TABLE "password_reset" RENAME TO "temporary_password_reset"`);
		await queryRunner.query(
			`CREATE TABLE "password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar, "archivedAt" datetime, CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt" FROM "temporary_password_reset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_password_reset"`);
		await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
		await queryRunner.query(`DROP INDEX "IDX_1fa632f2d12a06ef8dcc00858f"`);
		await queryRunner.query(`DROP INDEX "IDX_e71a736d52820b568f6b0ca203"`);
		await queryRunner.query(`DROP INDEX "IDX_380c03025a41ad032191f1ef2d"`);
		await queryRunner.query(`DROP INDEX "IDX_1c88db6e50f0704688d1f1978c"`);
		await queryRunner.query(`DROP INDEX "IDX_36e929b98372d961bb63bd4b4e"`);
		await queryRunner.query(`ALTER TABLE "password_reset" RENAME TO "temporary_password_reset"`);
		await queryRunner.query(
			`CREATE TABLE "password_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "email" varchar NOT NULL, "token" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "tenantId" varchar, "archivedAt" datetime, CONSTRAINT "FK_1fa632f2d12a06ef8dcc00858ff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "password_reset"("id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt") SELECT "id", "createdAt", "updatedAt", "email", "token", "isActive", "isArchived", "deletedAt", "tenantId", "archivedAt" FROM "temporary_password_reset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_password_reset"`);
		await queryRunner.query(`CREATE INDEX "IDX_1fa632f2d12a06ef8dcc00858f" ON "password_reset" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e71a736d52820b568f6b0ca203" ON "password_reset" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_380c03025a41ad032191f1ef2d" ON "password_reset" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1c88db6e50f0704688d1f1978c" ON "password_reset" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_36e929b98372d961bb63bd4b4e" ON "password_reset" ("token") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Alter the column type to `text` without dropping the column
		await queryRunner.query(`ALTER TABLE \`password_reset\` MODIFY \`token\` text NOT NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Revert the column type back to `varchar(255)` without dropping the column
		await queryRunner.query(`ALTER TABLE \`password_reset\` MODIFY \`token\` varchar(255) NOT NULL`);
	}
}
