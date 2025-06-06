import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddColumnsToOrganizationTeamEmployeeEntity1726037588814 implements MigrationInterface {
	name = 'AddColumnsToOrganizationTeamEmployeeEntity1726037588814';

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
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "isManager" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "assignedAt" TIMESTAMP`);
		await queryRunner.query(
			`CREATE INDEX "IDX_c12ed20c23d7560df2b13249bf" ON "organization_team_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f371eec5283b4d804e14ba83a" ON "organization_team_employee" ("assignedAt") `
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_8f371eec5283b4d804e14ba83a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c12ed20c23d7560df2b13249bf"`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "assignedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "isManager"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_719aeb37fa7a1dd80d25336a0c"`);
		await queryRunner.query(`DROP INDEX "IDX_ce83034f38496f5fe3f1979697"`);
		await queryRunner.query(`DROP INDEX "IDX_a2a5601d799fbfc29c17b99243"`);
		await queryRunner.query(`DROP INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0"`);
		await queryRunner.query(`DROP INDEX "IDX_d8eba1c0e500c60be1b69c1e77"`);
		await queryRunner.query(`DROP INDEX "IDX_fe12e1b76bbb76209134d9bdc2"`);
		await queryRunner.query(`DROP INDEX "IDX_70fcc451944fbde73d223c2af3"`);
		await queryRunner.query(`DROP INDEX "IDX_752d7a0fe6597ee6bbc6502a12"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "organizationTeamId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, "isTrackingEnabled" boolean DEFAULT (1), "activeTaskId" varchar, "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "order" integer, "archivedAt" datetime, "isManager" boolean DEFAULT (0), "assignedAt" datetime, CONSTRAINT "FK_719aeb37fa7a1dd80d25336a0cf" FOREIGN KEY ("activeTaskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ce83034f38496f5fe3f19796977" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a2a5601d799fbfc29c17b99243f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8dc83cdd7c519d73afc0d8bdf09" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d8eba1c0e500c60be1b69c1e777" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fe12e1b76bbb76209134d9bdc2e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId", "deletedAt", "isActive", "isArchived", "order", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId", "deletedAt", "isActive", "isArchived", "order", "archivedAt" FROM "organization_team_employee"`
		);
		await queryRunner.query(`DROP TABLE "organization_team_employee"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_team_employee" RENAME TO "organization_team_employee"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_719aeb37fa7a1dd80d25336a0c" ON "organization_team_employee" ("activeTaskId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ce83034f38496f5fe3f1979697" ON "organization_team_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a2a5601d799fbfc29c17b99243" ON "organization_team_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0" ON "organization_team_employee" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d8eba1c0e500c60be1b69c1e77" ON "organization_team_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fe12e1b76bbb76209134d9bdc2" ON "organization_team_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_70fcc451944fbde73d223c2af3" ON "organization_team_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_752d7a0fe6597ee6bbc6502a12" ON "organization_team_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c12ed20c23d7560df2b13249bf" ON "organization_team_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f371eec5283b4d804e14ba83a" ON "organization_team_employee" ("assignedAt") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_8f371eec5283b4d804e14ba83a"`);
		await queryRunner.query(`DROP INDEX "IDX_c12ed20c23d7560df2b13249bf"`);
		await queryRunner.query(`DROP INDEX "IDX_752d7a0fe6597ee6bbc6502a12"`);
		await queryRunner.query(`DROP INDEX "IDX_70fcc451944fbde73d223c2af3"`);
		await queryRunner.query(`DROP INDEX "IDX_fe12e1b76bbb76209134d9bdc2"`);
		await queryRunner.query(`DROP INDEX "IDX_d8eba1c0e500c60be1b69c1e77"`);
		await queryRunner.query(`DROP INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0"`);
		await queryRunner.query(`DROP INDEX "IDX_a2a5601d799fbfc29c17b99243"`);
		await queryRunner.query(`DROP INDEX "IDX_ce83034f38496f5fe3f1979697"`);
		await queryRunner.query(`DROP INDEX "IDX_719aeb37fa7a1dd80d25336a0c"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team_employee" RENAME TO "temporary_organization_team_employee"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_team_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "organizationTeamId" varchar NOT NULL, "employeeId" varchar NOT NULL, "roleId" varchar, "isTrackingEnabled" boolean DEFAULT (1), "activeTaskId" varchar, "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "order" integer, "archivedAt" datetime, CONSTRAINT "FK_719aeb37fa7a1dd80d25336a0cf" FOREIGN KEY ("activeTaskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ce83034f38496f5fe3f19796977" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a2a5601d799fbfc29c17b99243f" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8dc83cdd7c519d73afc0d8bdf09" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d8eba1c0e500c60be1b69c1e777" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_fe12e1b76bbb76209134d9bdc2e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_team_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId", "deletedAt", "isActive", "isArchived", "order", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "organizationTeamId", "employeeId", "roleId", "isTrackingEnabled", "activeTaskId", "deletedAt", "isActive", "isArchived", "order", "archivedAt" FROM "temporary_organization_team_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_752d7a0fe6597ee6bbc6502a12" ON "organization_team_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_70fcc451944fbde73d223c2af3" ON "organization_team_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fe12e1b76bbb76209134d9bdc2" ON "organization_team_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d8eba1c0e500c60be1b69c1e77" ON "organization_team_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8dc83cdd7c519d73afc0d8bdf0" ON "organization_team_employee" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a2a5601d799fbfc29c17b99243" ON "organization_team_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ce83034f38496f5fe3f1979697" ON "organization_team_employee" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_719aeb37fa7a1dd80d25336a0c" ON "organization_team_employee" ("activeTaskId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` ADD \`isManager\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` ADD \`assignedAt\` datetime NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_c12ed20c23d7560df2b13249bf\` ON \`organization_team_employee\` (\`isManager\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_8f371eec5283b4d804e14ba83a\` ON \`organization_team_employee\` (\`assignedAt\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_8f371eec5283b4d804e14ba83a\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_c12ed20c23d7560df2b13249bf\` ON \`organization_team_employee\``);
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` DROP COLUMN \`assignedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` DROP COLUMN \`isManager\``);
	}
}
