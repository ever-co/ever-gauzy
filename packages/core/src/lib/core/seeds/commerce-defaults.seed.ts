import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';
import { IOrganization } from '@gauzy/contracts';
import { replacePlaceholders } from '../utils';
import {
	DEFAULT_UNIT_FAMILIES,
	DEFAULT_UNIT_REFERENCE_SETTING_KEYS
} from '../../measurement/default-unit-families';

/**
 * The defaults an organization needs before it can issue a single document.
 *
 * ## The three paths that write them, and why there are three
 *
 * `1791000000520-SeedCoreDefaults` seeds them **for every organization that exists when it runs**. On an
 * installation that is being upgraded that is exactly right: the organizations are already there. It
 * seeds nothing for an organization created afterwards, and two kinds are:
 *
 * - the organizations a **fresh installation** creates after the migrations, through `SeedDataService`;
 * - every organization **created at runtime** — a new tenant's first organization, a second organization
 *   of an existing tenant, a client's organization provisioned from an invite — through
 *   `OrganizationCommerceDefaultsCreateCommand`, which the organization-create paths dispatch.
 *
 * Both of those call this function. Before it ran at runtime, an organization a user created had no
 * numbering series at all, so its first order failed with 404 "No numbering series is configured for
 * ORDER" and its first purchase order with 409 `PURCHASE_ORDER_SEQUENCE_MISSING` (R5-05).
 *
 * ## They must agree with the migration
 *
 * Every statement below is `1791000000520`'s own per-organization statement, with the same values and
 * the same guards, in the same order: the default channel, the default region and its channel link,
 * the default tax category, the currency price preference, the measurement families with their
 * reference units (and the variant stock-unit backfill and the three tenant-scoped unit settings that
 * point at them), the seven numbering series (plus `SELLER_PAYOUT`, which `1791000000790` seeds with the same
 * statement) and the search definitions. The migration's slug backfill
 * is not per organization and a new organization has no products, so it is not repeated here. `commerce-defaults.seed.spec.ts` runs the migration for one organization and this
 * function for another on the same schema and compares the rows, so a change to one that is not made to
 * the other fails a test instead of shipping two kinds of organization.
 *
 * ## Plugin tables may be absent
 *
 * `tax_category` belongs to the tax plugin and `price_preference` to the pricing plugin, and an
 * installation may run without either. Every step is therefore guarded by **schema** as well as by
 * **row**: a step whose table or columns are not there is skipped with one line naming what was missing,
 * exactly as the migration skips it, and the rest still run. A missing plugin never stops an organization
 * from being created.
 *
 * ## Idempotence
 *
 * Every insert is `INSERT … SELECT … WHERE NOT EXISTS` against the row's own uniqueness — the channel,
 * the region, the tax category, the unit family and the unit by `(organizationId, code)`, the series by
 * `(organizationId, key, channelId IS NULL)`, the search definition by `(organizationId, entity, engineKey
 * IS NULL)` — so running this again, or after the migration, creates nothing, and an administrator who
 * edited a default keeps the edit. That matters more than it looks: a second `ORDER` series would restart
 * numbering from one and two documents would carry the same number.
 *
 * Each organization is written in its own transaction, so an organization never ends up with half a set.
 *
 * @param dataSource The connection to write on.
 * @param organizations The organizations to seed for. Only `id` is read; the tenant and the currency are
 * read from the organization's own row, as the migration reads them.
 */
export async function createDefaultCommerceDefaults(
	dataSource: DataSource,
	organizations: Array<Pick<IOrganization, 'id'>>
): Promise<void> {
	const organizationIds = [
		...new Set((organizations ?? []).map((organization) => organization?.id).filter((id): id is string => !!id))
	];

	if (organizationIds.length === 0) {
		return;
	}

	const queryRunner = dataSource.createQueryRunner();

	try {
		await queryRunner.connect();

		const writer = new CommerceDefaultsWriter(queryRunner);
		const plan = await writer.plan();

		if (!plan) {
			return;
		}

		for (const organizationId of organizationIds) {
			await queryRunner.startTransaction();

			try {
				await writer.seed(organizationId, plan);
				await queryRunner.commitTransaction();
			} catch (error) {
				await queryRunner.rollbackTransaction();
				throw error;
			}
		}
	} finally {
		await queryRunner.release();
	}
}

/**
 * The numbering series every organization needs before it can issue a document: `1791000000520`'s seven, then
 * `SELLER_PAYOUT`, which `1791000000790-SeedSellerPayoutSequence` seeds for the organizations that existed before
 * it (the marketplace numbers its seller payouts from it).
 */
export const DEFAULT_SEQUENCE_SERIES: ReadonlyArray<{ key: string; prefix: string }> = [
	{ key: 'ORDER', prefix: 'SO-' },
	{ key: 'RETURN', prefix: 'RT-' },
	{ key: 'CLAIM', prefix: 'CL-' },
	{ key: 'EXCHANGE', prefix: 'EX-' },
	{ key: 'PO', prefix: 'PO-' },
	{ key: 'SUBSCRIPTION', prefix: 'SUB-' },
	{ key: 'ENTITLEMENT', prefix: 'EN-' },
	{ key: 'SELLER_PAYOUT', prefix: 'SP-' }
];

/** The code, name and order numbering the default channel is created with. */
const DEFAULT_CHANNEL = { code: 'DEFAULT', name: 'Default channel', orderPrefix: 'SO-', padding: 6 };

/** The code and name the default region is created with. */
const DEFAULT_REGION = { code: 'DEFAULT', name: 'Default region' };

/** The tax category every rate hangs off until an organization declares its own. */
const DEFAULT_TAX_CATEGORY = {
	code: 'DEFAULT',
	name: 'Standard',
	description: 'The tax category every rate hangs off until an organization declares its own.'
};

/** The entity kinds global search declares a (disabled) built-in definition for. */
const SEARCH_DEFINITIONS: ReadonlyArray<{ entity: string; label: string }> = [
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

/** Which steps the schema supports. Read once per call, not once per organization. */
interface ICommerceDefaultsPlan {
	channel: boolean;
	region: boolean;
	taxCategory: boolean;
	pricePreference: boolean;
	units: boolean;
	variantBackfill: boolean;
	unitSettings: boolean;
	sequences: boolean;
	channelTable: boolean;
	searchDefinitions: boolean;
}

/**
 * The per-organization statements of `1791000000520`, run for one organization at a time.
 */
class CommerceDefaultsWriter {
	private readonly logger = new Logger('CommerceDefaults');
	private readonly dbType: DatabaseTypeEnum;

	constructor(private readonly queryRunner: QueryRunner) {
		this.dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
	}

	/**
	 * Reads which steps the schema supports, and logs one line for every step it does not.
	 *
	 * @returns The plan, or undefined when not even the organization table can be read.
	 */
	async plan(): Promise<ICommerceDefaultsPlan | undefined> {
		const skipped: string[] = [];
		const check = async (step: string, missing: string[]): Promise<boolean> => {
			if (missing.length > 0) {
				skipped.push(`${step} (missing: ${missing.join(', ')})`);
				return false;
			}
			return true;
		};

		const organizationMissing = await this.missingSchema('organization', ['tenantId', 'currency']);
		if (organizationMissing.length > 0) {
			this.logger.warn(`Skipping every commerce default — missing: ${organizationMissing.join(', ')}.`);
			return undefined;
		}

		const plan: ICommerceDefaultsPlan = {
			channel: await check(
				'the default channel',
				await this.missingSchema('channel', [
					'tenantId',
					'organizationId',
					'name',
					'code',
					'status',
					'isDefault',
					'defaultCurrency',
					'orderNumberPrefix',
					'orderNumberPadding'
				])
			),
			region: await check('the default region and its channel link', [
				...(await this.missingSchema('region', [
					'tenantId',
					'organizationId',
					'name',
					'code',
					'currency',
					'isDefault',
					'isTaxInclusive',
					'status'
				])),
				...(await this.missingSchema('channel_region', ['channelId', 'regionId', 'isDefault']))
			]),
			taxCategory: await check(
				'the default tax category',
				await this.missingSchema('tax_category', [
					'tenantId',
					'organizationId',
					'name',
					'code',
					'description',
					'isDefault'
				])
			),
			pricePreference: await check(
				'the currency price preference',
				await this.missingSchema('price_preference', [
					'tenantId',
					'organizationId',
					'attribute',
					'value',
					'isTaxInclusive'
				])
			),
			units: await check('the measurement families and their reference units', [
				...(await this.missingSchema('unit_category', ['tenantId', 'organizationId', 'code', 'name', 'isSystem'])),
				...(await this.missingSchema('unit', [
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
			]),
			variantBackfill: false,
			unitSettings: false,
			sequences: await check(
				'the numbering series',
				await this.missingSchema('sequence', [
					'tenantId',
					'organizationId',
					'key',
					'prefix',
					'padding',
					'nextValue',
					'step',
					'resetPolicy',
					'channelId'
				])
			),
			channelTable: await this.queryRunner.hasTable('channel'),
			searchDefinitions: await check(
				'the search index definitions',
				await this.missingSchema('search_index_definition', [
					'organizationId',
					'entity',
					'label',
					'fields',
					'defaultWeight',
					'sourceUpdatedAtField',
					'isSystem',
					'version',
					'status'
				])
			)
		};

		// The two steps that point at the seeded reference units only run when the units do.
		if (plan.units) {
			plan.variantBackfill = await check(
				'the variant stock-unit backfill',
				await this.missingSchema('product_variant', ['organizationId', 'stockUnitId'])
			);
			plan.unitSettings = await check(
				'the measurement default settings',
				await this.missingSchema('tenant_setting', ['tenantId', 'name', 'value'])
			);
		}

		// Debug, not log: on an installation without the tax or the pricing plugin the same steps are skipped for
		// every organization ever created, and a line per organization would only be noise.
		if (skipped.length > 0) {
			this.logger.debug(`Skipping commerce defaults this schema does not have yet: ${skipped.join('; ')}.`);
		}

		return plan;
	}

	/**
	 * Writes every supported default for one organization, in the migration's order.
	 *
	 * @param organizationId The organization to seed for.
	 * @param plan The steps the schema supports.
	 */
	async seed(organizationId: string, plan: ICommerceDefaultsPlan): Promise<void> {
		if (plan.channel) {
			await this.seedChannel(organizationId);
		}
		if (plan.region) {
			await this.seedRegion(organizationId);
		}
		if (plan.taxCategory) {
			await this.seedTaxCategory(organizationId);
		}
		if (plan.pricePreference) {
			await this.seedPricePreference(organizationId);
		}
		if (plan.units) {
			await this.seedUnits(organizationId, plan);
		}
		if (plan.sequences) {
			await this.seedSequences(organizationId, plan.channelTable);
		}
		if (plan.searchDefinitions) {
			await this.seedSearchDefinitions(organizationId);
		}
	}

	/** The default channel, carrying the organization's own currency. */
	private async seedChannel(organizationId: string): Promise<void> {
		await this.run(
			`INSERT INTO "channel" ("id", "tenantId", "organizationId", "name", "code", "status", "isDefault", "defaultCurrency", "orderNumberPrefix", "orderNumberPadding")
			 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, ${this.bool(true)}, "organization"."currency", $5, $6
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
				DEFAULT_CHANNEL.name,
				DEFAULT_CHANNEL.code,
				'ACTIVE',
				DEFAULT_CHANNEL.orderPrefix,
				DEFAULT_CHANNEL.padding,
				organizationId,
				DEFAULT_CHANNEL.code
			]
		);
	}

	/** The default region, in the default channel's currency, and the channel↔region link that publishes it. */
	private async seedRegion(organizationId: string): Promise<void> {
		await this.run(
			`INSERT INTO "region" ("id", "tenantId", "organizationId", "name", "code", "currency", "isDefault", "isTaxInclusive", "status")
			 SELECT $1, "channel"."tenantId", "channel"."organizationId", $2, $3, "channel"."defaultCurrency", ${this.bool(true)}, ${this.bool(false)}, $4
			 FROM "channel"
			 WHERE "channel"."organizationId" = $5
			   AND "channel"."isDefault" = ${this.bool(true)}
			   AND "channel"."deletedAt" IS NULL
			   AND NOT EXISTS (
				SELECT 1 FROM "region" "r"
				WHERE "r"."organizationId" = "channel"."organizationId"
				  AND "r"."code" = $6
				  AND "r"."deletedAt" IS NULL
			   )`,
			[uuidv4(), DEFAULT_REGION.name, DEFAULT_REGION.code, 'ACTIVE', organizationId, DEFAULT_REGION.code]
		);

		await this.run(
			`INSERT INTO "channel_region" ("id", "channelId", "regionId", "isDefault")
			 SELECT $1, "channel"."id", "region"."id", ${this.bool(true)}
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
			[uuidv4(), organizationId, organizationId, DEFAULT_CHANNEL.code, DEFAULT_REGION.code]
		);
	}

	/** The `Standard` tax category a first rate hangs off. */
	private async seedTaxCategory(organizationId: string): Promise<void> {
		await this.run(
			`INSERT INTO "tax_category" ("id", "tenantId", "organizationId", "name", "code", "description", "isDefault")
			 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, ${this.bool(true)}
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
				DEFAULT_TAX_CATEGORY.name,
				DEFAULT_TAX_CATEGORY.code,
				DEFAULT_TAX_CATEGORY.description,
				organizationId,
				DEFAULT_TAX_CATEGORY.code
			]
		);
	}

	/** The organization currency's price preference, tax-exclusive (the platform's existing default). */
	private async seedPricePreference(organizationId: string): Promise<void> {
		await this.run(
			`INSERT INTO "price_preference" ("id", "tenantId", "organizationId", "attribute", "value", "isTaxInclusive")
			 SELECT $1, "organization"."tenantId", "organization"."id", $2, "organization"."currency", ${this.bool(false)}
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
			[uuidv4(), 'CURRENCY', organizationId, 'CURRENCY']
		);
	}

	/**
	 * The physical measurement families and their reference units, then the variant backfill and the
	 * tenant-scoped settings that point at those references.
	 */
	private async seedUnits(organizationId: string, plan: ICommerceDefaultsPlan): Promise<void> {
		const references = new Map<string, string>();

		for (const family of DEFAULT_UNIT_FAMILIES) {
			await this.run(
				`INSERT INTO "unit_category" ("id", "tenantId", "organizationId", "code", "name", "isSystem")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, ${this.bool(true)}
				 FROM "organization"
				 WHERE "organization"."id" = $4
				   AND "organization"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "unit_category" "uc"
					WHERE "uc"."organizationId" = "organization"."id"
					  AND "uc"."code" = $5
					  AND "uc"."deletedAt" IS NULL
				   )`,
				[uuidv4(), family.category, family.categoryName, organizationId, family.category]
			);

			const category: Array<{ id: string }> =
				(await this.run(
					`SELECT "id" FROM "unit_category"
					 WHERE "organizationId" = $1 AND "code" = $2 AND "deletedAt" IS NULL
					 ORDER BY "id" ASC`,
					[organizationId, family.category]
				)) ?? [];
			const categoryId = category[0]?.id;
			if (!categoryId) {
				continue;
			}

			await this.run(
				`INSERT INTO "unit" ("id", "tenantId", "organizationId", "categoryId", "code", "name", "symbol", "factor", "isReference", "decimalPlaces", "isSystem")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, ${this.bool(true)}, $7, ${this.bool(true)}
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
					organizationId,
					family.reference
				]
			);

			const unit: Array<{ id: string }> =
				(await this.run(
					`SELECT "id" FROM "unit"
					 WHERE "organizationId" = $1 AND "code" = $2 AND "deletedAt" IS NULL
					 ORDER BY "id" ASC`,
					[organizationId, family.reference]
				)) ?? [];
			if (unit[0]?.id) {
				references.set(family.category, unit[0].id);
			}
		}

		const countUnitId = references.get('COUNT');
		if (plan.variantBackfill && countUnitId) {
			await this.run(
				`UPDATE "product_variant" SET "stockUnitId" = $1
				 WHERE "organizationId" = $2 AND "stockUnitId" IS NULL AND "deletedAt" IS NULL`,
				[countUnitId, organizationId]
			);
		}

		if (plan.unitSettings) {
			for (const setting of DEFAULT_UNIT_REFERENCE_SETTING_KEYS) {
				const unitId = references.get(setting.category);
				if (!unitId) {
					continue;
				}

				await this.run(
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
					[uuidv4(), setting.name, unitId, organizationId, setting.name]
				);
			}
		}
	}

	/**
	 * One organization-wide (`channelId` null) series per document kind. The prefix of `ORDER` and the
	 * padding of every series come from the organization's default channel when there is one.
	 */
	private async seedSequences(organizationId: string, channelTable: boolean): Promise<void> {
		let prefix = DEFAULT_CHANNEL.orderPrefix;
		let padding = DEFAULT_CHANNEL.padding;

		if (channelTable) {
			const channel: Array<{ orderNumberPrefix: string | null; orderNumberPadding: number | null }> =
				(await this.run(
					`SELECT "orderNumberPrefix", "orderNumberPadding" FROM "channel"
					 WHERE "organizationId" = $1 AND "isDefault" = ${this.bool(true)} AND "deletedAt" IS NULL
					 ORDER BY "id" ASC`,
					[organizationId]
				)) ?? [];
			if (channel[0]?.orderNumberPrefix) {
				prefix = channel[0].orderNumberPrefix;
			}
			if (channel[0]?.orderNumberPadding != null) {
				padding = channel[0].orderNumberPadding;
			}
		}

		for (const series of DEFAULT_SEQUENCE_SERIES) {
			await this.run(
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
					organizationId,
					series.key
				]
			);
		}
	}

	/** One built-in search definition per entity kind, declared `DISABLED` and not built. */
	private async seedSearchDefinitions(organizationId: string): Promise<void> {
		for (const definition of SEARCH_DEFINITIONS) {
			await this.run(
				`INSERT INTO "search_index_definition" ("id", "tenantId", "organizationId", "entity", "label", "fields", "defaultWeight", "sourceUpdatedAtField", "isSystem", "version", "status")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, ${this.bool(true)}, $7, $8
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
				[
					uuidv4(),
					definition.entity,
					definition.label,
					'[]',
					1,
					'updatedAt',
					1,
					'DISABLED',
					organizationId,
					definition.entity
				]
			);
		}
	}

	/** The tables and columns a step needs and the schema does not have. */
	private async missingSchema(table: string, columns: string[]): Promise<string[]> {
		if (!(await this.queryRunner.hasTable(table))) {
			return [`${table} (table)`];
		}

		const missing: string[] = [];
		for (const column of columns) {
			if (!(await this.queryRunner.hasColumn(table, column))) {
				missing.push(`${table}.${column}`);
			}
		}
		return missing;
	}

	/**
	 * A boolean as the dialect's own literal (a constant of this file, never caller input), because a
	 * parameter used in both a guard and a target list cannot be bound positionally once `$n` is `?`.
	 */
	private bool(value: boolean): string {
		if (this.dbType === DatabaseTypeEnum.postgres) {
			return value ? 'true' : 'false';
		}
		return value ? '1' : '0';
	}

	/**
	 * Runs one statement written with double-quoted identifiers and `$n` placeholders, translated to the
	 * connection's own dialect: backticks on MySQL, `?` on MySQL and SQLite. Every placeholder appears
	 * exactly once, which keeps the positional binding correct after the translation. The dialect is the
	 * connection's rather than the process configuration's, so a caller holding another connection is
	 * written in that connection's dialect.
	 */
	private async run(sql: string, parameters: unknown[] = []): Promise<any> {
		const quoted = this.dbType === DatabaseTypeEnum.mysql ? sql.replace(/"/g, '`') : sql;
		return await this.queryRunner.query(replacePlaceholders(quoted, this.dbType), parameters);
	}
}
