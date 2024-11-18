import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterTaskStatusesAddWorkFlowFields1723645947040 implements MigrationInterface {
	name = 'AlterTaskStatusesAddWorkFlowFields1723645947040';

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
		await queryRunner.query(`ALTER TABLE "task_status" ADD "isTodo" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "task_status" ADD "isInProgress" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "task_status" ADD "isDone" boolean NOT NULL DEFAULT false`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "isDone"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "isInProgress"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "isTodo"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
		await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
		await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
		await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
		await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
		await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
		await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
		await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isCollapsed" boolean NOT NULL DEFAULT (0), "order" integer, "isTodo" boolean NOT NULL DEFAULT (0), "isInProgress" boolean NOT NULL DEFAULT (0), "isDone" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed", "order") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed", "order" FROM "task_status"`
		);
		await queryRunner.query(`DROP TABLE "task_status"`);
		await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
		await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_79c525a8c2209e90186bfcbea9"`);
		await queryRunner.query(`DROP INDEX "IDX_25d9737ee153411871b4d20c67"`);
		await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
		await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
		await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
		await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
		await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
		await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
		await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
		await queryRunner.query(
			`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isCollapsed" boolean NOT NULL DEFAULT (0), "order" integer, CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed", "order") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt", "isCollapsed", "order" FROM "temporary_task_status"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task_status"`);
		await queryRunner.query(`CREATE INDEX "IDX_79c525a8c2209e90186bfcbea9" ON "task_status" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_25d9737ee153411871b4d20c67" ON "task_status" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`task_status\` ADD \`isTodo\` tinyint NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`task_status\` ADD \`isInProgress\` tinyint NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`task_status\` ADD \`isDone\` tinyint NOT NULL DEFAULT 0`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP COLUMN \`isDone\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP COLUMN \`isInProgress\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP COLUMN \`isTodo\``);
	}
}
