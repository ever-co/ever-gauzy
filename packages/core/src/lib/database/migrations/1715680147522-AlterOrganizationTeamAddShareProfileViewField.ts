import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationTeamAddShareProfileViewField1715680147522 implements MigrationInterface {
	name = 'AlterOrganizationTeamAddShareProfileViewField1715680147522';

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
		await queryRunner.query(`ALTER TABLE "organization_team" ADD "shareProfileView" boolean DEFAULT true`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "shareProfileView"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt" FROM "organization_team"`
		);
		await queryRunner.query(`DROP TABLE "organization_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);
		await queryRunner.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt" FROM "temporary_organization_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`organization_team\` ADD \`shareProfileView\` tinyint NULL DEFAULT 1`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`organization_team\` DROP COLUMN \`shareProfileView\``);
	}
}
