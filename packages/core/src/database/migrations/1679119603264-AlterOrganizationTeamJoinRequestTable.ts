import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterOrganizationTeamJoinRequestTable1679119603264 implements MigrationInterface {
	name = 'AlterOrganizationTeamJoinRequestTable1679119603264';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.connection.options.type === 'sqlite') {
			await this.sqliteUpQueryRunner(queryRunner);
		} else {
			await this.postgresUpQueryRunner(queryRunner);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.connection.options.type === 'sqlite') {
			await this.sqliteDownQueryRunner(queryRunner);
		} else {
			await this.postgresDownQueryRunner(queryRunner);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "status" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "status" DROP DEFAULT`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" ALTER COLUMN "status" SET DEFAULT 'REQUESTED'`
		);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "status" SET NOT NULL`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
		await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
		await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
		await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "organization_team_join_request"`
		);
		await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_team_join_request" RENAME TO "organization_team_join_request"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
		await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
		await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
		await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar, "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "organization_team_join_request"`
		);
		await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_team_join_request" RENAME TO "organization_team_join_request"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
		await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
		await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
		await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" RENAME TO "temporary_organization_team_join_request"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "temporary_organization_team_join_request"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team_join_request"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
		await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
		await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
		await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" RENAME TO "temporary_organization_team_join_request"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "temporary_organization_team_join_request"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team_join_request"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `
		);
	}
}
