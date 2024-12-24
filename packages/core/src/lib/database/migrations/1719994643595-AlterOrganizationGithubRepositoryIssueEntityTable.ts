import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationGithubRepositoryIssueEntityTable1719994643595 implements MigrationInterface {
	name = 'AlterOrganizationGithubRepositoryIssueEntityTable1719994643595';

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
		await queryRunner.query(`DROP INDEX "public"."IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" TYPE bigint`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" SET NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" TYPE integer`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" SET NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
		await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
		await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
		await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
		await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar, "deletedAt" datetime, CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt" FROM "organization_github_repository_issue"`
		);
		await queryRunner.query(`DROP TABLE "organization_github_repository_issue"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_github_repository_issue" RENAME TO "organization_github_repository_issue"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
		await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
		await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
		await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
		await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" bigint NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar, "deletedAt" datetime, CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt" FROM "organization_github_repository_issue"`
		);
		await queryRunner.query(`DROP TABLE "organization_github_repository_issue"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_github_repository_issue" RENAME TO "organization_github_repository_issue"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
		await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
		await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
		await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
		await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
		await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" RENAME TO "temporary_organization_github_repository_issue"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar, "deletedAt" datetime, CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt" FROM "temporary_organization_github_repository_issue"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_github_repository_issue"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
		await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
		await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
		await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
		await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
		await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" RENAME TO "temporary_organization_github_repository_issue"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar, "deletedAt" datetime, CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId", "deletedAt" FROM "temporary_organization_github_repository_issue"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_github_repository_issue"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DROP INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` MODIFY COLUMN \`issueId\` bigint NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\` (\`issueId\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DROP INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` MODIFY COLUMN \`issueId\` int NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\` (\`issueId\`)`
		);
	}
}
