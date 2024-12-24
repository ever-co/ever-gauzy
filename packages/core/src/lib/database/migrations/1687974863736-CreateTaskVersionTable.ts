import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateTaskVersionTable1687974863736 implements MigrationInterface {
	name = 'CreateTaskVersionTable1687974863736';

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
			`CREATE TABLE "task_version" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_fa7a775200136d1eedfc0070455" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_379c8bd0ce203341148c1f99ee" ON "task_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c845f353378371ee3aa60f686" ON "task_version" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3396dda57286ca17ab61fd3704" ON "task_version" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_e9fd8df772ad2d955a65f4c68a" ON "task_version" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_91988120385964f213aec8aa84" ON "task_version" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_959e77718a2e76ee56498c1106" ON "task_version" ("organizationTeamId") `
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_379c8bd0ce203341148c1f99ee7" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_9c845f353378371ee3aa60f6865" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_91988120385964f213aec8aa84c" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_959e77718a2e76ee56498c1106a" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_959e77718a2e76ee56498c1106a"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_91988120385964f213aec8aa84c"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_9c845f353378371ee3aa60f6865"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_379c8bd0ce203341148c1f99ee7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_959e77718a2e76ee56498c1106"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_91988120385964f213aec8aa84"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e9fd8df772ad2d955a65f4c68a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3396dda57286ca17ab61fd3704"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9c845f353378371ee3aa60f686"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_379c8bd0ce203341148c1f99ee"`);
		await queryRunner.query(`DROP TABLE "task_version"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "task_version" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_379c8bd0ce203341148c1f99ee" ON "task_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c845f353378371ee3aa60f686" ON "task_version" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3396dda57286ca17ab61fd3704" ON "task_version" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_e9fd8df772ad2d955a65f4c68a" ON "task_version" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_91988120385964f213aec8aa84" ON "task_version" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_959e77718a2e76ee56498c1106" ON "task_version" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_379c8bd0ce203341148c1f99ee"`);
		await queryRunner.query(`DROP INDEX "IDX_9c845f353378371ee3aa60f686"`);
		await queryRunner.query(`DROP INDEX "IDX_3396dda57286ca17ab61fd3704"`);
		await queryRunner.query(`DROP INDEX "IDX_e9fd8df772ad2d955a65f4c68a"`);
		await queryRunner.query(`DROP INDEX "IDX_91988120385964f213aec8aa84"`);
		await queryRunner.query(`DROP INDEX "IDX_959e77718a2e76ee56498c1106"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task_version" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_379c8bd0ce203341148c1f99ee7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9c845f353378371ee3aa60f6865" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_91988120385964f213aec8aa84c" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_959e77718a2e76ee56498c1106a" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task_version"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "task_version"`
		);
		await queryRunner.query(`DROP TABLE "task_version"`);
		await queryRunner.query(`ALTER TABLE "temporary_task_version" RENAME TO "task_version"`);
		await queryRunner.query(`CREATE INDEX "IDX_379c8bd0ce203341148c1f99ee" ON "task_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c845f353378371ee3aa60f686" ON "task_version" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3396dda57286ca17ab61fd3704" ON "task_version" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_e9fd8df772ad2d955a65f4c68a" ON "task_version" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_91988120385964f213aec8aa84" ON "task_version" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_959e77718a2e76ee56498c1106" ON "task_version" ("organizationTeamId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_959e77718a2e76ee56498c1106"`);
		await queryRunner.query(`DROP INDEX "IDX_91988120385964f213aec8aa84"`);
		await queryRunner.query(`DROP INDEX "IDX_e9fd8df772ad2d955a65f4c68a"`);
		await queryRunner.query(`DROP INDEX "IDX_3396dda57286ca17ab61fd3704"`);
		await queryRunner.query(`DROP INDEX "IDX_9c845f353378371ee3aa60f686"`);
		await queryRunner.query(`DROP INDEX "IDX_379c8bd0ce203341148c1f99ee"`);
		await queryRunner.query(`ALTER TABLE "task_version" RENAME TO "temporary_task_version"`);
		await queryRunner.query(
			`CREATE TABLE "task_version" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "task_version"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "temporary_task_version"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task_version"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_959e77718a2e76ee56498c1106" ON "task_version" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_91988120385964f213aec8aa84" ON "task_version" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e9fd8df772ad2d955a65f4c68a" ON "task_version" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_3396dda57286ca17ab61fd3704" ON "task_version" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c845f353378371ee3aa60f686" ON "task_version" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_379c8bd0ce203341148c1f99ee" ON "task_version" ("tenantId") `);
		await queryRunner.query(`DROP INDEX "IDX_959e77718a2e76ee56498c1106"`);
		await queryRunner.query(`DROP INDEX "IDX_91988120385964f213aec8aa84"`);
		await queryRunner.query(`DROP INDEX "IDX_e9fd8df772ad2d955a65f4c68a"`);
		await queryRunner.query(`DROP INDEX "IDX_3396dda57286ca17ab61fd3704"`);
		await queryRunner.query(`DROP INDEX "IDX_9c845f353378371ee3aa60f686"`);
		await queryRunner.query(`DROP INDEX "IDX_379c8bd0ce203341148c1f99ee"`);
		await queryRunner.query(`DROP TABLE "task_version"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
