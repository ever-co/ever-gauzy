import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `tax_rate_part` and adds the columns a part makes expressible.
 *
 * A tax is not one percentage: it is an ordered list of parts, each with a base, a signed share and an
 * optional posting code. One fraction cannot say that a 20 % tax is 5 % federal and 15 % provincial, it
 * cannot carry a reduced base, it cannot state a fixed amount such as an excise or a deposit, and it gives
 * a withholding or a reverse charge nowhere to live. The part is also the unit an accountant reconciles:
 * its own base, its own amount, its own posting code.
 *
 * Three things move with the part and are added here:
 *
 * - `tax_rate.amountType` and `tax_rate.direction`. The first is what tells a deliberate zero rate from a
 *   rate whose amounts live in its parts, and the second is what keeps a sales rate off a supplier bill.
 *   Both are defaulted (`PERCENT`, `SALE`), so every existing rate keeps its exact behaviour;
 * - `tax_line.taxRatePartId`, `.postingKey` and `.quantity`. A part produces a tax line and the line is
 *   where its evidence lands: which part produced the amount, the code the receiving accounting system
 *   posts it under, and the owner's quantity a fixed amount was applied per unit of;
 * - the unique index on the tax line's `(ownerType, ownerId, taxRateId, taxRatePartId)`, which is what
 *   makes "one row per `(owner, rate, part)`" true in the database rather than by convention.
 *
 * **Why the tick is `1791000000145` and not the `1791000000245` the migration plan names.** The plan in
 * `docs/05` §24 allocates each package a twenty-tick sub-range and this file the tick after the tables it
 * extends, and the tax set shipped at `1791000000140`/`1791000000150` rather than at the plan's
 * `…240`/`…250`. Renumbering an applied migration is forbidden, so the revision takes the **next free tick
 * of this package's own sub-range**, `1791000000145`, which keeps the file in exactly the position the plan
 * intends: after `CreateTaxTables` and before `AddTaxCategoryForeignKeys`.
 *
 * **The kernel owns `tax_line`, and this set still adds its columns.** The ledger belongs to the kernel, so
 * the columns a part produces are declared there and created here, and the constraint they carry is added
 * by the set that creates its target — which is this one, because `tax_rate_part` is created above. The
 * same rule is why `tax_line.taxRegimeId` arrives with `CreateTaxRegimeTables1791000000146` and carries no
 * constraint at all: it is a snapshot, so a regime reaching its retention date can never block or rewrite a
 * document's tax evidence.
 *
 * **Dialect notes, each of which is a difference rather than a convenience:**
 *
 * - Every added column is nullable or carries a constant default, which is the shape SQLite supports
 *   without rebuilding a table, and each `ADD COLUMN` is guarded by `hasColumn` so a second run of this
 *   migration adds nothing. No table this package does not own is rebuilt: a copy taken from a plugin would
 *   drift from the kernel's own definition, which is the rule `AddTaxCategoryForeignKeys1791000000150`
 *   already states for the same two tables.
 * - The three check constraints of a part are declared where the table is created, on Postgres and MySQL
 *   only. On SQLite the rules they carry are the service checks plus the nightly `schema-uniqueness-audit`,
 *   exactly as §1.7 of the schema specification provides for a rule the dialect cannot express.
 * - SQLite and Postgres both support a filtered index and `IF NOT EXISTS`; MySQL has neither, so its
 *   uniqueness falls back to the service plus the audit, and each index is created only when
 *   `information_schema` says it is absent.
 */
export class CreateTaxRatePartTable1791000000145 implements MigrationInterface {
	name = 'CreateTaxRatePartTable1791000000145';

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
			`CREATE TABLE IF NOT EXISTS "tax_rate_part" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "taxRateId" uuid NOT NULL, "sequence" integer NOT NULL DEFAULT 1, "partType" character varying(16) NOT NULL DEFAULT 'TAX', "factorPercent" numeric(9,6) NOT NULL DEFAULT 100, "baseFactor" numeric(9,6) NOT NULL DEFAULT 1, "amountType" character varying(16) NOT NULL DEFAULT 'PERCENT', "fixedAmount" numeric(20,6), "fixedCurrency" character varying(3), "postingKey" character varying(64), "label" character varying(255), "metadata" jsonb, CONSTRAINT "CHK_tax_rate_part_factor_nonzero" CHECK ("factorPercent" <> 0), CONSTRAINT "CHK_tax_rate_part_basefactor_pos" CHECK ("baseFactor" > 0), CONSTRAINT "CHK_tax_rate_part_fixed_currency" CHECK (("amountType" = 'FIXED') = ("fixedAmount" IS NOT NULL AND "fixedCurrency" IS NOT NULL)), CONSTRAINT "PK_tax_rate_part_id" PRIMARY KEY ("id"))`
		);
		for (const statement of this.partIndexes('postgres')) {
			await queryRunner.query(statement);
		}
		// A part has no meaning without its rate.
		await queryRunner.query(
			`ALTER TABLE "tax_rate_part" ADD CONSTRAINT "FK_tax_rate_part_tax_rate" FOREIGN KEY ("taxRateId") REFERENCES "tax_rate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.postgresAddTaxRateColumns(queryRunner);
		await this.postgresAddTaxLineColumns(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.postgresRemoveTaxLineColumns(queryRunner);
		await this.postgresRemoveTaxRateColumns(queryRunner);

		await queryRunner.query(`ALTER TABLE "tax_rate_part" DROP CONSTRAINT "FK_tax_rate_part_tax_rate"`);
		await queryRunner.query(`DROP TABLE "tax_rate_part"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "tax_rate_part" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "taxRateId" varchar NOT NULL, "sequence" integer NOT NULL DEFAULT (1), "partType" varchar(16) NOT NULL DEFAULT ('TAX'), "factorPercent" numeric(9,6) NOT NULL DEFAULT (100), "baseFactor" numeric(9,6) NOT NULL DEFAULT (1), "amountType" varchar(16) NOT NULL DEFAULT ('PERCENT'), "fixedAmount" numeric(20,6), "fixedCurrency" varchar(3), "postingKey" varchar(64), "label" varchar(255), "metadata" text, CONSTRAINT "FK_tax_rate_part_tax_rate" FOREIGN KEY ("taxRateId") REFERENCES "tax_rate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		for (const statement of this.partIndexes('sqlite')) {
			await queryRunner.query(statement);
		}

		await this.sqliteAddTaxRateColumns(queryRunner);
		await this.sqliteAddTaxLineColumns(queryRunner);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.sqliteRemoveTaxLineColumns(queryRunner);
		await this.sqliteRemoveTaxRateColumns(queryRunner);

		await queryRunner.query(`DROP TABLE "tax_rate_part"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`tax_rate_part\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`taxRateId\` varchar(36) NOT NULL, \`sequence\` int NOT NULL DEFAULT 1, \`partType\` varchar(16) NOT NULL DEFAULT 'TAX', \`factorPercent\` decimal(9,6) NOT NULL DEFAULT 100, \`baseFactor\` decimal(9,6) NOT NULL DEFAULT 1, \`amountType\` varchar(16) NOT NULL DEFAULT 'PERCENT', \`fixedAmount\` decimal(20,6) NULL, \`fixedCurrency\` varchar(3) NULL, \`postingKey\` varchar(64) NULL, \`label\` varchar(255) NULL, \`metadata\` json NULL, CONSTRAINT \`CHK_tax_rate_part_factor_nonzero\` CHECK (\`factorPercent\` <> 0), CONSTRAINT \`CHK_tax_rate_part_basefactor_pos\` CHECK (\`baseFactor\` > 0), CONSTRAINT \`CHK_tax_rate_part_fixed_currency\` CHECK ((\`amountType\` = 'FIXED') = (\`fixedAmount\` IS NOT NULL AND \`fixedCurrency\` IS NOT NULL)), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		for (const statement of this.partIndexes('mysql')) {
			if (await this.hasIndex(queryRunner, this.indexNameOf(statement))) {
				continue;
			}

			await queryRunner.query(statement);
		}
		await queryRunner.query(
			`ALTER TABLE \`tax_rate_part\` ADD CONSTRAINT \`FK_tax_rate_part_tax_rate\` FOREIGN KEY (\`taxRateId\`) REFERENCES \`tax_rate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.mysqlAddTaxRateColumns(queryRunner);
		await this.mysqlAddTaxLineColumns(queryRunner);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.mysqlRemoveTaxLineColumns(queryRunner);
		await this.mysqlRemoveTaxRateColumns(queryRunner);

		await queryRunner.query(`ALTER TABLE \`tax_rate_part\` DROP FOREIGN KEY \`FK_tax_rate_part_tax_rate\``);
		await queryRunner.query(`DROP TABLE \`tax_rate_part\``);
	}

	/*
	|--------------------------------------------------------------------------
	| Postgres
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the arithmetic and the direction to `tax_rate`, and the part's evidence to `tax_line`.
	 *
	 * @param queryRunner The query runner.
	 */
	private async postgresAddTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_rate', 'amountType'))) {
			await queryRunner.query(
				`ALTER TABLE "tax_rate" ADD COLUMN "amountType" character varying(16) NOT NULL DEFAULT 'PERCENT'`
			);
		}
		if (!(await queryRunner.hasColumn('tax_rate', 'direction'))) {
			await queryRunner.query(
				`ALTER TABLE "tax_rate" ADD COLUMN "direction" character varying(16) NOT NULL DEFAULT 'SALE'`
			);
		}

		// The direction is what the purchase path filters on, and the code-at-an-instant overlap check reads
		// the tuple that starts with the organization and the code.
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_org_direction" ON "tax_rate" ("organizationId", "direction") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_org_code" ON "tax_rate" ("organizationId", "code", "direction") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async postgresRemoveTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rate_org_code"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rate_org_direction"`);

		if (await queryRunner.hasColumn('tax_rate', 'direction')) {
			await queryRunner.query(`ALTER TABLE "tax_rate" DROP COLUMN "direction"`);
		}
		if (await queryRunner.hasColumn('tax_rate', 'amountType')) {
			await queryRunner.query(`ALTER TABLE "tax_rate" DROP COLUMN "amountType"`);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async postgresAddTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_line', 'taxRatePartId'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "taxRatePartId" uuid`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'postingKey'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "postingKey" character varying(64)`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'quantity'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "quantity" numeric(20,6) NOT NULL DEFAULT 1`);
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_line_part" ON "tax_line" ("taxRatePartId") WHERE "taxRatePartId" IS NOT NULL`
		);
		// One row per `(owner, rate, part)`: the rule the tax specification states and the table never had. A
		// null rate or part — a legacy rate, an external engine, an exemption — cannot be constrained portably,
		// so those rows stay a service rule, exactly as §1.7 of the schema specification provides.
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_line_owner_rate_part" ON "tax_line" ("ownerType", "ownerId", "taxRateId", "taxRatePartId") WHERE "deletedAt" IS NULL`
		);

		if (!(await this.hasForeignKey(queryRunner, 'tax_line', 'FK_tax_line_tax_rate_part'))) {
			// The part a tax line snapshots. `SET NULL` (bucket 4): the line keeps its base, its amount and its
			// posting code, and losing the part row must not take the tax evidence with it.
			await queryRunner.query(
				`ALTER TABLE "tax_line" ADD CONSTRAINT "FK_tax_line_tax_rate_part" FOREIGN KEY ("taxRatePartId") REFERENCES "tax_rate_part"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async postgresRemoveTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasForeignKey(queryRunner, 'tax_line', 'FK_tax_line_tax_rate_part')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP CONSTRAINT "FK_tax_line_tax_rate_part"`);
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tax_line_owner_rate_part"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_line_part"`);

		if (await queryRunner.hasColumn('tax_line', 'quantity')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "quantity"`);
		}
		if (await queryRunner.hasColumn('tax_line', 'postingKey')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "postingKey"`);
		}
		if (await queryRunner.hasColumn('tax_line', 'taxRatePartId')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "taxRatePartId"`);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| SQLite
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param queryRunner The query runner.
	 */
	private async sqliteAddTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_rate', 'amountType'))) {
			await queryRunner.query(
				`ALTER TABLE "tax_rate" ADD COLUMN "amountType" varchar(16) NOT NULL DEFAULT ('PERCENT')`
			);
		}
		if (!(await queryRunner.hasColumn('tax_rate', 'direction'))) {
			await queryRunner.query(
				`ALTER TABLE "tax_rate" ADD COLUMN "direction" varchar(16) NOT NULL DEFAULT ('SALE')`
			);
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_org_direction" ON "tax_rate" ("organizationId", "direction") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_org_code" ON "tax_rate" ("organizationId", "code", "direction") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async sqliteRemoveTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rate_org_code"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_rate_org_direction"`);

		if (await queryRunner.hasColumn('tax_rate', 'direction')) {
			await queryRunner.query(`ALTER TABLE "tax_rate" DROP COLUMN "direction"`);
		}
		if (await queryRunner.hasColumn('tax_rate', 'amountType')) {
			await queryRunner.query(`ALTER TABLE "tax_rate" DROP COLUMN "amountType"`);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async sqliteAddTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_line', 'taxRatePartId'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "taxRatePartId" varchar`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'postingKey'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "postingKey" varchar(64)`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'quantity'))) {
			await queryRunner.query(`ALTER TABLE "tax_line" ADD COLUMN "quantity" numeric(20,6) NOT NULL DEFAULT (1)`);
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_tax_line_part" ON "tax_line" ("taxRatePartId") WHERE "taxRatePartId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_line_owner_rate_part" ON "tax_line" ("ownerType", "ownerId", "taxRateId", "taxRatePartId") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async sqliteRemoveTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tax_line_owner_rate_part"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tax_line_part"`);

		if (await queryRunner.hasColumn('tax_line', 'quantity')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "quantity"`);
		}
		if (await queryRunner.hasColumn('tax_line', 'postingKey')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "postingKey"`);
		}
		if (await queryRunner.hasColumn('tax_line', 'taxRatePartId')) {
			await queryRunner.query(`ALTER TABLE "tax_line" DROP COLUMN "taxRatePartId"`);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| MySQL
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param queryRunner The query runner.
	 */
	private async mysqlAddTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_rate', 'amountType'))) {
			await queryRunner.query(`ALTER TABLE \`tax_rate\` ADD COLUMN \`amountType\` varchar(16) NOT NULL DEFAULT 'PERCENT'`);
		}
		if (!(await queryRunner.hasColumn('tax_rate', 'direction'))) {
			await queryRunner.query(`ALTER TABLE \`tax_rate\` ADD COLUMN \`direction\` varchar(16) NOT NULL DEFAULT 'SALE'`);
		}

		if (!(await this.hasIndex(queryRunner, 'IDX_tax_rate_org_direction'))) {
			await queryRunner.query(
				`CREATE INDEX \`IDX_tax_rate_org_direction\` ON \`tax_rate\` (\`organizationId\`, \`direction\`)`
			);
		}
		if (!(await this.hasIndex(queryRunner, 'IDX_tax_rate_org_code'))) {
			await queryRunner.query(
				`CREATE INDEX \`IDX_tax_rate_org_code\` ON \`tax_rate\` (\`organizationId\`, \`code\`, \`direction\`)`
			);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async mysqlRemoveTaxRateColumns(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasIndex(queryRunner, 'IDX_tax_rate_org_code')) {
			await queryRunner.query(`DROP INDEX \`IDX_tax_rate_org_code\` ON \`tax_rate\``);
		}
		if (await this.hasIndex(queryRunner, 'IDX_tax_rate_org_direction')) {
			await queryRunner.query(`DROP INDEX \`IDX_tax_rate_org_direction\` ON \`tax_rate\``);
		}

		if (await queryRunner.hasColumn('tax_rate', 'direction')) {
			await queryRunner.query(`ALTER TABLE \`tax_rate\` DROP COLUMN \`direction\``);
		}
		if (await queryRunner.hasColumn('tax_rate', 'amountType')) {
			await queryRunner.query(`ALTER TABLE \`tax_rate\` DROP COLUMN \`amountType\``);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async mysqlAddTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_line', 'taxRatePartId'))) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` ADD COLUMN \`taxRatePartId\` varchar(36)`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'postingKey'))) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` ADD COLUMN \`postingKey\` varchar(64)`);
		}
		if (!(await queryRunner.hasColumn('tax_line', 'quantity'))) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` ADD COLUMN \`quantity\` decimal(20,6) NOT NULL DEFAULT 1`);
		}

		if (!(await this.hasIndex(queryRunner, 'IDX_tax_line_part'))) {
			await queryRunner.query(`CREATE INDEX \`IDX_tax_line_part\` ON \`tax_line\` (\`taxRatePartId\`)`);
		}
		// MySQL has no filtered index and treats nulls as distinct, so the tuple cannot be enforced there by an
		// index at all: the service writes one row per `(owner, rate, part)` inside the transaction that
		// computes it, and the nightly `schema-uniqueness-audit` reports any row that escaped the rule.
		if (!(await this.hasIndex(queryRunner, 'UQ_tax_line_owner_rate_part'))) {
			await queryRunner.query(
				`CREATE INDEX \`UQ_tax_line_owner_rate_part\` ON \`tax_line\` (\`ownerType\`, \`ownerId\`, \`taxRateId\`)`
			);
		}

		if (!(await this.hasForeignKey(queryRunner, 'tax_line', 'FK_tax_line_tax_rate_part'))) {
			await queryRunner.query(
				`ALTER TABLE \`tax_line\` ADD CONSTRAINT \`FK_tax_line_tax_rate_part\` FOREIGN KEY (\`taxRatePartId\`) REFERENCES \`tax_rate_part\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 */
	private async mysqlRemoveTaxLineColumns(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasForeignKey(queryRunner, 'tax_line', 'FK_tax_line_tax_rate_part')) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` DROP FOREIGN KEY \`FK_tax_line_tax_rate_part\``);
		}

		if (await this.hasIndex(queryRunner, 'UQ_tax_line_owner_rate_part')) {
			await queryRunner.query(`DROP INDEX \`UQ_tax_line_owner_rate_part\` ON \`tax_line\``);
		}
		if (await this.hasIndex(queryRunner, 'IDX_tax_line_part')) {
			await queryRunner.query(`DROP INDEX \`IDX_tax_line_part\` ON \`tax_line\``);
		}

		if (await queryRunner.hasColumn('tax_line', 'quantity')) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` DROP COLUMN \`quantity\``);
		}
		if (await queryRunner.hasColumn('tax_line', 'postingKey')) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` DROP COLUMN \`postingKey\``);
		}
		if (await queryRunner.hasColumn('tax_line', 'taxRatePartId')) {
			await queryRunner.query(`ALTER TABLE \`tax_line\` DROP COLUMN \`taxRatePartId\``);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| The part table's own indexes
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param dialect The dialect the body is running on.
	 * @returns The seven base-class indexes and the two domain indexes of `tax_rate_part`, each in the
	 * dialect's own syntax.
	 */
	private partIndexes(dialect: string): string[] {
		if (dialect === 'mysql') {
			return [
				`CREATE INDEX \`IDX_tax_rate_part_created_by_user\` ON \`tax_rate_part\` (\`createdByUserId\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_updated_by_user\` ON \`tax_rate_part\` (\`updatedByUserId\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_deleted_by_user\` ON \`tax_rate_part\` (\`deletedByUserId\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_is_active\` ON \`tax_rate_part\` (\`isActive\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_is_archived\` ON \`tax_rate_part\` (\`isArchived\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_tenant\` ON \`tax_rate_part\` (\`tenantId\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_organization\` ON \`tax_rate_part\` (\`organizationId\`)`,
				// MySQL has no filtered index, so the uniqueness of a part's position is the service check plus
				// the nightly `schema-uniqueness-audit`, exactly as §1.7 of the schema specification provides.
				`CREATE INDEX \`UQ_tax_rate_part_seq\` ON \`tax_rate_part\` (\`taxRateId\`, \`sequence\`)`,
				`CREATE INDEX \`IDX_tax_rate_part_rate\` ON \`tax_rate_part\` (\`taxRateId\`)`
			];
		}

		return [
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_created_by_user" ON "tax_rate_part" ("createdByUserId")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_updated_by_user" ON "tax_rate_part" ("updatedByUserId")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_deleted_by_user" ON "tax_rate_part" ("deletedByUserId")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_is_active" ON "tax_rate_part" ("isActive")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_is_archived" ON "tax_rate_part" ("isArchived")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_tenant" ON "tax_rate_part" ("tenantId")`,
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_organization" ON "tax_rate_part" ("organizationId")`,
			// A part is applied at one position of its rate, so the order the arithmetic runs in is defined.
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_rate_part_seq" ON "tax_rate_part" ("taxRateId", "sequence") WHERE "deletedAt" IS NULL`,
			// The parts of one rate, which is every read of a breakdown.
			`CREATE INDEX IF NOT EXISTS "IDX_tax_rate_part_rate" ON "tax_rate_part" ("taxRateId") WHERE "deletedAt" IS NULL`
		];
	}

	/**
	 * @param statement A MySQL index statement.
	 * @returns The name the statement creates.
	 */
	private indexNameOf(statement: string): string {
		return /INDEX `([^`]+)`/.exec(statement)?.[1] ?? '';
	}

	/**
	 * @param queryRunner The query runner.
	 * @param name The index name.
	 * @returns Whether an index of that name exists on this database.
	 */
	private async hasIndex(queryRunner: QueryRunner, name: string): Promise<boolean> {
		const rows: Array<{ count?: string | number }> = await queryRunner.query(
			`SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = ?`,
			[name]
		);

		return Number(rows?.[0]?.count ?? 0) > 0;
	}

	/**
	 * @param queryRunner The query runner.
	 * @param table The table the constraint would sit on.
	 * @param name The constraint name.
	 * @returns Whether a foreign key of that name exists on this database.
	 */
	private async hasForeignKey(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
		const mysql = (queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.mysql;
		const rows: Array<{ count?: string | number }> = mysql
			? await queryRunner.query(
					`SELECT COUNT(*) AS count FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
					[table, name]
			  )
			: await queryRunner.query(
					`SELECT COUNT(*) AS count FROM information_schema.table_constraints WHERE table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
					[table, name]
			  );

		return Number(rows?.[0]?.count ?? 0) > 0;
	}
}
