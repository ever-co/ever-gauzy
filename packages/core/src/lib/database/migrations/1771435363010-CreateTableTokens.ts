import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTableTokens1771435363010 implements MigrationInterface {
	name = 'CreateTableTokens1771435363010';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(
			`CREATE TYPE "public"."tokens_status_enum" AS ENUM('ACTIVE', 'REVOKED', 'EXPIRED', 'ROTATED')`
		);
		await queryRunner.query(
			`CREATE TABLE "tokens" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tokenHash" character varying(255) NOT NULL, "tokenType" character varying(50) NOT NULL, "status" "public"."tokens_status_enum" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP, "lastUsedAt" TIMESTAMP, "usageCount" integer NOT NULL DEFAULT '0', "rotatedFromTokenId" uuid, "rotatedToTokenId" uuid, "revokedAt" TIMESTAMP, "revokedReason" character varying(255), "revokedById" uuid, "metadata" jsonb, "version" integer NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_3001e89ada36263dabf1fb6210a" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_d1a23e22ed7aaed288357bdfcd" ON "tokens" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1adbf8d74a9eb8ce9510f938a3" ON "tokens" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_daa87dd8ed79915baebce5c9ce" ON "tokens" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0878f2aa3b60e0366925fbe31f" ON "tokens" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_80b62ec4dda473d55450638961" ON "tokens" ("isArchived") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6777a5343aac1f6040b6bb872e" ON "tokens" ("rotatedFromTokenId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_630f6f12a435e5ef50350b1ddb" ON "tokens" ("rotatedToTokenId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d82ec12d7a61f38cb34ea3a054" ON "tokens" ("revokedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_d417e5d35f2434afc4bd48cb4d" ON "tokens" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_28c9785f3f1506fb8d1f55e9b8" ON "tokens" ("expiresAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_07481c6f9a1bb2232215ff79b8" ON "tokens" ("userId", "tokenType", "status") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f" ON "tokens" ("tokenHash", "status") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d089468ffba8d8ad3954f9d82d" ON "tokens" ("tokenHash") `);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article_version" ALTER COLUMN "lastSavedAt" DROP DEFAULT`);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_d1a23e22ed7aaed288357bdfcda" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_1adbf8d74a9eb8ce9510f938a32" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_daa87dd8ed79915baebce5c9ce4" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_6777a5343aac1f6040b6bb872e2" FOREIGN KEY ("rotatedFromTokenId") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_630f6f12a435e5ef50350b1ddb3" FOREIGN KEY ("rotatedToTokenId") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_d82ec12d7a61f38cb34ea3a0543" FOREIGN KEY ("revokedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tokens" ADD CONSTRAINT "FK_d417e5d35f2434afc4bd48cb4d2" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_d417e5d35f2434afc4bd48cb4d2"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_d82ec12d7a61f38cb34ea3a0543"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_630f6f12a435e5ef50350b1ddb3"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_6777a5343aac1f6040b6bb872e2"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_daa87dd8ed79915baebce5c9ce4"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_1adbf8d74a9eb8ce9510f938a32"`);
		await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_d1a23e22ed7aaed288357bdfcda"`);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article_version" ALTER COLUMN "lastSavedAt" SET DEFAULT now()`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_d089468ffba8d8ad3954f9d82d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6e6fc3bc9aec94a7f55a5500f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_07481c6f9a1bb2232215ff79b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_28c9785f3f1506fb8d1f55e9b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d417e5d35f2434afc4bd48cb4d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d82ec12d7a61f38cb34ea3a054"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_630f6f12a435e5ef50350b1ddb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6777a5343aac1f6040b6bb872e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_80b62ec4dda473d55450638961"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0878f2aa3b60e0366925fbe31f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_daa87dd8ed79915baebce5c9ce"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1adbf8d74a9eb8ce9510f938a3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d1a23e22ed7aaed288357bdfcd"`);
		await queryRunner.query(`DROP TABLE "tokens"`);
		await queryRunner.query(`DROP TYPE "public"."tokens_status_enum"`);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE TABLE "tokens" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tokenHash" varchar(255) NOT NULL, "tokenType" varchar(50) NOT NULL, "status" varchar CHECK( "status" IN ('ACTIVE','REVOKED','EXPIRED','ROTATED') ) NOT NULL DEFAULT ('ACTIVE'), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "rotatedFromTokenId" varchar, "rotatedToTokenId" varchar, "revokedAt" datetime, "revokedReason" varchar(255), "revokedById" varchar, "metadata" text, "version" integer NOT NULL, "userId" varchar NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_d1a23e22ed7aaed288357bdfcd" ON "tokens" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1adbf8d74a9eb8ce9510f938a3" ON "tokens" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_daa87dd8ed79915baebce5c9ce" ON "tokens" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0878f2aa3b60e0366925fbe31f" ON "tokens" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_80b62ec4dda473d55450638961" ON "tokens" ("isArchived") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6777a5343aac1f6040b6bb872e" ON "tokens" ("rotatedFromTokenId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_630f6f12a435e5ef50350b1ddb" ON "tokens" ("rotatedToTokenId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d82ec12d7a61f38cb34ea3a054" ON "tokens" ("revokedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_d417e5d35f2434afc4bd48cb4d" ON "tokens" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_28c9785f3f1506fb8d1f55e9b8" ON "tokens" ("expiresAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_07481c6f9a1bb2232215ff79b8" ON "tokens" ("userId", "tokenType", "status") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f" ON "tokens" ("tokenHash", "status") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d089468ffba8d8ad3954f9d82d" ON "tokens" ("tokenHash") `);
		await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
		await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
		await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
		await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
		await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
		await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
		await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
		await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
		await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL, "articleId" varchar NOT NULL, "ownedById" varchar, CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_knowledge_base_article_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById" FROM "knowledge_base_article_version"`
		);
		await queryRunner.query(`DROP TABLE "knowledge_base_article_version"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_knowledge_base_article_version" RENAME TO "knowledge_base_article_version"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d1a23e22ed7aaed288357bdfcd"`);
		await queryRunner.query(`DROP INDEX "IDX_1adbf8d74a9eb8ce9510f938a3"`);
		await queryRunner.query(`DROP INDEX "IDX_daa87dd8ed79915baebce5c9ce"`);
		await queryRunner.query(`DROP INDEX "IDX_0878f2aa3b60e0366925fbe31f"`);
		await queryRunner.query(`DROP INDEX "IDX_80b62ec4dda473d55450638961"`);
		await queryRunner.query(`DROP INDEX "IDX_6777a5343aac1f6040b6bb872e"`);
		await queryRunner.query(`DROP INDEX "IDX_630f6f12a435e5ef50350b1ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_d82ec12d7a61f38cb34ea3a054"`);
		await queryRunner.query(`DROP INDEX "IDX_d417e5d35f2434afc4bd48cb4d"`);
		await queryRunner.query(`DROP INDEX "IDX_28c9785f3f1506fb8d1f55e9b8"`);
		await queryRunner.query(`DROP INDEX "IDX_07481c6f9a1bb2232215ff79b8"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f"`);
		await queryRunner.query(`DROP INDEX "IDX_d089468ffba8d8ad3954f9d82d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_tokens" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tokenHash" varchar(255) NOT NULL, "tokenType" varchar(50) NOT NULL, "status" varchar CHECK( "status" IN ('ACTIVE','REVOKED','EXPIRED','ROTATED') ) NOT NULL DEFAULT ('ACTIVE'), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "rotatedFromTokenId" varchar, "rotatedToTokenId" varchar, "revokedAt" datetime, "revokedReason" varchar(255), "revokedById" varchar, "metadata" text, "version" integer NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "FK_d1a23e22ed7aaed288357bdfcda" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1adbf8d74a9eb8ce9510f938a32" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_daa87dd8ed79915baebce5c9ce4" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6777a5343aac1f6040b6bb872e2" FOREIGN KEY ("rotatedFromTokenId") REFERENCES "tokens" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_630f6f12a435e5ef50350b1ddb3" FOREIGN KEY ("rotatedToTokenId") REFERENCES "tokens" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d82ec12d7a61f38cb34ea3a0543" FOREIGN KEY ("revokedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d417e5d35f2434afc4bd48cb4d2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_tokens"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tokenHash", "tokenType", "status", "expiresAt", "lastUsedAt", "usageCount", "rotatedFromTokenId", "rotatedToTokenId", "revokedAt", "revokedReason", "revokedById", "metadata", "version", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tokenHash", "tokenType", "status", "expiresAt", "lastUsedAt", "usageCount", "rotatedFromTokenId", "rotatedToTokenId", "revokedAt", "revokedReason", "revokedById", "metadata", "version", "userId" FROM "tokens"`
		);
		await queryRunner.query(`DROP TABLE "tokens"`);
		await queryRunner.query(`ALTER TABLE "temporary_tokens" RENAME TO "tokens"`);
		await queryRunner.query(`CREATE INDEX "IDX_d1a23e22ed7aaed288357bdfcd" ON "tokens" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1adbf8d74a9eb8ce9510f938a3" ON "tokens" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_daa87dd8ed79915baebce5c9ce" ON "tokens" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0878f2aa3b60e0366925fbe31f" ON "tokens" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_80b62ec4dda473d55450638961" ON "tokens" ("isArchived") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6777a5343aac1f6040b6bb872e" ON "tokens" ("rotatedFromTokenId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_630f6f12a435e5ef50350b1ddb" ON "tokens" ("rotatedToTokenId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d82ec12d7a61f38cb34ea3a054" ON "tokens" ("revokedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_d417e5d35f2434afc4bd48cb4d" ON "tokens" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_28c9785f3f1506fb8d1f55e9b8" ON "tokens" ("expiresAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_07481c6f9a1bb2232215ff79b8" ON "tokens" ("userId", "tokenType", "status") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f" ON "tokens" ("tokenHash", "status") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d089468ffba8d8ad3954f9d82d" ON "tokens" ("tokenHash") `);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d089468ffba8d8ad3954f9d82d"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f"`);
		await queryRunner.query(`DROP INDEX "IDX_07481c6f9a1bb2232215ff79b8"`);
		await queryRunner.query(`DROP INDEX "IDX_28c9785f3f1506fb8d1f55e9b8"`);
		await queryRunner.query(`DROP INDEX "IDX_d417e5d35f2434afc4bd48cb4d"`);
		await queryRunner.query(`DROP INDEX "IDX_d82ec12d7a61f38cb34ea3a054"`);
		await queryRunner.query(`DROP INDEX "IDX_630f6f12a435e5ef50350b1ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_6777a5343aac1f6040b6bb872e"`);
		await queryRunner.query(`DROP INDEX "IDX_80b62ec4dda473d55450638961"`);
		await queryRunner.query(`DROP INDEX "IDX_0878f2aa3b60e0366925fbe31f"`);
		await queryRunner.query(`DROP INDEX "IDX_daa87dd8ed79915baebce5c9ce"`);
		await queryRunner.query(`DROP INDEX "IDX_1adbf8d74a9eb8ce9510f938a3"`);
		await queryRunner.query(`DROP INDEX "IDX_d1a23e22ed7aaed288357bdfcd"`);
		await queryRunner.query(`ALTER TABLE "tokens" RENAME TO "temporary_tokens"`);
		await queryRunner.query(
			`CREATE TABLE "tokens" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tokenHash" varchar(255) NOT NULL, "tokenType" varchar(50) NOT NULL, "status" varchar CHECK( "status" IN ('ACTIVE','REVOKED','EXPIRED','ROTATED') ) NOT NULL DEFAULT ('ACTIVE'), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "rotatedFromTokenId" varchar, "rotatedToTokenId" varchar, "revokedAt" datetime, "revokedReason" varchar(255), "revokedById" varchar, "metadata" text, "version" integer NOT NULL, "userId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "tokens"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tokenHash", "tokenType", "status", "expiresAt", "lastUsedAt", "usageCount", "rotatedFromTokenId", "rotatedToTokenId", "revokedAt", "revokedReason", "revokedById", "metadata", "version", "userId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tokenHash", "tokenType", "status", "expiresAt", "lastUsedAt", "usageCount", "rotatedFromTokenId", "rotatedToTokenId", "revokedAt", "revokedReason", "revokedById", "metadata", "version", "userId" FROM "temporary_tokens"`
		);
		await queryRunner.query(`DROP TABLE "temporary_tokens"`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d089468ffba8d8ad3954f9d82d" ON "tokens" ("tokenHash") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f" ON "tokens" ("tokenHash", "status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_07481c6f9a1bb2232215ff79b8" ON "tokens" ("userId", "tokenType", "status") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_28c9785f3f1506fb8d1f55e9b8" ON "tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_d417e5d35f2434afc4bd48cb4d" ON "tokens" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d82ec12d7a61f38cb34ea3a054" ON "tokens" ("revokedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_630f6f12a435e5ef50350b1ddb" ON "tokens" ("rotatedToTokenId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6777a5343aac1f6040b6bb872e" ON "tokens" ("rotatedFromTokenId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_80b62ec4dda473d55450638961" ON "tokens" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_0878f2aa3b60e0366925fbe31f" ON "tokens" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_daa87dd8ed79915baebce5c9ce" ON "tokens" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1adbf8d74a9eb8ce9510f938a3" ON "tokens" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d1a23e22ed7aaed288357bdfcd" ON "tokens" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_352f7641b71c9ef4fc5ff43a13"`);
		await queryRunner.query(`DROP INDEX "IDX_8988192a829df38557fad2e391"`);
		await queryRunner.query(`DROP INDEX "IDX_5f735ae4212db03913d45c9691"`);
		await queryRunner.query(`DROP INDEX "IDX_8e88da91c9a83d28665f2ac06b"`);
		await queryRunner.query(`DROP INDEX "IDX_a8520a586d162304e2b555c403"`);
		await queryRunner.query(`DROP INDEX "IDX_10550080f54a06e28d5eccc6ed"`);
		await queryRunner.query(`DROP INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799"`);
		await queryRunner.query(`DROP INDEX "IDX_d6f7f270eff562bc028b3785a0"`);
		await queryRunner.query(`DROP INDEX "IDX_7c3505837e5137fda591a8f052"`);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article_version" RENAME TO "temporary_knowledge_base_article_version"`
		);
		await queryRunner.query(
			`CREATE TABLE "knowledge_base_article_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "descriptionHtml" text, "descriptionJson" text, "lastSavedAt" datetime NOT NULL DEFAULT (datetime('now')), "articleId" varchar NOT NULL, "ownedById" varchar, CONSTRAINT "FK_7c3505837e5137fda591a8f0523" FOREIGN KEY ("ownedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d6f7f270eff562bc028b3785a0f" FOREIGN KEY ("articleId") REFERENCES "knowledge_base_article" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f9ba7e2d3c6f5aff0ed3f327997" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_10550080f54a06e28d5eccc6ed7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5f735ae4212db03913d45c96918" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8988192a829df38557fad2e3914" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_352f7641b71c9ef4fc5ff43a13f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "knowledge_base_article_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "descriptionHtml", "descriptionJson", "lastSavedAt", "articleId", "ownedById" FROM "temporary_knowledge_base_article_version"`
		);
		await queryRunner.query(`DROP TABLE "temporary_knowledge_base_article_version"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_352f7641b71c9ef4fc5ff43a13" ON "knowledge_base_article_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8988192a829df38557fad2e391" ON "knowledge_base_article_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f735ae4212db03913d45c9691" ON "knowledge_base_article_version" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e88da91c9a83d28665f2ac06b" ON "knowledge_base_article_version" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8520a586d162304e2b555c403" ON "knowledge_base_article_version" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_10550080f54a06e28d5eccc6ed" ON "knowledge_base_article_version" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ba7e2d3c6f5aff0ed3f32799" ON "knowledge_base_article_version" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6f7f270eff562bc028b3785a0" ON "knowledge_base_article_version" ("articleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c3505837e5137fda591a8f052" ON "knowledge_base_article_version" ("ownedById") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d089468ffba8d8ad3954f9d82d"`);
		await queryRunner.query(`DROP INDEX "IDX_b6e6fc3bc9aec94a7f55a5500f"`);
		await queryRunner.query(`DROP INDEX "IDX_07481c6f9a1bb2232215ff79b8"`);
		await queryRunner.query(`DROP INDEX "IDX_28c9785f3f1506fb8d1f55e9b8"`);
		await queryRunner.query(`DROP INDEX "IDX_d417e5d35f2434afc4bd48cb4d"`);
		await queryRunner.query(`DROP INDEX "IDX_d82ec12d7a61f38cb34ea3a054"`);
		await queryRunner.query(`DROP INDEX "IDX_630f6f12a435e5ef50350b1ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_6777a5343aac1f6040b6bb872e"`);
		await queryRunner.query(`DROP INDEX "IDX_80b62ec4dda473d55450638961"`);
		await queryRunner.query(`DROP INDEX "IDX_0878f2aa3b60e0366925fbe31f"`);
		await queryRunner.query(`DROP INDEX "IDX_daa87dd8ed79915baebce5c9ce"`);
		await queryRunner.query(`DROP INDEX "IDX_1adbf8d74a9eb8ce9510f938a3"`);
		await queryRunner.query(`DROP INDEX "IDX_d1a23e22ed7aaed288357bdfcd"`);
		await queryRunner.query(`DROP TABLE "tokens"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(
			`CREATE TABLE \`tokens\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tokenHash\` varchar(255) NOT NULL, \`tokenType\` varchar(50) NOT NULL, \`status\` enum ('ACTIVE', 'REVOKED', 'EXPIRED', 'ROTATED') NOT NULL DEFAULT 'ACTIVE', \`expiresAt\` datetime NULL, \`lastUsedAt\` datetime NULL, \`usageCount\` int NOT NULL DEFAULT '0', \`rotatedFromTokenId\` varchar(255) NULL, \`rotatedToTokenId\` varchar(255) NULL, \`revokedAt\` datetime NULL, \`revokedReason\` varchar(255) NULL, \`revokedById\` varchar(255) NULL, \`metadata\` json NULL, \`version\` int NOT NULL, \`userId\` varchar(255) NOT NULL, INDEX \`IDX_d1a23e22ed7aaed288357bdfcd\` (\`createdByUserId\`), INDEX \`IDX_1adbf8d74a9eb8ce9510f938a3\` (\`updatedByUserId\`), INDEX \`IDX_daa87dd8ed79915baebce5c9ce\` (\`deletedByUserId\`), INDEX \`IDX_0878f2aa3b60e0366925fbe31f\` (\`isActive\`), INDEX \`IDX_80b62ec4dda473d55450638961\` (\`isArchived\`), UNIQUE INDEX \`IDX_6777a5343aac1f6040b6bb872e\` (\`rotatedFromTokenId\`), INDEX \`IDX_630f6f12a435e5ef50350b1ddb\` (\`rotatedToTokenId\`), INDEX \`IDX_d82ec12d7a61f38cb34ea3a054\` (\`revokedById\`), INDEX \`IDX_d417e5d35f2434afc4bd48cb4d\` (\`userId\`), INDEX \`IDX_28c9785f3f1506fb8d1f55e9b8\` (\`expiresAt\`), INDEX \`IDX_07481c6f9a1bb2232215ff79b8\` (\`userId\`, \`tokenType\`, \`status\`), INDEX \`IDX_b6e6fc3bc9aec94a7f55a5500f\` (\`tokenHash\`, \`status\`), UNIQUE INDEX \`IDX_d089468ffba8d8ad3954f9d82d\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP COLUMN \`lastSavedAt\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` ADD \`lastSavedAt\` datetime NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_d1a23e22ed7aaed288357bdfcda\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_1adbf8d74a9eb8ce9510f938a32\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_daa87dd8ed79915baebce5c9ce4\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_6777a5343aac1f6040b6bb872e2\` FOREIGN KEY (\`rotatedFromTokenId\`) REFERENCES \`tokens\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_630f6f12a435e5ef50350b1ddb3\` FOREIGN KEY (\`rotatedToTokenId\`) REFERENCES \`tokens\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_d82ec12d7a61f38cb34ea3a0543\` FOREIGN KEY (\`revokedById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tokens\` ADD CONSTRAINT \`FK_d417e5d35f2434afc4bd48cb4d2\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_d417e5d35f2434afc4bd48cb4d2\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_d82ec12d7a61f38cb34ea3a0543\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_630f6f12a435e5ef50350b1ddb3\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_6777a5343aac1f6040b6bb872e2\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_daa87dd8ed79915baebce5c9ce4\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_1adbf8d74a9eb8ce9510f938a32\``);
		await queryRunner.query(`ALTER TABLE \`tokens\` DROP FOREIGN KEY \`FK_d1a23e22ed7aaed288357bdfcda\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_article_version\` DROP COLUMN \`lastSavedAt\``);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article_version\` ADD \`lastSavedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`
		);
		await queryRunner.query(`DROP INDEX \`IDX_d089468ffba8d8ad3954f9d82d\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6e6fc3bc9aec94a7f55a5500f\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_07481c6f9a1bb2232215ff79b8\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_28c9785f3f1506fb8d1f55e9b8\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_d417e5d35f2434afc4bd48cb4d\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_d82ec12d7a61f38cb34ea3a054\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_630f6f12a435e5ef50350b1ddb\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_6777a5343aac1f6040b6bb872e\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_80b62ec4dda473d55450638961\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_0878f2aa3b60e0366925fbe31f\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_daa87dd8ed79915baebce5c9ce\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_1adbf8d74a9eb8ce9510f938a3\` ON \`tokens\``);
		await queryRunner.query(`DROP INDEX \`IDX_d1a23e22ed7aaed288357bdfcd\` ON \`tokens\``);
		await queryRunner.query(`DROP TABLE \`tokens\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
