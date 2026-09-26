import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';
import { DEFAULT_FEATURES } from '../../feature/default-features';
import {
	COMMERCE_CATALOGUE,
	DEFAULT_ENABLED_FEATURES,
	IFeatureCatalogueEntry,
	REUSED_FEATURE_CODES
} from '../../feature/commerce-feature-catalogue';

/**
 * Codes this programme reuses rather than introduces.
 *
 * They are inserted **only when absent**, so a deployment whose catalogue already carries them
 * converges on the same rows without this migration touching an administrator's existing toggle. They
 * get no toggle rows at all: a deployment that has the code already has whatever toggle it chose, and
 * one that does not is not this migration's to switch on.
 *
 * Their rows are read out of `DEFAULT_FEATURES` rather than restated here. That array already holds
 * the one definition of each — an entry this programme must not alter — and the fresh-install seed
 * writes it verbatim, so deriving the rows from it is what makes "the migration and the seed write the
 * same row" true by construction instead of true by inspection. `defaultEnabled` is not consulted for
 * these two: they are excluded from `DEFAULT_ENABLED_FEATURES` by construction, below.
 *
 * `REUSED_FEATURES` and `SEEDED_CATALOGUE` are exported so that invariant — "the rows written here are
 * the rows the fresh-install seed writes" — can be checked without a database. `down()` removes
 * `COMMERCE_CATALOGUE` only, for the reason above.
 */
export const REUSED_FEATURES: IFeatureCatalogueEntry[] = DEFAULT_FEATURES.filter((feature) =>
	REUSED_FEATURE_CODES.includes(feature.code)
).map(({ name, code, description, image, link, status, icon }) => ({
	name,
	code,
	description,
	image,
	link,
	status,
	icon,
	defaultEnabled: false
}));

/** Every code this migration writes a catalogue row for: the programme's own, then the reused pair. */
export const SEEDED_CATALOGUE: IFeatureCatalogueEntry[] = [...COMMERCE_CATALOGUE, ...REUSED_FEATURES];

/**
 * The second of the three data-only kernel migrations: the feature seed.
 *
 * Permissions decide *who* may do something inside a tenant; a feature flag decides *whether* the
 * capability exists for that tenant at all. Both are per-tenant data, so a catalogue row written at
 * provisioning time never reaches a tenant that is already provisioned — the flags the new packages
 * carry would resolve to nothing, and `Store.hasFeatureEnabled()` reads a missing toggle row as
 * **disabled**.
 *
 * The catalogue itself is **not** declared here. It is owned by
 * `packages/core/src/lib/feature/commerce-feature-catalogue.ts`, which this migration and the
 * fresh-install seed (`feature.seed.ts` → `DEFAULT_FEATURES`) both read. Two hand-maintained copies
 * of one catalogue drift the first time either is edited, and this path's failure mode is silent: the
 * fresh-install seed deletes every `feature` row and recreates only what `DEFAULT_FEATURES` lists, so
 * a code the migration seeds and that list omits is wiped again on a new installation.
 *
 * Three decisions are worth stating, because each is a choice rather than a derivation:
 *
 * 1. **Every code gets a catalogue row, including the ones that default off.** A catalogue row is what
 *    makes a flag visible and administrable; without it an administrator cannot turn the capability on
 *    even deliberately. Only the default-on codes get toggle rows.
 * 2. **A default-off feature gets a catalogue row and NO toggle row.** A missing toggle row reads as
 *    disabled, which is exactly the intended default, and it avoids writing a row per tenant that the
 *    tenant never asked for. It also means the migration never has to decide *which* tenants get a
 *    capability that is off by default.
 * 3. **The reused pair is inserted only when absent**, so the migration converges a catalogue that
 *    predates them without rewriting a toggle an administrator already set.
 *
 * Every statement is guarded by `NOT EXISTS`, so the migration is re-runnable and a tenant or an
 * administrator that has already made a decision is left alone.
 *
 * Timestamps: see the note in `CoreRolePermissionsReload1791000000500` — the appendix's 1791000000140
 * is taken in this implementation, so this block uses 1791000000510 and keeps the appendix's order.
 */
export class SeedCoreFeatures1791000000510 implements MigrationInterface {
	name = 'SeedCoreFeatures1791000000510';

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
	 * Removes the toggle rows first and then the catalogue rows this migration wrote. The reused pair
	 * is deliberately left in place: it is only ever inserted when it was absent, and a row this
	 * migration did not create is not this migration's to remove — the same reason the reload's `down`
	 * is a no-op.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const seeded = COMMERCE_CATALOGUE;

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				for (const feature of seeded) {
					await queryRunner.query(
						`DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = ?)`,
						[feature.code]
					);
				}
				for (const feature of seeded) {
					await queryRunner.query(`DELETE FROM "feature" WHERE "code" = ?`, [feature.code]);
				}
				break;
			case DatabaseTypeEnum.postgres:
				for (const feature of seeded) {
					await queryRunner.query(
						`DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = $1)`,
						[feature.code]
					);
				}
				for (const feature of seeded) {
					await queryRunner.query(`DELETE FROM "feature" WHERE "code" = $1`, [feature.code]);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const feature of seeded) {
					await queryRunner.query(
						`DELETE FROM \`feature_organization\` WHERE \`featureId\` IN (SELECT \`id\` FROM \`feature\` WHERE \`code\` = ?)`,
						[feature.code]
					);
				}
				for (const feature of seeded) {
					await queryRunner.query(`DELETE FROM \`feature\` WHERE \`code\` = ?`, [feature.code]);
				}
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
		for (const feature of SEEDED_CATALOGUE) {
			const { name, code, description, image, link, status, icon } = feature;
			/**
			 * 🛑 `$2` MUST carry an explicit cast. It is the only parameter used twice, and in an
			 * `INSERT ... SELECT ... WHERE`, Postgres resolves the SELECT target list on its own —
			 * *before* matching it to the INSERT columns — so the occurrence in the target list deduced
			 * `unknown` while `"code" = $2` deduced the column's type. Postgres rejects the whole
			 * statement with `inconsistent types deduced for parameter $2`, the migration throws, and
			 * because migrations run at API boot the entire API crash-loops. This does NOT reproduce on
			 * SQLite, where positional `?` parameters are untyped.
			 */
			await queryRunner.query(
				`INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
				 SELECT gen_random_uuid(), $1, $2::varchar, $3, $4, $5, $6, $7
				 WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = $2::varchar)`,
				[name, code, description, image, link, status, icon]
			);
		}

		/**
		 * One enabled, tenant-scoped toggle row per live tenant and per default-on feature.
		 * `organizationId IS NULL` is what makes the row tenant-scoped: organization-scoped rows only
		 * ever exist once someone toggles the feature for one organization.
		 */
		for (const feature of DEFAULT_ENABLED_FEATURES) {
			await queryRunner.query(
				`INSERT INTO "feature_organization" ("id", "tenantId", "featureId", "isEnabled")
				 SELECT gen_random_uuid(), "tenant"."id", "feature"."id", true
				 FROM "tenant", "feature"
				 WHERE "feature"."code" = $1
				   AND "tenant"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "feature_organization" "fo"
					WHERE "fo"."featureId" = "feature"."id"
					  AND "fo"."tenantId" = "tenant"."id"
					  AND "fo"."organizationId" IS NULL
				   )`,
				[feature.code]
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const feature of SEEDED_CATALOGUE) {
			const { name, code, description, image, link, status, icon } = feature;
			await queryRunner.query(
				`INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
				 SELECT ?, ?, ?, ?, ?, ?, ?, ?
				 WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = ?)`,
				[uuidv4(), name, code, description, image, link, status, icon, code]
			);
		}

		/**
		 * SQLite has no server-side UUID generator and `feature_organization.id` has no default, so the
		 * missing (tenant, feature) pairs are resolved first and the rows are inserted one by one with an
		 * id generated here. The `NOT EXISTS` guard keeps the migration re-runnable and keeps a tenant
		 * that already toggled the feature untouched.
		 */
		for (const feature of DEFAULT_ENABLED_FEATURES) {
			const rows: { tenantId: string; featureId: string }[] = await queryRunner.query(
				`SELECT "tenant"."id" AS "tenantId", "feature"."id" AS "featureId"
				 FROM "tenant", "feature"
				 WHERE "feature"."code" = ?
				   AND "tenant"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "feature_organization" "fo"
					WHERE "fo"."featureId" = "feature"."id"
					  AND "fo"."tenantId" = "tenant"."id"
					  AND "fo"."organizationId" IS NULL
				   )`,
				[feature.code]
			);

			for (const row of rows ?? []) {
				await queryRunner.query(
					`INSERT INTO "feature_organization" ("id", "tenantId", "featureId", "isEnabled") VALUES (?, ?, ?, ?)`,
					[uuidv4(), row.tenantId, row.featureId, 1]
				);
			}
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const feature of SEEDED_CATALOGUE) {
			const { name, code, description, image, link, status, icon } = feature;
			await queryRunner.query(
				`INSERT INTO \`feature\` (\`id\`, \`name\`, \`code\`, \`description\`, \`image\`, \`link\`, \`status\`, \`icon\`)
				 SELECT ?, ?, ?, ?, ?, ?, ?, ?
				 FROM DUAL
				 WHERE NOT EXISTS (SELECT 1 FROM \`feature\` WHERE \`code\` = ?)`,
				[uuidv4(), name, code, description, image, link, status, icon, code]
			);
		}

		/**
		 * One enabled, tenant-scoped toggle row per live tenant and per default-on feature. MySQL has no
		 * `gen_random_uuid()`, so `UUID()` is used and the id is generated server side.
		 */
		for (const feature of DEFAULT_ENABLED_FEATURES) {
			await queryRunner.query(
				`INSERT INTO \`feature_organization\` (\`id\`, \`tenantId\`, \`featureId\`, \`isEnabled\`)
				 SELECT UUID(), \`tenant\`.\`id\`, \`feature\`.\`id\`, 1
				 FROM \`tenant\`, \`feature\`
				 WHERE \`feature\`.\`code\` = ?
				   AND \`tenant\`.\`deletedAt\` IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM \`feature_organization\` \`fo\`
					WHERE \`fo\`.\`featureId\` = \`feature\`.\`id\`
					  AND \`fo\`.\`tenantId\` = \`tenant\`.\`id\`
					  AND \`fo\`.\`organizationId\` IS NULL
				   )`,
				[feature.code]
			);
		}
	}
}
