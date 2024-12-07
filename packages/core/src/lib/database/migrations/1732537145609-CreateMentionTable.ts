import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateMentionTable1732537145609 implements MigrationInterface {
	name = 'CreateMentionTable1732537145609';

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
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entityId" character varying NOT NULL, "entity" character varying NOT NULL, "parentEntityId" character varying, "parentEntityType" character varying, "mentionedUserId" uuid NOT NULL, "mentionById" uuid NOT NULL, CONSTRAINT "PK_9b02b76c4b65e3c35c1a545bf57" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_34b0087a30379c86b470a4298ca"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_16a2deee0d7ea361950eed1b944"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_580d84e23219b07f520131f9271"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP TABLE "mention"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP TABLE "mention"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`mention\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entityId\` varchar(255) NOT NULL, \`entity\` varchar(255) NOT NULL, \`parentEntityId\` varchar(255) NULL, \`parentEntityType\` varchar(255) NULL, \`mentionedUserId\` varchar(255) NOT NULL, \`mentionById\` varchar(255) NOT NULL, INDEX \`IDX_2c71b2f53b9162a94e1f02e40b\` (\`isActive\`), INDEX \`IDX_9597d3f3afbf40e6ffd1b0ebc9\` (\`isArchived\`), INDEX \`IDX_580d84e23219b07f520131f927\` (\`tenantId\`), INDEX \`IDX_4f018d32b6d2e2c907833d0db1\` (\`organizationId\`), INDEX \`IDX_d01675da9ddf57bef5692fca8b\` (\`entityId\`), INDEX \`IDX_3d6a8e3430779c21f04513cc5a\` (\`entity\`), INDEX \`IDX_5b95805861f9de5cf7760a964a\` (\`parentEntityId\`), INDEX \`IDX_4f9397b277ec0791c5f9e2fd62\` (\`parentEntityType\`), INDEX \`IDX_16a2deee0d7ea361950eed1b94\` (\`mentionedUserId\`), INDEX \`IDX_34b0087a30379c86b470a4298c\` (\`mentionById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_580d84e23219b07f520131f9271\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_4f018d32b6d2e2c907833d0db11\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_16a2deee0d7ea361950eed1b944\` FOREIGN KEY (\`mentionedUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_34b0087a30379c86b470a4298ca\` FOREIGN KEY (\`mentionById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_34b0087a30379c86b470a4298ca\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_16a2deee0d7ea361950eed1b944\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_4f018d32b6d2e2c907833d0db11\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_580d84e23219b07f520131f9271\``);
		await queryRunner.query(`DROP INDEX \`IDX_34b0087a30379c86b470a4298c\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_16a2deee0d7ea361950eed1b94\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_4f9397b277ec0791c5f9e2fd62\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_5b95805861f9de5cf7760a964a\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_3d6a8e3430779c21f04513cc5a\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_d01675da9ddf57bef5692fca8b\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_4f018d32b6d2e2c907833d0db1\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_580d84e23219b07f520131f927\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_9597d3f3afbf40e6ffd1b0ebc9\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_2c71b2f53b9162a94e1f02e40b\` ON \`mention\``);
		await queryRunner.query(`DROP TABLE \`mention\``);
	}
}
