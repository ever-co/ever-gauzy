import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the two platform tables global search is built on.
 *
 * Both tables are core rather than one domain's: the index has to cover contacts, invoices, expenses,
 * products, orders, projects, tasks, employees and documents alike, so an index a single domain owned
 * would make every other domain depend on that domain's package. What is searchable and how much each
 * field weighs is **data** — the `search_index_definition` row — so adding a searchable entity, or
 * re-weighting one, is a row rather than a deployment.
 *
 * `search_document` is a projection and never authoritative: it is keyed by
 * `(tenantId, entity, entityId, engineKey)`, which is what makes indexing the same source row twice an
 * update rather than a duplicate, and which lets the outbox consumer that maintains it be idempotent
 * without bookkeeping of its own.
 *
 * Dialect notes, each of which is a real difference rather than a convenience:
 *
 * - **Postgres** gets a generated `tsvector` column over the title, the body and the promoted
 *   keywords, plus a GIN index on the attribute map. The entity deliberately does not declare the
 *   generated column, so the same mapping runs on the other two dialects.
 * - **MySQL** has no partial indexes, so the two partial unique indexes are expressed with stored
 *   generated key columns — `deletedKey` (`'0'` while live, the row id once deleted), `engineKeyKey`
 *   (the engine key, or the empty string for the built-in database provider), `tenantKey` and
 *   `organizationKey` — and a `FULLTEXT` index over the title and the body carries the free-text
 *   load. The last two fold a null the same way the Postgres and SQLite index expressions fold it
 *   with `COALESCE`: a document or a definition that carries no tenant or no organization is one
 *   row, and without the fold no dialect would hold it to the rule at all.
 * - **SQLite** supports partial indexes, so it uses them directly, and reads the title with a prefix
 *   `LIKE` served by `IDX_search_document_title`.
 *
 * **`keywords` and `keywordFields` are JSON arrays, not text.** Both are declared with the platform's
 * JSON-array column decorator, which stores a list: `text` on SQLite (where `simple-json` is a `text`
 * column serialised by the transformer) but `jsonb` on Postgres and `json` on MySQL. They were
 * created as `text` on all three dialects, which is a type mismatch *inside core* on the two dialects
 * that have a real JSON type: the entity writes an array, the column says text, and the driver rejects
 * or silently rewrites the value — and on Postgres the `searchVector` generated column below reads
 * the column, so its expression casts `keywords` to `text` explicitly rather than relying on an
 * implicit cast that does not exist for `jsonb`. The declared type in each dialect branch of this file
 * is therefore the type the entity's decorator produces, per dialect, and the SQLite branch is
 * deliberately left as `text` because that is exactly what `simple-json` is there.
 */
export class CreateSearchTables1791000000080 implements MigrationInterface {
	name = 'CreateSearchTables1791000000080';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
			`CREATE TABLE "search_index_definition" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying(128) NOT NULL, "label" character varying(255) NOT NULL, "engineKey" character varying(64), "fields" jsonb NOT NULL DEFAULT '[]', "defaultWeight" numeric(9,6) NOT NULL DEFAULT 1, "titleTemplate" character varying(512), "bodyTemplate" character varying(1024), "keywordFields" jsonb, "sourceUpdatedAtField" character varying(64) NOT NULL DEFAULT 'updatedAt', "isSystem" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1, "metadata" jsonb, CONSTRAINT "PK_search_index_definition_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_created_by_user" ON "search_index_definition" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_updated_by_user" ON "search_index_definition" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_deleted_by_user" ON "search_index_definition" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_index_definition_is_active" ON "search_index_definition" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_is_archived" ON "search_index_definition" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_index_definition_tenant" ON "search_index_definition" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_organization" ON "search_index_definition" ("organizationId")`
		);
		// One definition per entity per engine per organization: a definition with no engine is the
		// built-in database provider's, and it is a legitimate distinct row rather than a duplicate.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_index_definition_org_entity_nokey" ON "search_index_definition" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "entity") WHERE "engineKey" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_index_definition_org_entity_key" ON "search_index_definition" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "entity", "engineKey") WHERE "engineKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_active" ON "search_index_definition" ("organizationId", "isActive") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "search_document" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying(128) NOT NULL, "entityId" uuid NOT NULL, "title" character varying(512) NOT NULL, "body" text, "keywords" jsonb, "attributes" jsonb, "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("body", '') || ' ' || coalesce("keywords"::text, ''))) STORED, "sourceUpdatedAt" TIMESTAMP, "indexedAt" TIMESTAMP NOT NULL DEFAULT now(), "engineKey" character varying(64), "definitionVersion" integer NOT NULL DEFAULT 1, CONSTRAINT "PK_search_document_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_created_by_user" ON "search_document" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_updated_by_user" ON "search_document" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_deleted_by_user" ON "search_document" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_is_active" ON "search_document" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_is_archived" ON "search_document" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_tenant" ON "search_document" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_organization" ON "search_document" ("organizationId")`);
		// The row's identity: the same entity row is indexed once per tenant and per engine.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_document_entity_nokey" ON "search_document" (COALESCE("tenantId", \'00000000-0000-0000-0000-000000000000\'), "entity", "entityId") WHERE "engineKey" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_document_entity_key" ON "search_document" (COALESCE("tenantId", \'00000000-0000-0000-0000-000000000000\'), "entity", "entityId", "engineKey") WHERE "engineKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// The scan every query starts from, and the two keys the reindex sweep reads.
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_org_entity_updated" ON "search_document" ("organizationId", "entity", "sourceUpdatedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_title" ON "search_document" ("entity", "title") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_reindex" ON "search_document" ("entity", "definitionVersion", "indexedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_attributes" ON "search_document" USING GIN ("attributes" jsonb_path_ops)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_vector" ON "search_document" USING GIN ("searchVector")`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "search_document"`);
		await queryRunner.query(`DROP TABLE "search_index_definition"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// `keywordFields` and `keywords` stay `text` here on purpose: the entity's JSON-array decorator
		// resolves to `simple-json` on SQLite, which is a `text` column whose transformer serialises the
		// list. It is the two dialects that have a real JSON type where the column had to change.
		await queryRunner.query(
			`CREATE TABLE "search_index_definition" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar(128) NOT NULL, "label" varchar(255) NOT NULL, "engineKey" varchar(64), "fields" text NOT NULL DEFAULT ('[]'), "defaultWeight" numeric(9,6) NOT NULL DEFAULT (1), "titleTemplate" varchar(512), "bodyTemplate" varchar(1024), "keywordFields" text, "sourceUpdatedAtField" varchar(64) NOT NULL DEFAULT ('updatedAt'), "isSystem" boolean NOT NULL DEFAULT (0), "version" integer NOT NULL DEFAULT (1), "metadata" text)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_created_by_user" ON "search_index_definition" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_updated_by_user" ON "search_index_definition" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_deleted_by_user" ON "search_index_definition" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_index_definition_is_active" ON "search_index_definition" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_is_archived" ON "search_index_definition" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_index_definition_tenant" ON "search_index_definition" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_organization" ON "search_index_definition" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_index_definition_org_entity_nokey" ON "search_index_definition" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "entity") WHERE "engineKey" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_index_definition_org_entity_key" ON "search_index_definition" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "entity", "engineKey") WHERE "engineKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_index_definition_active" ON "search_index_definition" ("organizationId", "isActive") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "search_document" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar(128) NOT NULL, "entityId" varchar NOT NULL, "title" varchar(512) NOT NULL, "body" text, "keywords" text, "attributes" text, "sourceUpdatedAt" datetime, "indexedAt" datetime NOT NULL DEFAULT (datetime('now')), "engineKey" varchar(64), "definitionVersion" integer NOT NULL DEFAULT (1))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_created_by_user" ON "search_document" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_updated_by_user" ON "search_document" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_deleted_by_user" ON "search_document" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_is_active" ON "search_document" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_is_archived" ON "search_document" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_tenant" ON "search_document" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_search_document_organization" ON "search_document" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_document_entity_nokey" ON "search_document" (COALESCE("tenantId", \'00000000-0000-0000-0000-000000000000\'), "entity", "entityId") WHERE "engineKey" IS NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_search_document_entity_key" ON "search_document" (COALESCE("tenantId", \'00000000-0000-0000-0000-000000000000\'), "entity", "entityId", "engineKey") WHERE "engineKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_org_entity_updated" ON "search_document" ("organizationId", "entity", "sourceUpdatedAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_title" ON "search_document" ("entity", "title") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_search_document_reindex" ON "search_document" ("entity", "definitionVersion", "indexedAt") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_search_document_reindex"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_title"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_org_entity_updated"`);
		await queryRunner.query(`DROP INDEX "UQ_search_document_entity_key"`);
		await queryRunner.query(`DROP INDEX "UQ_search_document_entity_nokey"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_search_document_created_by_user"`);
		await queryRunner.query(`DROP TABLE "search_document"`);

		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_active"`);
		await queryRunner.query(`DROP INDEX "UQ_search_index_definition_org_entity_key"`);
		await queryRunner.query(`DROP INDEX "UQ_search_index_definition_org_entity_nokey"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_search_index_definition_created_by_user"`);
		await queryRunner.query(`DROP TABLE "search_index_definition"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`search_index_definition\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`entity\` varchar(128) NOT NULL, \`label\` varchar(255) NOT NULL, \`engineKey\` varchar(64) NULL, \`fields\` json NOT NULL, \`defaultWeight\` decimal(9,6) NOT NULL DEFAULT 1, \`titleTemplate\` varchar(512) NULL, \`bodyTemplate\` varchar(1024) NULL, \`keywordFields\` json NULL, \`sourceUpdatedAtField\` varchar(64) NOT NULL DEFAULT 'updatedAt', \`isSystem\` tinyint NOT NULL DEFAULT 0, \`version\` int NOT NULL DEFAULT 1, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`engineKeyKey\` varchar(64) GENERATED ALWAYS AS (IFNULL(\`engineKey\`, '')) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, INDEX \`IDX_search_index_definition_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_search_index_definition_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_search_index_definition_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_search_index_definition_is_active\` (\`isActive\`), INDEX \`IDX_search_index_definition_is_archived\` (\`isArchived\`), INDEX \`IDX_search_index_definition_tenant\` (\`tenantId\`), INDEX \`IDX_search_index_definition_organization\` (\`organizationId\`), INDEX \`IDX_search_index_definition_active\` (\`organizationId\`, \`isActive\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no partial indexes: the two partial uniques of the Postgres branch are one unique
		// over the defaulted engine key and the generated delete key.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_search_index_definition_org_entity_key\` ON \`search_index_definition\` (\`organizationKey\`, \`entity\`, \`engineKeyKey\`, \`deletedKey\`)`
		);

		await queryRunner.query(
			`CREATE TABLE \`search_document\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`entity\` varchar(128) NOT NULL, \`entityId\` varchar(36) NOT NULL, \`title\` varchar(512) NOT NULL, \`body\` text NULL, \`keywords\` json NULL, \`attributes\` json NULL, \`sourceUpdatedAt\` datetime NULL, \`indexedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`engineKey\` varchar(64) NULL, \`definitionVersion\` int NOT NULL DEFAULT 1, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`engineKeyKey\` varchar(64) GENERATED ALWAYS AS (IFNULL(\`engineKey\`, '')) STORED, \`tenantKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`tenantId\`, '')) STORED, INDEX \`IDX_search_document_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_search_document_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_search_document_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_search_document_is_active\` (\`isActive\`), INDEX \`IDX_search_document_is_archived\` (\`isArchived\`), INDEX \`IDX_search_document_tenant\` (\`tenantId\`), INDEX \`IDX_search_document_organization\` (\`organizationId\`), INDEX \`IDX_search_document_org_entity_updated\` (\`organizationId\`, \`entity\`, \`sourceUpdatedAt\`), INDEX \`IDX_search_document_title\` (\`entity\`, \`title\`), INDEX \`IDX_search_document_reindex\` (\`entity\`, \`definitionVersion\`, \`indexedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_search_document_entity_key\` ON \`search_document\` (\`tenantKey\`, \`entity\`, \`entityId\`, \`engineKeyKey\`, \`deletedKey\`)`
		);
		// MySQL's own full-text capability carries the free-text load where Postgres uses `tsvector`.
		await queryRunner.query(
			`CREATE FULLTEXT INDEX \`IDX_search_document_fulltext\` ON \`search_document\` (\`title\`, \`body\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_search_document_fulltext\` ON \`search_document\``);
		await queryRunner.query(`DROP INDEX \`UQ_search_document_entity_key\` ON \`search_document\``);
		await queryRunner.query(`DROP TABLE \`search_document\``);
		await queryRunner.query(`DROP INDEX \`UQ_search_index_definition_org_entity_key\` ON \`search_index_definition\``);
		await queryRunner.query(`DROP TABLE \`search_index_definition\``);
	}
}
