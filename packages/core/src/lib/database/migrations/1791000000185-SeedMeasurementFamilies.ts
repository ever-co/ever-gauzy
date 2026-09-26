import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';
import {
	DEFAULT_UNIT_FAMILIES,
	DEFAULT_UNIT_REFERENCE_SETTING_KEYS,
	ISeedUnitFamily
} from '../../measurement/default-unit-families';

/**
 * Seeds the measurement families on an installation that already existed when their tables arrived.
 *
 * **Why a second seeding migration is not a duplicate of the first.** `SeedCoreDefaults1791000000520`
 * seeds these same six families, and it is guarded so that a step whose schema is absent is *skipped*
 * rather than fatal — a data-only seed that stops the API booting is worse than a seed that waits.
 * That guard is right, and it has a consequence the guard itself cannot repair: on an installation
 * whose migration history predates `unit_category` and `unit`, the step was skipped **and the
 * migration was recorded as applied**, so it is never retried. The installation then reaches the
 * measurement endpoints with two empty tables and no way to fill them — the fresh-install path is
 * fine because the ticks order correctly there, and only an existing database is stranded.
 *
 * A recorded migration is never re-run, so the repair is a new migration, which is this file. It
 * writes exactly what the skipped step would have written, from the same catalogue:
 *
 * 1. the six physical families (`unit_category`), one row per family per live organization;
 * 2. each family's reference unit (`unit`), with `factor = 1`, `isReference = true`,
 *    `decimalPlaces` as the schema specification states and `isSystem = true`;
 * 3. the variant stock-unit backfill — every variant that states no stock unit points at its
 *    organization's `COUNT` reference, which is a derivation and not a guess: a quantity that names
 *    no family is a count of things;
 * 4. the three tenant-scoped settings that name a family's default unit, so an operator can point at
 *    a different unit without a code change.
 *
 * **The catalogue is not restated here.** Both seeding paths read
 * `measurement/default-unit-families.ts`, which is the pattern `DEFAULT_FEATURES` already uses for the
 * feature catalogue: two hand-maintained copies of one list disagree the first time either is edited,
 * and the disagreement is silent because both paths still produce plausible rows.
 *
 * **Every step is guarded twice, exactly as the seed it repairs is.** By **row** (`NOT EXISTS`), so a
 * second run writes nothing and an administrator's own decision is never overwritten; and by
 * **schema** (`hasTable` / `hasColumn`), so a step whose tables have not arrived is skipped with a line
 * naming what was missing rather than crash-looping the API. The schema guards are what make this file
 * safe to run *before* the tables exist as well as after — which matters, because on a fresh install
 * this migration runs after `CreateMeasurementTables1791000000155` and writes nothing at all, the seed
 * having already written those rows.
 *
 * **Timestamps.** The kernel revision block occupies `1791000000155`, `…160`, `…165` and `…175`, and a
 * migration's timestamp is frozen once it has shipped, so this file takes the next free tick after
 * that block at the programme's five-tick spacing. `1791000000180` is occupied by the warehouse set's
 * layout migration, so the next free tick is `1791000000185`. It is above `…175` for the reason this
 * file exists: an installation that has already applied the revision block is precisely the one that
 * needs it.
 */
export class SeedMeasurementFamilies1791000000185 implements MigrationInterface {
	name = 'SeedMeasurementFamilies1791000000185';

	/**
	 * The families, read from the one catalogue both seeding paths share.
	 *
	 * See `SeedCoreDefaults1791000000520` — the same rows, the same columns, the same values, because
	 * they come from the same list rather than from two lists that agree today.
	 */
	private readonly unitFamilies: ISeedUnitFamily[] = DEFAULT_UNIT_FAMILIES;

	/** The tenant-setting keys that point at the seeded references an operator may re-declare. */
	private readonly unitSettingKeys: Array<{ name: string; category: string }> = DEFAULT_UNIT_REFERENCE_SETTING_KEYS;

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
			case DatabaseTypeEnum.postgres:
			case DatabaseTypeEnum.mysql:
				await this.seed(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * Removes the rows this file seeds, and only those: a family is recognised by its own code, its
	 * `isSystem` flag and the shape of its reference, so a family a tenant declared is never touched.
	 *
	 * Two statements have to run before the units go, and neither is optional. The reference units this
	 * file inserts are the ones it also points variants at, and the constraint
	 * `AddMeasurementAndTermForeignKeys1791000000175` puts on `product_variant.stockUnitId` is
	 * `RESTRICT` — so a rollback that deleted a unit a variant was counted in would be refused by the
	 * database, which is the correct answer to an *accidental* delete and the wrong one to a
	 * deliberate, paired rollback. The backfilled references are therefore cleared first, and the
	 * settings that name those units are removed with them rather than left pointing at rows that no
	 * longer exist.
	 *
	 * A family row is deleted only when nothing is left in it, so a family in which a tenant has
	 * declared units of its own survives the rollback with those units intact.
	 *
	 * The seed rows are the seed rows whichever path wrote them — this file and
	 * `SeedCoreDefaults1791000000520` write identical values from one catalogue — so on a fresh
	 * installation, where this file writes nothing, its `down` still recognises and removes them. That
	 * is stated rather than hidden: the inverse is of the seeded *state*, which is the only thing a
	 * data migration can identify, and it is why the predicate above is as tight as it is.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const hasUnitCategory = await queryRunner.hasTable('unit_category');
		const hasUnit = await queryRunner.hasTable('unit');

		if (!hasUnitCategory && !hasUnit) {
			this.skip('down', ['unit', 'unit_category']);
			return;
		}

		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const seededUnit = hasUnit ? this.seededUnitPredicate(queryRunner, '"u"') : undefined;

		if (seededUnit && (await queryRunner.hasTable('tenant_setting'))) {
			await this.run(
				queryRunner,
				dbType,
				`DELETE FROM "tenant_setting"
				 WHERE "name" IN (${this.literalList(this.unitSettingKeys.map((setting) => setting.name))})
				   AND "value" IN (SELECT "u"."id" FROM "unit" "u" WHERE ${seededUnit})`
			);
		}

		/**
		 * A variant counted in a unit this rollback is about to remove is released from it first: the
		 * reference is `RESTRICT`, so leaving it in place would make the rollback fail rather than
		 * leave a dangling reference, and the unit it names is going away either way.
		 */
		if (
			seededUnit &&
			(await queryRunner.hasTable('product_variant')) &&
			(await queryRunner.hasColumn('product_variant', 'stockUnitId'))
		) {
			await this.run(
				queryRunner,
				dbType,
				`UPDATE "product_variant" SET "stockUnitId" = NULL
				 WHERE "stockUnitId" IN (SELECT "u"."id" FROM "unit" "u" WHERE ${seededUnit})`
			);
		}

		if (seededUnit) {
			await this.run(
				queryRunner,
				dbType,
				`DELETE FROM "unit" WHERE ${this.seededUnitPredicate(queryRunner, '"unit"')}`
			);
		}

		if (hasUnitCategory) {
			await this.run(
				queryRunner,
				dbType,
				`DELETE FROM "unit_category"
				 WHERE "isSystem" = ${this.booleanLiteral(queryRunner, true)}
				   AND "code" IN (${this.literalList(this.unitFamilies.map((family) => family.category))})
				   AND NOT EXISTS (
					SELECT 1 FROM "unit" "u" WHERE "u"."categoryId" = "unit_category"."id"
				   )`
			);
		}
	}

	/**
	 * Runs every step, in order.
	 *
	 * @param queryRunner
	 */
	private async seed(queryRunner: QueryRunner): Promise<void> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;

		/**
		 * Every step writes *for an organization*, so the read that resolves them is guarded too: a
		 * seed that throws in its first statement has no per-step guard left to protect it.
		 */
		const organizationMissing = await this.missingSchema(queryRunner, 'organization', ['tenantId']);
		if (organizationMissing.length > 0) {
			this.skip('every step', organizationMissing);
			return;
		}

		const organizations: Array<{ id: string; tenantId: string }> =
			(await this.run(
				queryRunner,
				dbType,
				`SELECT "id", "tenantId" FROM "organization" WHERE "deletedAt" IS NULL ORDER BY "id" ASC`
			)) ?? [];

		const references = await this.seedFamilies(queryRunner, dbType, organizations);
		await this.backfillVariantStockUnits(queryRunner, dbType, organizations, references);
		await this.seedUnitSettings(queryRunner, dbType, organizations, references);
	}

	/**
	 * Steps 1 and 2 — the six families and their reference units.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 * @returns The seeded reference unit of each `(organization, category)`.
	 */
	private async seedFamilies(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<Map<string, string>> {
		const step = 'the measurement families and their reference units';
		const missing = [
			...(await this.missingSchema(queryRunner, 'unit_category', [
				'tenantId',
				'organizationId',
				'code',
				'name',
				'isSystem'
			])),
			...(await this.missingSchema(queryRunner, 'unit', [
				'tenantId',
				'organizationId',
				'categoryId',
				'code',
				'name',
				'symbol',
				'factor',
				'isReference',
				'decimalPlaces',
				'isSystem'
			]))
		];

		/** The reference unit of each category, per organization, for the steps that point at them. */
		const references = new Map<string, string>();

		if (missing.length > 0) {
			this.skip(step, missing);
			return references;
		}

		for (const organization of organizations) {
			for (const family of this.unitFamilies) {
				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "unit_category" ("id", "tenantId", "organizationId", "code", "name", "isSystem")
					 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, ${this.booleanLiteral(
							queryRunner,
							true
						)}
					 FROM "organization"
					 WHERE "organization"."id" = $4
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "unit_category" "uc"
						WHERE "uc"."organizationId" = "organization"."id"
						  AND "uc"."code" = $5
						  AND "uc"."deletedAt" IS NULL
					   )`,
					[uuidv4(), family.category, family.categoryName, organization.id, family.category]
				);

				const category: Array<{ id: string }> =
					(await this.run(
						queryRunner,
						dbType,
						`SELECT "id" FROM "unit_category"
						 WHERE "organizationId" = $1 AND "code" = $2 AND "deletedAt" IS NULL
						 ORDER BY "id" ASC`,
						[organization.id, family.category]
					)) ?? [];
				const categoryId = category[0]?.id;
				if (!categoryId) {
					continue;
				}

				/**
				 * `factor = 1` and `isReference = true` together are what make the reference the family's
				 * base quantity: the schema's own check constraints state the pairing on the dialects that
				 * carry them, and the service states it on all three.
				 */
				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "unit" ("id", "tenantId", "organizationId", "categoryId", "code", "name", "symbol", "factor", "isReference", "decimalPlaces", "isSystem")
					 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, ${this.booleanLiteral(
							queryRunner,
							true
						)}, $7, ${this.booleanLiteral(queryRunner, true)}
					 FROM "organization"
					 WHERE "organization"."id" = $8
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "unit" "u"
						WHERE "u"."organizationId" = "organization"."id"
						  AND "u"."code" = $9
						  AND "u"."deletedAt" IS NULL
					   )`,
					[
						uuidv4(),
						categoryId,
						family.reference,
						family.referenceName,
						family.symbol,
						1,
						family.decimalPlaces,
						organization.id,
						family.reference
					]
				);

				const unit: Array<{ id: string }> =
					(await this.run(
						queryRunner,
						dbType,
						`SELECT "id" FROM "unit"
						 WHERE "organizationId" = $1 AND "code" = $2 AND "deletedAt" IS NULL
						 ORDER BY "id" ASC`,
						[organization.id, family.reference]
					)) ?? [];
				if (unit[0]?.id) {
					references.set(`${organization.id}:${family.category}`, unit[0].id);
				}
			}
		}

		return references;
	}

	/**
	 * Step 3 — point every variant that states no stock unit at its organization's `COUNT` reference.
	 *
	 * Definitional rather than a guess, and the reason `COUNT` is the first family in the catalogue:
	 * every quantity an installation already holds is a count of things, so a variant with no stock
	 * unit is a variant counted in pieces. The write is conditional on the column being null, so a
	 * variant an operator has already placed in a unit of its own is left alone.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 * @param references The seeded reference unit of each `(organization, category)`.
	 */
	private async backfillVariantStockUnits(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>,
		references: Map<string, string>
	): Promise<void> {
		const step = 'the variant stock-unit backfill';
		const missing = await this.missingSchema(queryRunner, 'product_variant', ['organizationId', 'stockUnitId']);
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		for (const organization of organizations) {
			const unitId = references.get(`${organization.id}:COUNT`);
			if (!unitId) {
				continue;
			}

			await this.run(
				queryRunner,
				dbType,
				`UPDATE "product_variant" SET "stockUnitId" = $1
				 WHERE "organizationId" = $2 AND "stockUnitId" IS NULL AND "deletedAt" IS NULL`,
				[unitId, organization.id]
			);
		}
	}

	/**
	 * Step 4 — the tenant-scoped settings that name the default unit of a family.
	 *
	 * A setting is written only when the tenant has none of that name, so an operator who has already
	 * pointed at a unit of its own keeps that decision.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 * @param references The seeded reference unit of each `(organization, category)`.
	 */
	private async seedUnitSettings(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>,
		references: Map<string, string>
	): Promise<void> {
		const step = 'the measurement default settings';
		const missing = await this.missingSchema(queryRunner, 'tenant_setting', ['tenantId', 'name', 'value']);
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		for (const organization of organizations) {
			for (const setting of this.unitSettingKeys) {
				const unitId = references.get(`${organization.id}:${setting.category}`);
				if (!unitId) {
					continue;
				}

				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "tenant_setting" ("id", "tenantId", "name", "value")
					 SELECT $1, "organization"."tenantId", $2, $3
					 FROM "organization"
					 WHERE "organization"."id" = $4
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "tenant_setting" "ts"
						WHERE "ts"."tenantId" = "organization"."tenantId"
						  AND "ts"."name" = $5
						  AND "ts"."deletedAt" IS NULL
					   )`,
					[uuidv4(), setting.name, unitId, organization.id, setting.name]
				);
			}
		}
	}

	/**
	 * The predicate that recognises a seeded reference unit, used by the rollback.
	 *
	 * Every clause is needed. The `code` is the family's reference code; `isSystem` and `isReference`
	 * say the platform rather than a tenant declared it; `factor = 1` is the reference's defining
	 * property; and the category it hangs off must itself be a live seeded family, so a unit a tenant
	 * happened to give a family's code to cannot be swept up by a rollback.
	 *
	 * The qualifier is a parameter because the same predicate is used against two shapes of statement:
	 * the correlated sub-selects in the setting and variant statements alias the table `"u"`, while the
	 * `DELETE` that removes the units names the table itself. MySQL's single-table `DELETE` form admits
	 * no alias, so a predicate hard-coded to `"u"` would be a statement that runs on one dialect and not
	 * on another.
	 *
	 * @param queryRunner
	 * @param qualifier The quoted table name or alias the predicate is written against.
	 * @returns A SQL predicate over the units.
	 */
	private seededUnitPredicate(queryRunner: QueryRunner, qualifier: string): string {
		const familyCodes = this.literalList(this.unitFamilies.map((family) => family.category));
		const referenceCodes = this.literalList(this.unitFamilies.map((family) => family.reference));

		return (
			`${qualifier}."isSystem" = ${this.booleanLiteral(queryRunner, true)} ` +
			`AND ${qualifier}."isReference" = ${this.booleanLiteral(queryRunner, true)} ` +
			`AND ${qualifier}."factor" = 1 ` +
			`AND ${qualifier}."code" IN (${referenceCodes}) ` +
			`AND ${qualifier}."categoryId" IN (` +
			`SELECT "uc"."id" FROM "unit_category" "uc" ` +
			`WHERE "uc"."isSystem" = ${this.booleanLiteral(queryRunner, true)} AND "uc"."code" IN (${familyCodes})` +
			`)`
		);
	}

	/**
	 * A list of string literals for an `IN` clause.
	 *
	 * The values are constants of this file — a category code and a reference code out of the shared
	 * catalogue, never caller input — and they are written as literals rather than as parameters
	 * because each list appears more than once in the statement it is used by, and a parameter used
	 * twice cannot be bound positionally once `$n` has become `?`.
	 *
	 * @param values The strings to quote.
	 * @returns The comma-separated, single-quoted list.
	 */
	private literalList(values: string[]): string {
		return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
	}

	/**
	 * The tables and columns a step needs and the schema does not have.
	 *
	 * @param queryRunner
	 * @param table The table the step writes to.
	 * @param columns The columns the step names.
	 * @returns One entry per missing table or column, empty when the step may run.
	 */
	private async missingSchema(
		queryRunner: QueryRunner,
		table: string,
		columns: string[]
	): Promise<string[]> {
		if (!(await queryRunner.hasTable(table))) {
			return [`${table} (table)`];
		}

		const missing: string[] = [];
		for (const column of columns) {
			if (!(await queryRunner.hasColumn(table, column))) {
				missing.push(`${table}.${column}`);
			}
		}
		return missing;
	}

	/**
	 * Logs a step the schema cannot support yet. Logged rather than thrown: a data-only seed that stops
	 * the API booting is worse than a seed that waits for its tables.
	 *
	 * @param step What was skipped.
	 * @param missing The tables or columns that were not there.
	 */
	private skip(step: string, missing: string[]): void {
		console.log(
			chalk.gray(`${this.name}: skipping ${step} — not present in this schema yet: ${missing.join(', ')}.`)
		);
	}

	/**
	 * A boolean as the dialect's own literal.
	 *
	 * `isSystem` appears in a guard as well as in a target list, and a parameter used twice cannot be
	 * bound positionally once `$n` has become `?`, so the value is written as a literal instead. It is
	 * a constant of this file, never caller input.
	 *
	 * @param queryRunner
	 * @param value
	 * @returns `true` / `false` on Postgres, `1` / `0` elsewhere.
	 */
	private booleanLiteral(queryRunner: QueryRunner, value: boolean): string {
		if ((queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.postgres) {
			return value ? 'true' : 'false';
		}
		return value ? '1' : '0';
	}

	/**
	 * Runs one statement, translating it to the connection's dialect.
	 *
	 * The SQL is written once with double-quoted identifiers and `$n` placeholders; `prepareSQLQuery`
	 * quotes for MySQL and `replacePlaceholders` turns the placeholders into `?` where the driver
	 * needs them. Every placeholder appears exactly once, which is what keeps the positional binding
	 * correct after the translation.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param sql
	 * @param parameters
	 * @returns The driver's result.
	 */
	private async run(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		sql: string,
		parameters: any[] = []
	): Promise<any> {
		let query = p(sql);
		query = replacePlaceholders(query, dbType);
		return await queryRunner.query(query, parameters);
	}
}
