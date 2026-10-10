import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One index of one of the two tables this migration creates.
 */
interface ITaxIndex {
	/** The index name. */
	name: string;
	/** The table it sits on. */
	table: string;
	/** Its columns, in order. */
	columns: string[];
	/** Whether the tuple is unique. */
	unique?: boolean;
	/** Whether the index covers the rows that are not soft-deleted, which is every domain index here. */
	live?: boolean;
}

/**
 * Creates `tax_regime` and `tax_regime_rate`, and adds the regime snapshot to `tax_line`.
 *
 * This is the one mechanism that lets a product priced once be sold legally in many jurisdictions: the
 * same catalogue line is taxed to a private domestic buyer, zero-rated plus reverse charge to a business
 * that states a registration number, split into state, county and city taxes to a buyer in a nexus state,
 * and zero on export. A category changes **which single rate wins**; it cannot add a tax, cannot remove a
 * domestic one, cannot be conditioned on the buyer's registration status and cannot be triggered by the
 * destination independently of the party. A rule only ever narrows a candidate set. A regime swaps it.
 *
 * `tax_regime_rate` is the membership pivot, and the rule the design turns on is one sentence: a rate with
 * **no** membership row is general and always a candidate, and a rate with **at least one** row is a
 * candidate only when one of its regimes is the selected one. The absence of a row is therefore a
 * deliberate statement, and it is why every rate written before this table keeps its exact behaviour.
 *
 * Three columns close the loop and are added here:
 *
 * - `tax_line.taxRegimeId`, the snapshot of the set a document was taxed under. **No foreign key**: a
 *   regime that reaches its retention date must never block or rewrite a document's tax evidence, and this
 *   is the first question a tax authority asks;
 * - `organization_contact.taxRegimeId` and `organization_vendor.taxRegimeId`, the manual party overrides.
 *   Both are columns the kernel creates (the party extension and the supplier extension) and neither
 *   carries its constraint there, because a kernel migration never waits for a plugin to be installed. This
 *   set creates their target, so this is the migration that constrains them, and each is added only when
 *   the column is present — an installation that has not applied the kernel's alteration yet still gets the
 *   regime tables rather than a failure.
 *
 * **Why the tick is `1791000000146`.** The plan in `docs/05` §24 names `1791000000246` for this file, and
 * the tax set shipped at `1791000000140`/`1791000000150`. Renumbering an applied migration is forbidden,
 * so the revision takes the next free tick of this package's own sub-range, which keeps the file where the
 * plan puts it: after `CreateTaxRatePartTable` and before `AddTaxCategoryForeignKeys`.
 */
export class CreateTaxRegimeTables1791000000146 implements MigrationInterface {
	name = 'CreateTaxRegimeTables1791000000146';

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
			`CREATE TABLE IF NOT EXISTS "tax_regime" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "code" character varying(64) NOT NULL, "priority" integer NOT NULL DEFAULT 0, "regionId" uuid, "countryCode" character varying(2), "provinceCode" character varying(16), "postalCodePattern" character varying(64), "requiresPartyTaxRegistration" boolean NOT NULL DEFAULT false, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "description" character varying(255), "metadata" jsonb, CONSTRAINT "PK_tax_regime_id" PRIMARY KEY ("id"))`
		);
		await this.createRegimeIndexes(queryRunner, 'postgres');
		// A regime survives the deletion of the region it names: the destination a document carries is
		// snapshotted, and losing the region must not silently widen the regime to every destination.
		await queryRunner.query(
			`ALTER TABLE "tax_regime" ADD CONSTRAINT "FK_tax_regime_region" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "tax_regime_rate" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "taxRegimeId" uuid NOT NULL, "taxRateId" uuid NOT NULL, CONSTRAINT "PK_tax_regime_rate_id" PRIMARY KEY ("id"))`
		);
		await this.createRegimeRateIndexes(queryRunner, 'postgres');
		await queryRunner.query(
			`ALTER TABLE "tax_regime_rate" ADD CONSTRAINT "FK_tax_regime_rate_tax_regime" FOREIGN KEY ("taxRegimeId") REFERENCES "tax_regime"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tax_regime_rate" ADD CONSTRAINT "FK_tax_regime_rate_tax_rate" FOREIGN KEY ("taxRateId") REFERENCES "tax_rate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.addTaxLineRegimeColumn(queryRunner, 'postgres');
		await this.addPartyRegimeConstraints(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removePartyRegimeConstraints(queryRunner, 'postgres');
		await this.removeTaxLineRegimeColumn(queryRunner, 'postgres');

		await queryRunner.query(`ALTER TABLE "tax_regime_rate" DROP CONSTRAINT "FK_tax_regime_rate_tax_rate"`);
		await queryRunner.query(`ALTER TABLE "tax_regime_rate" DROP CONSTRAINT "FK_tax_regime_rate_tax_regime"`);
		await queryRunner.query(`DROP TABLE "tax_regime_rate"`);

		await queryRunner.query(`ALTER TABLE "tax_regime" DROP CONSTRAINT "FK_tax_regime_region"`);
		await queryRunner.query(`DROP TABLE "tax_regime"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite expresses a foreign key when a table is created and never afterwards, so the two party
	 * overrides carry no constraint on this dialect. Rebuilding `organization_contact` or
	 * `organization_vendor` from a plugin migration is not an option — the columns are the kernel's and a
	 * copy taken here would drift from them — so the rule is the service check, exactly as
	 * `AddTaxCategoryForeignKeys1791000000150` states for the same two tables. SQLite does not enforce
	 * foreign keys unless `PRAGMA foreign_keys` is on, so nothing that is enforced elsewhere is lost here.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "tax_regime" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "code" varchar(64) NOT NULL, "priority" integer NOT NULL DEFAULT (0), "regionId" varchar, "countryCode" varchar(2), "provinceCode" varchar(16), "postalCodePattern" varchar(64), "requiresPartyTaxRegistration" boolean NOT NULL DEFAULT (0), "startsAt" datetime, "endsAt" datetime, "description" varchar(255), "metadata" text, CONSTRAINT "FK_tax_regime_region" FOREIGN KEY ("regionId") REFERENCES "region" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await this.createRegimeIndexes(queryRunner, 'sqlite');
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "tax_regime_rate" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "taxRegimeId" varchar NOT NULL, "taxRateId" varchar NOT NULL, CONSTRAINT "FK_tax_regime_rate_tax_regime" FOREIGN KEY ("taxRegimeId") REFERENCES "tax_regime" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tax_regime_rate_tax_rate" FOREIGN KEY ("taxRateId") REFERENCES "tax_rate" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await this.createRegimeRateIndexes(queryRunner, 'sqlite');

		await this.addTaxLineRegimeColumn(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removeTaxLineRegimeColumn(queryRunner, 'sqlite');

		await queryRunner.query(`DROP TABLE "tax_regime_rate"`);
		await queryRunner.query(`DROP TABLE "tax_regime"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the three uniqueness rules of the pair — one regime per code inside an
	 * organization, one membership per `(regime, rate)`, and no rate selected twice — are enforced by the
	 * service inside the writing transaction and re-verified by the nightly `tax-regime-audit`, which is the
	 * fallback §1.7 of the schema specification provides for a predicate a dialect cannot express.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`tax_regime\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(64) NOT NULL, \`priority\` int NOT NULL DEFAULT 0, \`regionId\` varchar(36) NULL, \`countryCode\` varchar(2) NULL, \`provinceCode\` varchar(16) NULL, \`postalCodePattern\` varchar(64) NULL, \`requiresPartyTaxRegistration\` tinyint NOT NULL DEFAULT 0, \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`description\` varchar(255) NULL, \`metadata\` json NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await this.createRegimeIndexes(queryRunner, 'mysql');
		await queryRunner.query(
			`ALTER TABLE \`tax_regime\` ADD CONSTRAINT \`FK_tax_regime_region\` FOREIGN KEY (\`regionId\`) REFERENCES \`region\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`tax_regime_rate\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`taxRegimeId\` varchar(36) NOT NULL, \`taxRateId\` varchar(36) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await this.createRegimeRateIndexes(queryRunner, 'mysql');
		await queryRunner.query(
			`ALTER TABLE \`tax_regime_rate\` ADD CONSTRAINT \`FK_tax_regime_rate_tax_regime\` FOREIGN KEY (\`taxRegimeId\`) REFERENCES \`tax_regime\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tax_regime_rate\` ADD CONSTRAINT \`FK_tax_regime_rate_tax_rate\` FOREIGN KEY (\`taxRateId\`) REFERENCES \`tax_rate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await this.addTaxLineRegimeColumn(queryRunner, 'mysql');
		await this.addPartyRegimeConstraints(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.removePartyRegimeConstraints(queryRunner, 'mysql');
		await this.removeTaxLineRegimeColumn(queryRunner, 'mysql');

		await queryRunner.query(`ALTER TABLE \`tax_regime_rate\` DROP FOREIGN KEY \`FK_tax_regime_rate_tax_rate\``);
		await queryRunner.query(`ALTER TABLE \`tax_regime_rate\` DROP FOREIGN KEY \`FK_tax_regime_rate_tax_regime\``);
		await queryRunner.query(`DROP TABLE \`tax_regime_rate\``);

		await queryRunner.query(`ALTER TABLE \`tax_regime\` DROP FOREIGN KEY \`FK_tax_regime_region\``);
		await queryRunner.query(`DROP TABLE \`tax_regime\``);
	}

	/*
	|--------------------------------------------------------------------------
	| Indexes
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates the seven base-class indexes and the three domain indexes of `tax_regime`.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async createRegimeIndexes(queryRunner: QueryRunner, dialect: string): Promise<void> {
		for (const index of this.regimeIndexes()) {
			await this.createIndexIfAbsent(queryRunner, dialect, index);
		}
	}

	/**
	 * Creates the seven base-class indexes and the two domain indexes of `tax_regime_rate`.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async createRegimeRateIndexes(queryRunner: QueryRunner, dialect: string): Promise<void> {
		for (const index of this.regimeRateIndexes()) {
			await this.createIndexIfAbsent(queryRunner, dialect, index);
		}
	}

	/**
	 * @returns The indexes of `tax_regime`: the base-class seven plus the code, the destination match and
	 * the window.
	 */
	private regimeIndexes(): ITaxIndex[] {
		return [
			{ name: 'IDX_tax_regime_created_by_user', table: 'tax_regime', columns: ['createdByUserId'] },
			{ name: 'IDX_tax_regime_updated_by_user', table: 'tax_regime', columns: ['updatedByUserId'] },
			{ name: 'IDX_tax_regime_deleted_by_user', table: 'tax_regime', columns: ['deletedByUserId'] },
			{ name: 'IDX_tax_regime_is_active', table: 'tax_regime', columns: ['isActive'] },
			{ name: 'IDX_tax_regime_is_archived', table: 'tax_regime', columns: ['isArchived'] },
			{ name: 'IDX_tax_regime_tenant', table: 'tax_regime', columns: ['tenantId'] },
			{ name: 'IDX_tax_regime_organization', table: 'tax_regime', columns: ['organizationId'] },
			// A code is unique inside an organization among the regimes that are not soft-deleted.
			{
				name: 'UQ_tax_regime_org_code',
				table: 'tax_regime',
				columns: ['organizationId', 'code'],
				unique: true,
				live: true
			},
			// The destination match, which is what selecting a regime for a document reads.
			{
				name: 'IDX_tax_regime_match',
				table: 'tax_regime',
				columns: ['organizationId', 'countryCode', 'provinceCode', 'priority'],
				live: true
			},
			// The window scan, which is what makes a regime live or not.
			{ name: 'IDX_tax_regime_window', table: 'tax_regime', columns: ['startsAt', 'endsAt'], live: true }
		];
	}

	/**
	 * @returns The indexes of `tax_regime_rate`: the base-class seven plus the membership tuple and the
	 * membership of one rate.
	 */
	private regimeRateIndexes(): ITaxIndex[] {
		return [
			{ name: 'IDX_tax_regime_rate_created_by_user', table: 'tax_regime_rate', columns: ['createdByUserId'] },
			{ name: 'IDX_tax_regime_rate_updated_by_user', table: 'tax_regime_rate', columns: ['updatedByUserId'] },
			{ name: 'IDX_tax_regime_rate_deleted_by_user', table: 'tax_regime_rate', columns: ['deletedByUserId'] },
			{ name: 'IDX_tax_regime_rate_is_active', table: 'tax_regime_rate', columns: ['isActive'] },
			{ name: 'IDX_tax_regime_rate_is_archived', table: 'tax_regime_rate', columns: ['isArchived'] },
			{ name: 'IDX_tax_regime_rate_tenant', table: 'tax_regime_rate', columns: ['tenantId'] },
			{ name: 'IDX_tax_regime_rate_organization', table: 'tax_regime_rate', columns: ['organizationId'] },
			// A rate belongs to a regime once.
			{
				name: 'UQ_tax_regime_rate',
				table: 'tax_regime_rate',
				columns: ['taxRegimeId', 'taxRateId'],
				unique: true,
				live: true
			},
			// The membership of a rate, which is what the resolution reads to decide whether it is general.
			{ name: 'IDX_tax_regime_rate_rate', table: 'tax_regime_rate', columns: ['taxRateId'] }
		];
	}

	/**
	 * Creates one index unless it is already there.
	 *
	 * Postgres and SQLite carry the soft-delete predicate of a domain index and skip an index that already
	 * exists; MySQL has neither a filtered index nor `IF NOT EXISTS` for an index, so there the statement is
	 * a plain index and its uniqueness is the service check plus the nightly audit, which is the fallback
	 * §1.7 of the schema specification provides. The base-class indexes are created without the predicate,
	 * exactly as the shipped migration of this set creates them.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 * @param index The index to create.
	 */
	private async createIndexIfAbsent(queryRunner: QueryRunner, dialect: string, index: ITaxIndex): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner, index.name)) {
				return;
			}

			await queryRunner.query(
				`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX \`${index.name}\` ON \`${index.table}\` (${index.columns
					.map((column) => `\`${column}\``)
					.join(', ')})`
			);

			return;
		}

		const leading = index.columns.map((column) => `"${column}"`).join(', ');
		const predicate = index.live ? ` WHERE "deletedAt" IS NULL` : '';

		await queryRunner.query(
			`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${index.table}" (${leading})${predicate}`
		);
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

	/*
	|--------------------------------------------------------------------------
	| The regime snapshot and the party overrides
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the regime snapshot to `tax_line`.
	 *
	 * No foreign key, and that is the point: the snapshot is evidence, so a regime that reaches its
	 * retention date can never block or rewrite what a document was taxed under.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async addTaxLineRegimeColumn(queryRunner: QueryRunner, dialect: string): Promise<void> {
		if (await queryRunner.hasColumn('tax_line', 'taxRegimeId')) {
			return;
		}

		await queryRunner.query(
			dialect === 'postgres'
				? `ALTER TABLE "tax_line" ADD COLUMN "taxRegimeId" uuid`
				: dialect === 'mysql'
				? `ALTER TABLE \`tax_line\` ADD COLUMN \`taxRegimeId\` varchar(36)`
				: `ALTER TABLE "tax_line" ADD COLUMN "taxRegimeId" varchar`
		);
	}

	/**
	 * Removes the regime snapshot from `tax_line`.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async removeTaxLineRegimeColumn(queryRunner: QueryRunner, dialect: string): Promise<void> {
		if (!(await queryRunner.hasColumn('tax_line', 'taxRegimeId'))) {
			return;
		}

		await queryRunner.query(
			dialect === 'mysql'
				? `ALTER TABLE \`tax_line\` DROP COLUMN \`taxRegimeId\``
				: `ALTER TABLE "tax_line" DROP COLUMN "taxRegimeId"`
		);
	}

	/**
	 * Constrains the two party overrides onto `tax_regime`, each only when its column exists.
	 *
	 * The columns belong to the kernel's party and supplier extensions and are created without their
	 * constraint there; this set creates the target. A column that is not present is skipped rather than
	 * failed on, because the order the two sets are installed in is not a reason to leave a package
	 * uninstallable.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async addPartyRegimeConstraints(queryRunner: QueryRunner, dialect: string): Promise<void> {
		if (dialect === 'sqlite') {
			// SQLite declares a foreign key when a table is created and never afterwards, and rebuilding a core
			// table from a plugin migration would drift from the kernel's own definition. The two overrides are
			// therefore unconstrained here and the rule is the service check, exactly as the tax category
			// constraints already are on this dialect.
			return;
		}

		if (await queryRunner.hasColumn('organization_contact', 'taxRegimeId')) {
			if (!(await this.hasForeignKey(queryRunner, 'organization_contact', 'FK_organization_contact_tax_regime'))) {
				await queryRunner.query(
					dialect === 'mysql'
						? `ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_organization_contact_tax_regime\` FOREIGN KEY (\`taxRegimeId\`) REFERENCES \`tax_regime\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
						: `ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_organization_contact_tax_regime" FOREIGN KEY ("taxRegimeId") REFERENCES "tax_regime"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
				);
			}
		}

		if (await queryRunner.hasColumn('organization_vendor', 'taxRegimeId')) {
			if (!(await this.hasForeignKey(queryRunner, 'organization_vendor', 'FK_organization_vendor_tax_regime'))) {
				await queryRunner.query(
					dialect === 'mysql'
						? `ALTER TABLE \`organization_vendor\` ADD CONSTRAINT \`FK_organization_vendor_tax_regime\` FOREIGN KEY (\`taxRegimeId\`) REFERENCES \`tax_regime\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
						: `ALTER TABLE "organization_vendor" ADD CONSTRAINT "FK_organization_vendor_tax_regime" FOREIGN KEY ("taxRegimeId") REFERENCES "tax_regime"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
				);
			}
		}
	}

	/**
	 * Removes the two party override constraints.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect the body is running on.
	 */
	private async removePartyRegimeConstraints(queryRunner: QueryRunner, dialect: string): Promise<void> {
		if (dialect === 'sqlite') {
			return;
		}

		for (const table of ['organization_contact', 'organization_vendor']) {
			const name = `FK_${table}_tax_regime`;
			if (!(await this.hasForeignKey(queryRunner, table, name))) {
				continue;
			}

			await queryRunner.query(
				dialect === 'mysql'
					? `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``
					: `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`
			);
		}
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
