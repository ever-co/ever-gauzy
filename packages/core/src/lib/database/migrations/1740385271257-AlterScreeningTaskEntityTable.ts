import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterScreeningTaskEntityTable1740385271257 implements MigrationInterface {
	name = 'AlterScreeningTaskEntityTable1740385271257';

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
		await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_b7864d01ba77b2d964487799252"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b7864d01ba77b2d96448779925"`);
		await queryRunner.query(`ALTER TABLE "screening_task" RENAME COLUMN "creatorId" TO "createdByUserId"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_28727a84fdc4cad1cafd070148" ON "screening_task" ("createdByUserId") `
		);
		await queryRunner.query(
			`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_28727a84fdc4cad1cafd0701482" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_28727a84fdc4cad1cafd0701482"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_28727a84fdc4cad1cafd070148"`);
		await queryRunner.query(`ALTER TABLE "screening_task" RENAME COLUMN "createdByUserId" TO "creatorId"`);
		await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_b7864d01ba77b2d964487799252" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId" FROM "screening_task"`
		);
		await queryRunner.query(`DROP TABLE "screening_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_screening_task" RENAME TO "screening_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "createdByUserId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId" FROM "screening_task"`
		);
		await queryRunner.query(`DROP TABLE "screening_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_screening_task" RENAME TO "screening_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_28727a84fdc4cad1cafd070148" ON "screening_task" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(`DROP INDEX "IDX_28727a84fdc4cad1cafd070148"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "createdByUserId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_28727a84fdc4cad1cafd0701482" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId" FROM "screening_task"`
		);
		await queryRunner.query(`DROP TABLE "screening_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_screening_task" RENAME TO "screening_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_28727a84fdc4cad1cafd070148" ON "screening_task" ("createdByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_28727a84fdc4cad1cafd070148"`);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`ALTER TABLE "screening_task" RENAME TO "temporary_screening_task"`);
		await queryRunner.query(
			`CREATE TABLE "screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "createdByUserId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId" FROM "temporary_screening_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_screening_task"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_28727a84fdc4cad1cafd070148" ON "screening_task" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`DROP INDEX "IDX_28727a84fdc4cad1cafd070148"`);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`ALTER TABLE "screening_task" RENAME TO "temporary_screening_task"`);
		await queryRunner.query(
			`CREATE TABLE "screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "createdByUserId" FROM "temporary_screening_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_screening_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
		await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
		await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
		await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
		await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
		await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
		await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
		await queryRunner.query(`ALTER TABLE "screening_task" RENAME TO "temporary_screening_task"`);
		await queryRunner.query(
			`CREATE TABLE "screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_b7864d01ba77b2d964487799252" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId" FROM "temporary_screening_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_screening_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`screening_task\` DROP FOREIGN KEY \`FK_b7864d01ba77b2d964487799252\``);
		await queryRunner.query(`DROP INDEX \`IDX_b7864d01ba77b2d96448779925\` ON \`screening_task\``);
		await queryRunner.query(
			`ALTER TABLE \`screening_task\` CHANGE \`creatorId\` \`createdByUserId\` varchar(255) NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_28727a84fdc4cad1cafd070148\` ON \`screening_task\` (\`createdByUserId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`screening_task\` ADD CONSTRAINT \`FK_28727a84fdc4cad1cafd0701482\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`screening_task\` DROP FOREIGN KEY \`FK_28727a84fdc4cad1cafd0701482\``);
		await queryRunner.query(`DROP INDEX \`IDX_28727a84fdc4cad1cafd070148\` ON \`screening_task\``);
		await queryRunner.query(
			`ALTER TABLE \`screening_task\` CHANGE \`createdByUserId\` \`creatorId\` varchar(255) NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_b7864d01ba77b2d96448779925\` ON \`screening_task\` (\`creatorId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`screening_task\` ADD CONSTRAINT \`FK_b7864d01ba77b2d964487799252\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
