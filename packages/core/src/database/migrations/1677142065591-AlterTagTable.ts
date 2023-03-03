import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTagTable1677142065591 implements MigrationInterface {
	name = 'AlterTagTable1677142065591';

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
		await queryRunner.query(`ALTER TABLE "tag" ADD "icon" character varying`);
		await queryRunner.query(`ALTER TABLE "tag" ADD "organizationTeamId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
		await queryRunner.query(
			`ALTER TABLE "tag" ADD CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "tag" DROP CONSTRAINT "FK_49746602acc4e5e8721062b69ec"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_49746602acc4e5e8721062b69e"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "organizationTeamId"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "icon"`);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
		await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem" FROM "tag"`
		);
		await queryRunner.query(`DROP TABLE "tag"`);
		await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
		await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
		await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
		await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
		await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId" FROM "tag"`
		);
		await queryRunner.query(`DROP TABLE "tag"`);
		await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
		await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
		await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
		await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
		await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
		await queryRunner.query(
			`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId" FROM "temporary_tag"`
		);
		await queryRunner.query(`DROP TABLE "temporary_tag"`);
		await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
		await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
		await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
		await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
		await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
		await queryRunner.query(
			`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem" FROM "temporary_tag"`
		);
		await queryRunner.query(`DROP TABLE "temporary_tag"`);
		await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
	}
}
