import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AtlerMentionTableAddParentEntityFields1732775571004 implements MigrationInterface {
	name = 'AtlerMentionTableAddParentEntityFields1732775571004';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
		await queryRunner.query(`ALTER TABLE "mention" ADD "parentEntityId" character varying NOT NULL`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "parentEntityType" character varying NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "parentEntityType"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "parentEntityId"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, "parentEntityId" varchar NOT NULL, "parentEntityType" varchar NOT NULL, CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "mentionedUserId", "mentionById" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "mentionedUserId", "mentionById" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`parentEntityId\` varchar(255) NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`parentEntityType\` varchar(255) NOT NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_5b95805861f9de5cf7760a964a\` ON \`mention\` (\`parentEntityId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_4f9397b277ec0791c5f9e2fd62\` ON \`mention\` (\`parentEntityType\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_4f9397b277ec0791c5f9e2fd62\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_5b95805861f9de5cf7760a964a\` ON \`mention\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`parentEntityType\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`parentEntityId\``);
	}
}
