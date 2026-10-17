import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the measurement families and the units inside them.
 *
 * The two tables are what turn "10" and "120" from two numbers into two *quantities*. Conversion is
 * defined only inside one family, so the family is the thing that makes a stock ledger's sum — `Σ
 * stock_movement.quantity = level.quantity` — an arithmetic claim rather than a comparison of two
 * numbers that may denote different amounts of goods. Without them a backfilled stock level has no
 * family to state and that invariant cannot be checked at all, which is why they are kernel tables and
 * why no feature flag hides them: what a tenant chooses is not *whether* units exist but *how many it
 * declares*, which is data.
 *
 * **A category, not a self-referential tree of units.** A tree's root *is* the reference unit, so
 * convertibility becomes a path-prefix test rather than one indexed comparison, and changing an
 * intermediate node silently restates every descendant — a `BOX` going from 12 to 10 restates every
 * `PALLET` without touching the pallet row. With one absolute factor per unit, a unit's meaning changes
 * only when that unit changes. It is also why there is no `unit_conversion` pair table: with one
 * category and one factor per unit every pair is already derivable, so a pair table would be n² rows
 * and a second source of truth that can disagree with the unit rows.
 *
 * **Every statement is guarded by `hasTable`.** The guard is not decoration: a migration is a file an
 * installation may already have applied out of band — a development database synchronised from the
 * entities has both tables and none of this migration's history — and a second run must therefore add
 * nothing rather than fail on the first `CREATE TABLE`. The guard is also what makes the migration
 * safe to replay while a later file of the set is being written.
 *
 * **No primary key is declared twice.** The inherited `id` column already carries one on every dialect:
 * an inline `PRIMARY KEY` on SQLite, and a `PK_<table>_id` constraint on Postgres. A table that also
 * named a `CONSTRAINT … PRIMARY KEY` on SQLite would be refused outright.
 *
 * **The check constraints are Postgres and MySQL only**, as the schema chapter states. Where a dialect
 * cannot declare one the rule is still enforced — by `UnitService` on every write, with the failure
 * carrying `UNIT_CATEGORY_MISMATCH`, `STOCK_UNIT_NOT_REFERENCE` or `UNIT_CATEGORY_NO_REFERENCE`, and
 * re-reported nightly by the measurement audit. A constraint a dialect silently ignores would be worse
 * than a documented service check, because it reads as enforcement and is not.
 */
export class CreateMeasurementTables1791000000155 implements MigrationInterface {
	name = 'CreateMeasurementTables1791000000155';

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
		if (!(await queryRunner.hasTable('unit_category'))) {
			await queryRunner.query(
				`CREATE TABLE "unit_category" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "code" character varying(32) NOT NULL, "name" character varying(64) NOT NULL, "isSystem" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "PK_unit_category_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_created_by_user" ON "unit_category" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_updated_by_user" ON "unit_category" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_deleted_by_user" ON "unit_category" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_is_active" ON "unit_category" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_is_archived" ON "unit_category" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_tenant" ON "unit_category" ("tenantId")`);
			// The machine key is unique per organization among live rows: a soft-deleted family must not keep
			// its code occupied for ever, and a second `MASS` family would make conversion ambiguous.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_category_code" ON "unit_category" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_unit_category_org" ON "unit_category" ("organizationId") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('unit'))) {
			await queryRunner.query(
				`CREATE TABLE "unit" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "categoryId" uuid NOT NULL, "code" character varying(32) NOT NULL, "name" character varying(64) NOT NULL, "symbol" character varying(16), "factor" numeric(24,12) NOT NULL DEFAULT 1, "isReference" boolean NOT NULL DEFAULT false, "decimalPlaces" integer NOT NULL DEFAULT 0, "isSystem" boolean NOT NULL DEFAULT false, "metadata" jsonb, CONSTRAINT "CHK_unit_factor_at_least_one" CHECK ("factor" >= 1), CONSTRAINT "CHK_unit_reference_factor" CHECK (NOT "isReference" OR "factor" = 1), CONSTRAINT "CHK_unit_decimal_places" CHECK ("decimalPlaces" BETWEEN 0 AND 6), CONSTRAINT "FK_unit_category" FOREIGN KEY ("categoryId") REFERENCES "unit_category"("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "PK_unit_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(`CREATE INDEX "IDX_unit_created_by_user" ON "unit" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_updated_by_user" ON "unit" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_deleted_by_user" ON "unit" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_is_active" ON "unit" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_is_archived" ON "unit" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_tenant" ON "unit" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_organization" ON "unit" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_code" ON "unit" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
			);
			// Exactly one unit per family defines its base quantity. `factor = 1` on that unit is what makes
			// a family's arithmetic monotone, and the check constraint above states it.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_reference" ON "unit" ("categoryId") WHERE "isReference" = true AND "deletedAt" IS NULL`
			);
			// The conversion index: one family's units, ordered by factor, is exactly the read every
			// conversion and every pick-list display performs.
			await queryRunner.query(
				`CREATE INDEX "IDX_unit_category" ON "unit" ("categoryId", "factor") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// `unit` first: it carries the foreign key into `unit_category`.
		await queryRunner.query(`DROP TABLE IF EXISTS "unit"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "unit_category"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('unit_category'))) {
			await queryRunner.query(
				`CREATE TABLE "unit_category" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "code" varchar(32) NOT NULL, "name" varchar(64) NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "metadata" text)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_created_by_user" ON "unit_category" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_updated_by_user" ON "unit_category" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_deleted_by_user" ON "unit_category" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_is_active" ON "unit_category" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_is_archived" ON "unit_category" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_category_tenant" ON "unit_category" ("tenantId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_category_code" ON "unit_category" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_unit_category_org" ON "unit_category" ("organizationId") WHERE "deletedAt" IS NULL`
			);
		}

		if (!(await queryRunner.hasTable('unit'))) {
			await queryRunner.query(
				`CREATE TABLE "unit" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "categoryId" varchar NOT NULL, "code" varchar(32) NOT NULL, "name" varchar(64) NOT NULL, "symbol" varchar(16), "factor" numeric(24,12) NOT NULL DEFAULT (1), "isReference" boolean NOT NULL DEFAULT (0), "decimalPlaces" integer NOT NULL DEFAULT (0), "isSystem" boolean NOT NULL DEFAULT (0), "metadata" text, CONSTRAINT "FK_unit_category" FOREIGN KEY ("categoryId") REFERENCES "unit_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
			);
			await queryRunner.query(`CREATE INDEX "IDX_unit_created_by_user" ON "unit" ("createdByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_updated_by_user" ON "unit" ("updatedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_deleted_by_user" ON "unit" ("deletedByUserId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_is_active" ON "unit" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_is_archived" ON "unit" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_tenant" ON "unit" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_unit_organization" ON "unit" ("organizationId")`);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_code" ON "unit" (COALESCE("organizationId", \'00000000-0000-0000-0000-000000000000\'), "code") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_unit_reference" ON "unit" ("categoryId") WHERE "isReference" = true AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_unit_category" ON "unit" ("categoryId", "factor") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// `unit` first: it carries the foreign key into `unit_category`.
		await queryRunner.query(`DROP TABLE IF EXISTS "unit"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "unit_category"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the two partial unique indexes are expressed the documented way:
	 * a **stored generated key column** that is `'0'` while the row is live and the row's own id once it
	 * is deleted, appended to the tuple. Live rows then collide on the key and soft-deleted rows never
	 * do — which is what a `WHERE "deletedAt" IS NULL` predicate accomplishes on the other two dialects.
	 * `unit.isReference` needs a second generated key of the same shape (`'1'` or `NULL`), because a
	 * boolean cannot be a null-guarded tuple member, and the nullable organization scope needs a third,
	 * `organizationKey`, for the reason `CreateSequenceTable1791000000000` sets out: a code that belongs
	 * to no organization was held to no rule at all while the column was named raw. Those columns exist
	 * on MySQL only and are declared by no entity: they are the documented price of a filtered index on
	 * a dialect that has none.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('unit_category'))) {
			await queryRunner.query(
				`CREATE TABLE \`unit_category\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`code\` varchar(32) NOT NULL, \`name\` varchar(64) NOT NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, INDEX \`IDX_unit_category_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_unit_category_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_unit_category_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_unit_category_is_active\` (\`isActive\`), INDEX \`IDX_unit_category_is_archived\` (\`isArchived\`), INDEX \`IDX_unit_category_tenant\` (\`tenantId\`), UNIQUE INDEX \`UQ_unit_category_code\` (\`organizationKey\`, \`code\`, \`deletedKey\`), INDEX \`IDX_unit_category_org\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('unit'))) {
			await queryRunner.query(
				`CREATE TABLE \`unit\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`categoryId\` varchar(36) NOT NULL, \`code\` varchar(32) NOT NULL, \`name\` varchar(64) NOT NULL, \`symbol\` varchar(16) NULL, \`factor\` decimal(24,12) NOT NULL DEFAULT 1, \`isReference\` tinyint NOT NULL DEFAULT 0, \`decimalPlaces\` int NOT NULL DEFAULT 0, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`isReferenceKey\` varchar(1) GENERATED ALWAYS AS (IF(\`isReference\`, '1', NULL)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, \'00000000-0000-0000-0000-000000000000\')) STORED, INDEX \`IDX_unit_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_unit_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_unit_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_unit_is_active\` (\`isActive\`), INDEX \`IDX_unit_is_archived\` (\`isArchived\`), INDEX \`IDX_unit_tenant\` (\`tenantId\`), INDEX \`IDX_unit_organization\` (\`organizationId\`), UNIQUE INDEX \`UQ_unit_code\` (\`organizationKey\`, \`code\`, \`deletedKey\`), UNIQUE INDEX \`UQ_unit_reference\` (\`categoryId\`, \`isReferenceKey\`, \`deletedKey\`), INDEX \`IDX_unit_category\` (\`categoryId\`, \`factor\`), CONSTRAINT \`CHK_unit_factor_at_least_one\` CHECK (\`factor\` >= 1), CONSTRAINT \`CHK_unit_reference_factor\` CHECK (NOT \`isReference\` OR \`factor\` = 1), CONSTRAINT \`CHK_unit_decimal_places\` CHECK (\`decimalPlaces\` BETWEEN 0 AND 6), CONSTRAINT \`FK_unit_category\` FOREIGN KEY (\`categoryId\`) REFERENCES \`unit_category\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`unit\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`unit_category\``);
	}
}
