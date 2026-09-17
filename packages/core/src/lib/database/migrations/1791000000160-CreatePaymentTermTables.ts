import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the settlement terms and the instalments they produce.
 *
 * An integer `paymentTermsDays` is net-N and nothing else: it cannot express `2/10 net 30`, a deposit at
 * order with the balance on delivery, a `30/60/90` schedule or end-of-month dating — the ordinary B2B
 * conventions asked for in the first week of a real deployment, each of which would otherwise arrive as
 * another integer column and another branch in the invoice bridge. A term is also an object many parties
 * share, so the same 30/60 agreement is corrected once rather than retyped on every contact.
 *
 * **The schedule is deliberately not stored.** A term names an agreement; the money a document owes under
 * it depends on that document's own total and basis date, so it is derived when it is asked for. A stored
 * instalment table would turn a projection into a ledger and create a second answer to "how much is due"
 * beside the document's own `amountDue` — which is also why editing a term cannot rewrite a document that
 * was already settled against it: the document keeps the term it used and its own money facts.
 *
 * **`payment_term` has no validity window and no status column, on purpose.** The document's own basis
 * date is a stronger guarantee than a window — a window would be a second, weaker answer to "which term
 * applied" — and a second state machine would need its own reconciler. A term is archived, never
 * hard-deleted, because the documents that name it are explained by it.
 *
 * **Every statement is guarded by `hasTable`**, so a database that already has the tables — one
 * synchronised from the entities, or one where this file has already run — gains nothing on a re-run
 * rather than failing on the first `CREATE TABLE`.
 */
export class CreatePaymentTermTables1791000000160 implements MigrationInterface {
	name = 'CreatePaymentTermTables1791000000160';

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
		if (!(await queryRunner.hasTable('payment_term'))) {
			await queryRunner.query(
				`CREATE TABLE "payment_term" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_payment_term_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_created_by_user" ON "payment_term" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_updated_by_user" ON "payment_term" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_deleted_by_user" ON "payment_term" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_is_active" ON "payment_term" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_is_archived" ON "payment_term" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_tenant" ON "payment_term" ("tenantId")`);
			// The operator's key for the agreement, unique per organization among live rows so a
			// soft-deleted term does not keep its code occupied for ever.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_org_code" ON "payment_term" ("organizationId", "code") WHERE "deletedAt" IS NULL`
			);
			// One default per organization: the term a document with no other answer is settled against.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_default" ON "payment_term" ("organizationId") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_term_org" ON "payment_term" ("organizationId", "isDefault") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('payment_term_line'))) {
			await queryRunner.query(
				`CREATE TABLE "payment_term_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "paymentTermId" uuid NOT NULL, "sequence" integer NOT NULL DEFAULT 1, "valueType" character varying(16) NOT NULL DEFAULT 'PERCENT', "valueAmount" numeric(9,6) NOT NULL, "currency" character varying(3), "dueBasis" character varying(32) NOT NULL DEFAULT 'INVOICE_DATE', "days" integer NOT NULL DEFAULT 0, "dayOfMonth" smallint, "metadata" jsonb, CONSTRAINT "CHK_payment_term_line_percent" CHECK ("valueType" <> 'PERCENT' OR ("valueAmount" >= 0 AND "valueAmount" <= 100)), CONSTRAINT "CHK_payment_term_line_currency" CHECK (("valueType" = 'FIXED') = ("currency" IS NOT NULL)), CONSTRAINT "CHK_payment_term_line_day" CHECK (("dueBasis" = 'DAY_OF_NEXT_MONTH') = ("dayOfMonth" IS NOT NULL)), CONSTRAINT "CHK_payment_term_line_days_nonneg" CHECK ("days" >= 0), CONSTRAINT "FK_payment_term_line_term" FOREIGN KEY ("paymentTermId") REFERENCES "payment_term"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "PK_payment_term_line_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_created_by_user" ON "payment_term_line" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_updated_by_user" ON "payment_term_line" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_deleted_by_user" ON "payment_term_line" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_is_active" ON "payment_term_line" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_is_archived" ON "payment_term_line" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_tenant" ON "payment_term_line" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_organization" ON "payment_term_line" ("organizationId")`);
			// An instalment is addressed by its position inside its term, so two lines may not share one.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_line_seq" ON "payment_term_line" ("paymentTermId", "sequence") WHERE "deletedAt" IS NULL`
			);
			// Reading a term's schedule is a single indexed read of its live instalments in order.
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_term_line_term" ON "payment_term_line" ("paymentTermId") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The line table first: it carries the foreign key into its term.
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_term_line"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_term"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('payment_term'))) {
			await queryRunner.query(
				`CREATE TABLE "payment_term" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT (0), "metadata" text)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_created_by_user" ON "payment_term" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_updated_by_user" ON "payment_term" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_deleted_by_user" ON "payment_term" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_is_active" ON "payment_term" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_is_archived" ON "payment_term" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_tenant" ON "payment_term" ("tenantId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_org_code" ON "payment_term" ("organizationId", "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_default" ON "payment_term" ("organizationId") WHERE "isDefault" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_term_org" ON "payment_term" ("organizationId", "isDefault") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('payment_term_line'))) {
			await queryRunner.query(
				`CREATE TABLE "payment_term_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "paymentTermId" varchar NOT NULL, "sequence" integer NOT NULL DEFAULT (1), "valueType" varchar(16) NOT NULL DEFAULT ('PERCENT'), "valueAmount" numeric(9,6) NOT NULL, "currency" varchar(3), "dueBasis" varchar(32) NOT NULL DEFAULT ('INVOICE_DATE'), "days" integer NOT NULL DEFAULT (0), "dayOfMonth" smallint, "metadata" text, CONSTRAINT "FK_payment_term_line_term" FOREIGN KEY ("paymentTermId") REFERENCES "payment_term" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_created_by_user" ON "payment_term_line" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_updated_by_user" ON "payment_term_line" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_deleted_by_user" ON "payment_term_line" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_is_active" ON "payment_term_line" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_is_archived" ON "payment_term_line" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_tenant" ON "payment_term_line" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_payment_term_line_organization" ON "payment_term_line" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_payment_term_line_seq" ON "payment_term_line" ("paymentTermId", "sequence") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_payment_term_line_term" ON "payment_term_line" ("paymentTermId") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_term_line"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "payment_term"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so both partial unique indexes are expressed the documented way: a
	 * **stored generated key column** that is `'0'` while the row is live and the row's own id once it is
	 * deleted, appended to the tuple. Live rows then collide on the key and soft-deleted rows never do,
	 * which is what a `WHERE "deletedAt" IS NULL` predicate accomplishes on the other two dialects, and
	 * `payment_term.isDefault` needs a second generated key of the same shape (`'1'` or `NULL`) because a
	 * boolean cannot be a null-guarded tuple member. Those columns exist on MySQL only and are declared
	 * by no entity — the documented price of a filtered index on a dialect that has none.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('payment_term'))) {
			await queryRunner.query(
				`CREATE TABLE \`payment_term\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`description\` text NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isDefaultKey\` varchar(1) GENERATED ALWAYS AS (IF(\`isDefault\`, '1', NULL)) STORED, INDEX \`IDX_payment_term_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_term_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_term_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_term_is_active\` (\`isActive\`), INDEX \`IDX_payment_term_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_term_tenant\` (\`tenantId\`), UNIQUE INDEX \`UQ_payment_term_org_code\` (\`organizationId\`, \`code\`, \`deletedKey\`), UNIQUE INDEX \`UQ_payment_term_default\` (\`organizationId\`, \`isDefaultKey\`, \`deletedKey\`), INDEX \`IDX_payment_term_org\` (\`organizationId\`, \`isDefault\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('payment_term_line'))) {
			await queryRunner.query(
				`CREATE TABLE \`payment_term_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`paymentTermId\` varchar(36) NOT NULL, \`sequence\` int NOT NULL DEFAULT 1, \`valueType\` varchar(16) NOT NULL DEFAULT 'PERCENT', \`valueAmount\` decimal(9,6) NOT NULL, \`currency\` varchar(3) NULL, \`dueBasis\` varchar(32) NOT NULL DEFAULT 'INVOICE_DATE', \`days\` int NOT NULL DEFAULT 0, \`dayOfMonth\` smallint NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_payment_term_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_payment_term_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_payment_term_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_payment_term_line_is_active\` (\`isActive\`), INDEX \`IDX_payment_term_line_is_archived\` (\`isArchived\`), INDEX \`IDX_payment_term_line_tenant\` (\`tenantId\`), INDEX \`IDX_payment_term_line_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_payment_term_line_seq\` (\`paymentTermId\`, \`sequence\`, \`deletedKey\`), INDEX \`IDX_payment_term_line_term\` (\`paymentTermId\`), CONSTRAINT \`CHK_payment_term_line_percent\` CHECK (\`valueType\` <> 'PERCENT' OR (\`valueAmount\` >= 0 AND \`valueAmount\` <= 100)), CONSTRAINT \`CHK_payment_term_line_currency\` CHECK ((\`valueType\` = 'FIXED') = (\`currency\` IS NOT NULL)), CONSTRAINT \`CHK_payment_term_line_day\` CHECK ((\`dueBasis\` = 'DAY_OF_NEXT_MONTH') = (\`dayOfMonth\` IS NOT NULL)), CONSTRAINT \`CHK_payment_term_line_days_nonneg\` CHECK (\`days\` >= 0), CONSTRAINT \`FK_payment_term_line_term\` FOREIGN KEY (\`paymentTermId\`) REFERENCES \`payment_term\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`payment_term_line\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`payment_term\``);
	}
}
