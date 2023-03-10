import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterEmailResetTable1678452513995 implements MigrationInterface {
	name = 'AlterEmailResetTable1678452513995';

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
		await queryRunner.query(
			`ALTER TABLE "email_reset" ALTER COLUMN "token" DROP NOT NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(
		queryRunner: QueryRunner
	): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "email_reset" ALTER COLUMN "token" SET NOT NULL`
		);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
		await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
		await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
		await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
		await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
		await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar NOT NULL, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "email_reset"`
		);
		await queryRunner.query(`DROP TABLE "email_reset"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
		await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
		await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
		await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
		await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
		await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "email_reset"`
		);
		await queryRunner.query(`DROP TABLE "email_reset"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo" FROM "organization_team"`
		);
		await queryRunner.query(`DROP TABLE "organization_team"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (1), "profile_link" varchar, "logo" varchar, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo" FROM "temporary_organization_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
		await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
		await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
		await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
		await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
		await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
		await queryRunner.query(
			`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`
		);
		await queryRunner.query(
			`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar NOT NULL, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "temporary_email_reset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
		await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
		await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
		await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
		await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
		await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
		await queryRunner.query(
			`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`
		);
		await queryRunner.query(
			`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar NOT NULL, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "temporary_email_reset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `
		);
	}
}
