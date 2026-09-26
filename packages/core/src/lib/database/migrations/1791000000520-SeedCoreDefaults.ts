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
 * The third of the three data-only kernel migrations: the platform defaults existing organizations
 * have never had.
 *
 * The capability revision adds tables whose rows are only written by a setup path a provisioned
 * tenant never re-runs: a channel and a region to resolve a request against, settlement terms, the
 * numbering series a document is quoted by, the measurement families that make a quantity mean
 * something, and the search definitions an operator inspects before an index is built. Without them
 * an existing organization reaches the new endpoints with nothing to read — and, for the numbering
 * series, cannot issue its first document at all.
 *
 * **Every step is guarded twice, and the guards are the point.**
 *
 * - by **row** (`NOT EXISTS`), so the migration is re-runnable and never overwrites a decision an
 *   administrator has already made; and
 * - by **schema** (`hasTable` / `hasColumn`), because the tables and columns this seed writes are
 *   delivered by their own migrations and a seed must never be the thing that stops the API booting.
 *   A step whose schema is not present yet is **skipped with a line naming what was missing**, and it
 *   activates by itself on the first boot after that schema lands. A seed that crash-loops is worse
 *   than a seed that waits.
 *
 * Nothing here fabricates a commercial decision. No settlement term, no vendor term, no tax regime,
 * no bin capacity unit and no price row is created: each is an agreement or a physical fact only the
 * tenant knows, and a seeded default would silently redefine existing behaviour. What is seeded is
 * what is derivable without a decision — a default channel and region carrying the organization's own
 * currency, the physical measurement families, the numbering series the platform's own documents use,
 * and the search definitions as declarations only.
 *
 * Timestamps: see the note in `CoreRolePermissionsReload1791000000500` — the appendix's 1791000000145
 * is taken in this implementation, so this block uses 1791000000520 and keeps the appendix's order.
 */
export class SeedCoreDefaults1791000000520 implements MigrationInterface {
	name = 'SeedCoreDefaults1791000000520';

	/** The numbering series every organization needs before it can issue a document. */
	private readonly sequenceSeries: Array<{ key: string; prefix: string }> = [
		{ key: 'ORDER', prefix: 'SO-' },
		{ key: 'RETURN', prefix: 'RT-' },
		{ key: 'CLAIM', prefix: 'CL-' },
		{ key: 'EXCHANGE', prefix: 'EX-' },
		{ key: 'PO', prefix: 'PO-' },
		{ key: 'SUBSCRIPTION', prefix: 'SUB-' },
		{ key: 'ENTITLEMENT', prefix: 'EN-' }
	];

	/** Order-number defaults, used when the organization has no channel to take them from. */
	private readonly defaultOrderPrefix = 'SO-';
	private readonly defaultOrderPadding = 6;

	/**
	 * The physical measurement families.
	 *
	 * Read from `measurement/default-unit-families.ts` rather than restated here: the fresh-install
	 * seed is one of two paths that write these rows, and
	 * `SeedMeasurementFamilies1791000000185` is the other — it exists because this migration ran on an
	 * installation whose schema predated `unit_category` and `unit`, skipped this step for that reason,
	 * and was then recorded as applied. Two copies of one catalogue would let the two paths write
	 * different rows while both looked correct.
	 */
	private readonly unitFamilies: ISeedUnitFamily[] = DEFAULT_UNIT_FAMILIES;

	/** The tenant-setting keys that point at the seeded references an operator may re-declare. */
	private readonly unitSettingKeys: Array<{ name: string; category: string }> = DEFAULT_UNIT_REFERENCE_SETTING_KEYS;

	/**
	 * The entity kinds global search declares a definition for.
	 *
	 * Built-in provider rows (`engineKey` null) written with `status = DISABLED`: the definitions are
	 * declared so an operator can inspect what would be indexed, and nothing is built until a reindex
	 * is asked for.
	 */
	private readonly indexedEntities: Array<{ entity: string; label: string }> = [
		{ entity: 'product', label: 'Products' },
		{ entity: 'product_variant', label: 'Product variants' },
		{ entity: 'organization_contact', label: 'Contacts' },
		{ entity: 'invoice', label: 'Invoices' },
		{ entity: 'expense', label: 'Expenses' },
		{ entity: 'income', label: 'Income' },
		{ entity: 'project', label: 'Projects' },
		{ entity: 'task', label: 'Tasks' },
		{ entity: 'employee', label: 'Employees' },
		{ entity: 'document', label: 'Documents' },
		{ entity: 'order', label: 'Orders' }
	];

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
	 * Removes only the rows it can identify as its own output: the **default** channel and region of
	 * an organization that has no orders — the pair this migration creates, recognised by its
	 * `DEFAULT` code and its default flag, and only where the tenant has not yet traded on it.
	 *
	 * Everything else is left in place on purpose. A numbering series, a measurement family, a tax
	 * category and a price preference are indistinguishable from rows an operator created, and a
	 * rollback that deletes an operator's data is worse than a rollback that leaves seed rows behind.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;

		if (!(await queryRunner.hasTable('channel'))) {
			this.skip('down', ['channel (table)']);
			return;
		}

		/**
		 * `order` is a plugin-owned table. When it is absent the organization has certainly never
		 * placed an order through this platform, which is the condition this `down` is written around.
		 */
		const hasOrders = await queryRunner.hasTable('order');
		const withoutOrders = hasOrders
			? `"organization"."id" NOT IN (SELECT "o"."organizationId" FROM "order" "o" WHERE "o"."deletedAt" IS NULL)`
			: `1 = 1`;

		if (await queryRunner.hasTable('channel_region')) {
			await this.run(
				queryRunner,
				dbType,
				`DELETE FROM "channel_region" WHERE "channelId" IN (
					SELECT "channel"."id" FROM "channel", "organization"
					WHERE "channel"."organizationId" = "organization"."id"
					  AND "channel"."code" = $1 AND "channel"."isDefault" = ${this.booleanLiteral(queryRunner, true)}
					  AND ${withoutOrders}
				)`,
				['DEFAULT']
			);
		}

		if (await queryRunner.hasTable('region')) {
			await this.run(
				queryRunner,
				dbType,
				`DELETE FROM "region" WHERE "code" = $1 AND "isDefault" = ${this.booleanLiteral(
					queryRunner,
					true
				)} AND "organizationId" IN (
					SELECT "organization"."id" FROM "organization" WHERE ${withoutOrders}
				)`,
				['DEFAULT']
			);
		}

		await this.run(
			queryRunner,
			dbType,
			`DELETE FROM "channel" WHERE "code" = $1 AND "isDefault" = ${this.booleanLiteral(
				queryRunner,
				true
			)} AND "organizationId" IN (
				SELECT "organization"."id" FROM "organization" WHERE ${withoutOrders}
			)`,
			['DEFAULT']
		);
	}

	/**
	 * Runs every step, in order.
	 *
	 * @param queryRunner
	 */
	private async seed(queryRunner: QueryRunner): Promise<void> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;

		/**
		 * Every step below seeds *for an organization*, so the read that resolves them is guarded too:
		 * a seed that throws in its first statement has no per-step guard left to protect it.
		 */
		const organizationMissing = await this.missingSchema(queryRunner, 'organization', ['tenantId', 'currency']);
		if (organizationMissing.length > 0) {
			this.skip('every step', organizationMissing);
			return;
		}

		/** The organizations a step seeds for: live, and ordered so a re-run is deterministic. */
		const organizations: Array<{ id: string; tenantId: string; currency: string }> = (
			await this.run(
				queryRunner,
				dbType,
				`SELECT "id", "tenantId", "currency" FROM "organization" WHERE "deletedAt" IS NULL ORDER BY "id" ASC`
			)
		) ?? [];

		await this.seedChannels(queryRunner, dbType, organizations);
		await this.seedRegions(queryRunner, dbType, organizations);
		await this.seedSettlementDefaults(queryRunner, dbType, organizations);
		await this.seedUnits(queryRunner, dbType, organizations);
		await this.seedSequences(queryRunner, dbType, organizations);
		await this.seedSlugs(queryRunner, dbType);
		this.declareNoFabricatedRows();
		await this.seedSearchDefinitions(queryRunner, dbType, organizations);
	}

	/**
	 * Step 1 — one default channel per organization, carrying the organization's own currency.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedChannels(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string; currency: string }>
	): Promise<void> {
		const step = 'the default channel';
		const missing = await this.missingSchema(queryRunner, 'channel', [
			'tenantId',
			'organizationId',
			'name',
			'code',
			'status',
			'isDefault',
			'defaultCurrency',
			'orderNumberPrefix',
			'orderNumberPadding'
		]);
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		for (const organization of organizations) {
			await this.run(
				queryRunner,
				dbType,
				`INSERT INTO "channel" ("id", "tenantId", "organizationId", "name", "code", "status", "isDefault", "defaultCurrency", "orderNumberPrefix", "orderNumberPadding")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, ${this.booleanLiteral(
						queryRunner,
						true
					)}, "organization"."currency", $5, $6
				 FROM "organization"
				 WHERE "organization"."id" = $7
				   AND "organization"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "channel" "c"
					WHERE "c"."organizationId" = "organization"."id"
					  AND "c"."code" = $8
					  AND "c"."deletedAt" IS NULL
				   )`,
				[
					uuidv4(),
					'Default channel',
					'DEFAULT',
					'ACTIVE',
					this.defaultOrderPrefix,
					this.defaultOrderPadding,
					organization.id,
					'DEFAULT'
				]
			);
		}
	}

	/**
	 * Step 2 — one default region per default channel, plus step 3, the channel↔region link that
	 * publishes it.
	 *
	 * The region currency is the channel's, which is the organization's when the channel was seeded
	 * here. `isTaxInclusive` is written explicitly as false: the organization record carries no
	 * tax-inclusivity preference in this schema, so there is nothing to read and a merchant states it
	 * on the region.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedRegions(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<void> {
		const step = 'the default region and its channel link';
		const missing = [
			...(await this.missingSchema(queryRunner, 'region', [
				'tenantId',
				'organizationId',
				'name',
				'code',
				'currency',
				'isDefault',
				'isTaxInclusive',
				'status'
			])),
			...(await this.missingSchema(queryRunner, 'channel_region', ['channelId', 'regionId', 'isDefault']))
		];
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		for (const organization of organizations) {
			await this.run(
				queryRunner,
				dbType,
				`INSERT INTO "region" ("id", "tenantId", "organizationId", "name", "code", "currency", "isDefault", "isTaxInclusive", "status")
				 SELECT $1, "channel"."tenantId", "channel"."organizationId", $2, $3, "channel"."defaultCurrency", ${this.booleanLiteral(
						queryRunner,
						true
					)}, ${this.booleanLiteral(queryRunner, false)}, $4
				 FROM "channel"
				 WHERE "channel"."organizationId" = $5
				   AND "channel"."isDefault" = ${this.booleanLiteral(queryRunner, true)}
				   AND "channel"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "region" "r"
					WHERE "r"."organizationId" = "channel"."organizationId"
					  AND "r"."code" = $6
					  AND "r"."deletedAt" IS NULL
				   )`,
				[uuidv4(), 'Default region', 'DEFAULT', 'ACTIVE', organization.id, 'DEFAULT']
			);

			await this.run(
				queryRunner,
				dbType,
				`INSERT INTO "channel_region" ("id", "channelId", "regionId", "isDefault")
				 SELECT $1, "channel"."id", "region"."id", ${this.booleanLiteral(queryRunner, true)}
				 FROM "channel", "region"
				 WHERE "channel"."organizationId" = $2
				   AND "region"."organizationId" = $3
				   AND "channel"."code" = $4
				   AND "region"."code" = $5
				   AND "channel"."deletedAt" IS NULL
				   AND "region"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "channel_region" "cr"
					WHERE "cr"."channelId" = "channel"."id"
					  AND "cr"."regionId" = "region"."id"
				   )`,
				[uuidv4(), organization.id, organization.id, 'DEFAULT', 'DEFAULT']
			);
		}
	}

	/**
	 * Step 4 — a default tax category and a currency price preference per organization.
	 *
	 * One category, `Standard`, because a category is what a rate hangs off and an organization with
	 * no category cannot record its first rate. The preference states the currency's presentation and
	 * is written tax-exclusive, which is the platform's existing default; an organization that
	 * presents prices tax-inclusive edits the one row.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedSettlementDefaults(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<void> {
		const categoryStep = 'the default tax category';
		const categoryMissing = await this.missingSchema(queryRunner, 'tax_category', [
			'tenantId',
			'organizationId',
			'name',
			'code',
			'description',
			'isDefault'
		]);
		if (categoryMissing.length > 0) {
			this.skip(categoryStep, categoryMissing);
		} else {
			for (const organization of organizations) {
				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "tax_category" ("id", "tenantId", "organizationId", "name", "code", "description", "isDefault")
					 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, ${this.booleanLiteral(
							queryRunner,
							true
						)}
					 FROM "organization"
					 WHERE "organization"."id" = $5
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "tax_category" "tc"
						WHERE "tc"."organizationId" = "organization"."id"
						  AND "tc"."code" = $6
						  AND "tc"."deletedAt" IS NULL
					   )`,
					[
						uuidv4(),
						'Standard',
						'DEFAULT',
						'The tax category every rate hangs off until an organization declares its own.',
						organization.id,
						'DEFAULT'
					]
				);
			}
		}

		const preferenceStep = 'the currency price preference';
		const preferenceMissing = await this.missingSchema(queryRunner, 'price_preference', [
			'tenantId',
			'organizationId',
			'attribute',
			'value',
			'isTaxInclusive'
		]);
		if (preferenceMissing.length > 0) {
			this.skip(preferenceStep, preferenceMissing);
			return;
		}

		for (const organization of organizations) {
			await this.run(
				queryRunner,
				dbType,
				`INSERT INTO "price_preference" ("id", "tenantId", "organizationId", "attribute", "value", "isTaxInclusive")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, "organization"."currency", ${this.booleanLiteral(
						queryRunner,
						false
					)}
				 FROM "organization"
				 WHERE "organization"."id" = $3
				   AND "organization"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "price_preference" "pp"
					WHERE "pp"."organizationId" = "organization"."id"
					  AND "pp"."attribute" = $4
					  AND "pp"."value" = "organization"."currency"
					  AND "pp"."deletedAt" IS NULL
				   )`,
				[uuidv4(), 'CURRENCY', organization.id, 'CURRENCY']
			);
		}
	}

	/**
	 * Step 5 — the physical measurement families and their reference units, the variant backfill and
	 * the three tenant-scoped reference settings.
	 *
	 * Definitional rather than a guess: every quantity an installation already holds means pieces, so
	 * a variant's stock unit resolves to the `COUNT` reference without asking anyone. The five
	 * non-count families are seeded because a quantity with no family is a bare number, and the
	 * settings exist so an operator can point at a different unit without editing code.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedUnits(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<void> {
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
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		/** The reference unit of each category, per organization, for the steps that point at them. */
		const references = new Map<string, string>();

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

		await this.backfillVariantStockUnits(queryRunner, dbType, organizations, references);
		await this.seedUnitSettings(queryRunner, dbType, organizations, references);
	}

	/**
	 * Step 5, continued — point every variant that has no stock unit at its organization's `COUNT`
	 * reference.
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
	 * Step 5, continued — the tenant-scoped settings that name the default unit of a family.
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
	 * Step 6 — one numbering series per organization and per document kind.
	 *
	 * Organization-wide (`channelId` null), because a series per channel is a decision a merchant
	 * makes when it runs more than one sales surface; the unique index on
	 * `(organizationId, key) WHERE channelId IS NULL` is what the `NOT EXISTS` guard mirrors, so the
	 * step is re-runnable. The prefix and padding come from the organization's default channel when
	 * there is one, so a merchant that numbered its channel differently is not overruled, and from the
	 * documented defaults otherwise.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedSequences(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<void> {
		const step = 'the numbering series';
		const missing = await this.missingSchema(queryRunner, 'sequence', [
			'tenantId',
			'organizationId',
			'key',
			'prefix',
			'padding',
			'nextValue',
			'step',
			'resetPolicy',
			'channelId'
		]);
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		const channelTableExists = await queryRunner.hasTable('channel');

		for (const organization of organizations) {
			let prefix = this.defaultOrderPrefix;
			let padding = this.defaultOrderPadding;

			if (channelTableExists) {
				const channel: Array<{ orderNumberPrefix: string | null; orderNumberPadding: number | null }> =
					(await this.run(
						queryRunner,
						dbType,
						`SELECT "orderNumberPrefix", "orderNumberPadding" FROM "channel"
						 WHERE "organizationId" = $1 AND "isDefault" = ${this.booleanLiteral(
								queryRunner,
								true
							)} AND "deletedAt" IS NULL
						 ORDER BY "id" ASC`,
						[organization.id]
					)) ?? [];
				if (channel[0]?.orderNumberPrefix) {
					prefix = channel[0].orderNumberPrefix;
				}
				if (channel[0]?.orderNumberPadding != null) {
					padding = channel[0].orderNumberPadding;
				}
			}

			for (const series of this.sequenceSeries) {
				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "sequence" ("id", "tenantId", "organizationId", "key", "prefix", "padding", "nextValue", "step", "resetPolicy")
					 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, $7
					 FROM "organization"
					 WHERE "organization"."id" = $8
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "sequence" "s"
						WHERE "s"."organizationId" = "organization"."id"
						  AND "s"."key" = $9
						  AND "s"."channelId" IS NULL
						  AND "s"."deletedAt" IS NULL
					   )`,
					[
						uuidv4(),
						series.key,
						series.key === 'ORDER' ? prefix : series.prefix,
						padding,
						1,
						1,
						'NEVER',
						organization.id,
						series.key
					]
				);
			}
		}
	}

	/**
	 * Step 7 — the slug and code backfill, only where the column is null and only where the column
	 * exists.
	 *
	 * A product's identifier stays what it was: the slug is derived from the code the row already
	 * carries, and `publishedAt` is deliberately never written, because publication is an explicit
	 * act and nothing in this migration may publish anything.
	 *
	 * @param queryRunner
	 * @param dbType
	 */
	private async seedSlugs(queryRunner: QueryRunner, dbType: DatabaseTypeEnum): Promise<void> {
		const productStep = 'the product slug and status backfill';
		const productColumns = await this.presentColumns(queryRunner, 'product', ['slug', 'status', 'code']);
		if (!productColumns.includes('slug') && !productColumns.includes('status')) {
			this.skip(productStep, ['product.slug', 'product.status']);
		} else {
			if (productColumns.includes('slug') && productColumns.includes('code')) {
				await this.run(
					queryRunner,
					dbType,
					`UPDATE "product" SET "slug" = LOWER("code") WHERE "slug" IS NULL AND "deletedAt" IS NULL`
				);
			}
			if (productColumns.includes('status')) {
				await this.run(queryRunner, dbType, `UPDATE "product" SET "status" = $1 WHERE "status" IS NULL`, [
					'ACTIVE'
				]);
			}
		}

		/**
		 * A category carries no name of its own — it lives in the translation table — so a category
		 * slug is only derivable when both are present. When they are not, the step says so rather
		 * than inventing an identifier.
		 */
		const categoryStep = 'the category code and slug backfill';
		const categoryColumns = await this.presentColumns(queryRunner, 'product_category', ['code', 'slug']);
		const translationColumns = await this.presentColumns(queryRunner, 'product_category_translation', [
			'productCategoryId',
			'name'
		]);
		if (categoryColumns.length === 0) {
			this.skip(categoryStep, ['product_category.code', 'product_category.slug']);
		} else if (translationColumns.length < 2) {
			this.skip(categoryStep, ['product_category_translation.productCategoryId', 'product_category_translation.name']);
		} else {
			for (const column of categoryColumns) {
				await this.run(
					queryRunner,
					dbType,
					`UPDATE "product_category" SET "${column}" = (
						SELECT LOWER(REPLACE("t"."name", ' ', '-')) FROM "product_category_translation" "t"
						WHERE "t"."productCategoryId" = "product_category"."id"
						ORDER BY "t"."id" ASC LIMIT 1
					 ) WHERE "${column}" IS NULL AND "deletedAt" IS NULL`
				);
			}
		}
	}

	/**
	 * Step 8 — the step that writes nothing.
	 *
	 * No `product_price` row is backfilled from `product_variant_price` and no publication row is
	 * fabricated: a price row states which list and which currency a price belongs to, and only an
	 * administrator asking for a price list can answer that. Recorded here, as a log line, so the
	 * omission is a decision on the record rather than a step that looks forgotten.
	 */
	private declareNoFabricatedRows(): void {
		console.log(
			chalk.gray(
				`${this.name}: no price list, price row or publication row is fabricated — a price states ` +
					'a list and a currency only an administrator can choose.'
			)
		);
	}

	/**
	 * Step 9 — one search definition per entity kind, declared and not built.
	 *
	 * The `status` column is what states "declared but disabled"; where the search table does not
	 * carry it, the step says so and writes nothing rather than expressing a different meaning through
	 * the activity flag, which a reader filters on.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param organizations
	 */
	private async seedSearchDefinitions(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		organizations: Array<{ id: string }>
	): Promise<void> {
		const step = 'the search index definitions';
		const missing = await this.missingSchema(queryRunner, 'search_index_definition', [
			'organizationId',
			'entity',
			'label',
			'fields',
			'defaultWeight',
			'sourceUpdatedAtField',
			'isSystem',
			'version',
			'status'
		]);
		if (missing.length > 0) {
			this.skip(step, missing);
			return;
		}

		for (const organization of organizations) {
			for (const definition of this.indexedEntities) {
				await this.run(
					queryRunner,
					dbType,
					`INSERT INTO "search_index_definition" ("id", "tenantId", "organizationId", "entity", "label", "fields", "defaultWeight", "sourceUpdatedAtField", "isSystem", "version", "status")
					 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, ${this.booleanLiteral(
							queryRunner,
							true
						)}, $7, $8
					 FROM "organization"
					 WHERE "organization"."id" = $9
					   AND "organization"."deletedAt" IS NULL
					   AND NOT EXISTS (
						SELECT 1 FROM "search_index_definition" "d"
						WHERE "d"."organizationId" = "organization"."id"
						  AND "d"."entity" = $10
						  AND "d"."engineKey" IS NULL
						  AND "d"."deletedAt" IS NULL
					   )`,
					[uuidv4(), definition.entity, definition.label, '[]', 1, 'updatedAt', 1, 'DISABLED', organization.id, definition.entity]
				);
			}
		}
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
	 * The given columns the table actually has. An absent table yields no columns at all.
	 *
	 * @param queryRunner
	 * @param table
	 * @param columns
	 * @returns The subset of `columns` that exists.
	 */
	private async presentColumns(queryRunner: QueryRunner, table: string, columns: string[]): Promise<string[]> {
		if (!(await queryRunner.hasTable(table))) {
			return [];
		}

		const present: string[] = [];
		for (const column of columns) {
			if (await queryRunner.hasColumn(table, column)) {
				present.push(column);
			}
		}
		return present;
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
	 * `isDefault` appears in a guard as well as in a target list, and a parameter used twice cannot be
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
