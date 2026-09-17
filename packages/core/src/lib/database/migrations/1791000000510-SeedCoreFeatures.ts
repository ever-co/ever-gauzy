import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One catalogue row.
 *
 * The shape mirrors a `DEFAULT_FEATURES` entry in `packages/core/src/lib/feature/default-features.ts`,
 * so a row written here and a row written by the fresh-install seed are the same row as far as every
 * reader is concerned.
 */
interface ISeedFeature {
	/** Human readable name shown wherever features are listed. */
	name: string;
	/** Feature code. Upper snake case, `FEATURE_` prefixed. */
	code: string;
	/** One line explaining what the flag enables. */
	description: string;
	/** `feature.image` is nullable and no commerce flag ships artwork, so it is left empty. */
	image: string | null;
	/** Where an administrator is taken when the feature is selected. `feature.link` is NOT NULL. */
	link: string;
	/** Presentation only: `info` / `primary` / `success` / `warning`. */
	status: string;
	/** Presentation only. */
	icon: string;
	/** Whether a tenant provisioned from scratch gets an enabled toggle row. */
	defaultEnabled: boolean;
}

/**
 * The module flags: one per capability area.
 *
 * Every code is a **string**, not a `FeatureEnum` member, for the same reason a plugin's permission
 * value is a string: the compiled enum is the platform's own list and a package does not edit it to
 * register itself. `feature.code` is a varchar holding this text, the plugins declare these codes as
 * text, and the guard compares text — so this is the value, not a cast of one.
 */
const MODULE_FEATURES: ISeedFeature[] = [
	{
		name: 'Orders',
		code: 'FEATURE_ORDER',
		description: 'Orders, order lines, order changes, the order timeline and the invoice bridge.',
		image: null,
		link: 'pages/sales/orders',
		status: 'success',
		icon: 'file-text-outline',
		defaultEnabled: true
	},
	{
		name: 'Cart',
		code: 'FEATURE_CART',
		description: 'The cart family and the checkout session that turns a cart into an order.',
		image: null,
		link: 'pages/sales/carts',
		status: 'success',
		icon: 'shopping-cart-outline',
		defaultEnabled: true
	},
	{
		name: 'Catalog',
		code: 'FEATURE_CATALOG',
		description:
			'Product and collection publication, variant facets, relations and the catalog bulk endpoint.',
		image: null,
		link: 'pages/catalog/products',
		status: 'success',
		icon: 'shopping-bag-outline',
		defaultEnabled: true
	},
	{
		name: 'Pricing',
		code: 'FEATURE_PRICING',
		description: 'Price lists, product prices, price preferences, exchange rates and the simulate endpoints.',
		image: null,
		link: 'pages/catalog/price-lists',
		status: 'success',
		icon: 'pricetags-outline',
		defaultEnabled: true
	},
	{
		name: 'Tax',
		code: 'FEATURE_TAX',
		description: 'Tax categories, tax rates and the resolution a document is taxed through.',
		image: null,
		link: 'pages/catalog/tax-rates',
		status: 'success',
		icon: 'file-text-outline',
		defaultEnabled: true
	},
	{
		name: 'Promotions',
		code: 'FEATURE_PROMOTION',
		description: 'Promotions, campaigns, coupons and the discount engine that evaluates them.',
		image: null,
		link: 'pages/marketing/promotions',
		status: 'success',
		icon: 'pricetags-outline',
		defaultEnabled: true
	},
	{
		name: 'Inventory ledger and reservations',
		code: 'FEATURE_INVENTORY',
		description: 'Movements, reservations, transfers, alerts, adjustments, counts and reconciliation.',
		image: null,
		link: 'pages/inventory/stock-levels',
		status: 'success',
		icon: 'cube-outline',
		defaultEnabled: true
	},
	{
		name: 'GraphQL',
		code: 'FEATURE_GRAPHQL',
		description: 'The GraphQL endpoint and its resolvers, under the same guards and permissions as REST.',
		image: null,
		link: 'settings/features',
		status: 'success',
		icon: 'git-network-outline',
		defaultEnabled: true
	},
	{
		name: 'Warehouse management',
		code: 'FEATURE_WAREHOUSE',
		description: 'Zones, bins, pick waves, pick lists, packing and carrier manifests.',
		image: null,
		link: 'pages/inventory/warehouse',
		status: 'info',
		icon: 'cube-outline',
		defaultEnabled: false
	},
	{
		name: 'Fulfillment',
		code: 'FEATURE_FULFILLMENT',
		description: 'Shipping profiles and options, fulfillments, labels and the packing and manifest flow.',
		image: null,
		link: 'pages/sales/fulfillments',
		status: 'info',
		icon: 'cube-outline',
		defaultEnabled: false
	},
	{
		name: 'Returns, claims and exchanges',
		code: 'FEATURE_RETURNS',
		description: 'The post-purchase flows: returns, claims and exchanges, with their reasons and stock effects.',
		image: null,
		link: 'pages/sales/returns',
		status: 'info',
		icon: 'undo-outline',
		defaultEnabled: false
	},
	{
		name: 'Subscriptions and recurring billing',
		code: 'FEATURE_SUBSCRIPTION',
		description: 'Plans, subscriptions and the billing history; recurring charges are a separate flag.',
		image: null,
		link: 'pages/sales/subscriptions',
		status: 'info',
		icon: 'repeat-outline',
		defaultEnabled: false
	},
	{
		name: 'Purchasing',
		code: 'FEATURE_PURCHASING',
		description: 'Purchase orders, vendor terms and goods receipts.',
		image: null,
		link: 'pages/purchasing/purchase-orders',
		status: 'info',
		icon: 'shopping-cart-outline',
		defaultEnabled: false
	},
	{
		name: 'Entitlements, activations and licence keys',
		code: 'FEATURE_ENTITLEMENT',
		description: 'Entitlements, their activations and the keys issued against them.',
		image: null,
		link: 'pages/sales/entitlements',
		status: 'info',
		icon: 'key-outline',
		defaultEnabled: false
	},
	{
		name: 'Marketplace',
		code: 'FEATURE_MARKETPLACE',
		description: 'Sellers, offerings, commission, payouts and settlements.',
		image: null,
		link: 'pages/marketplace/sellers',
		status: 'info',
		icon: 'storefront-outline',
		defaultEnabled: false
	},
	{
		name: 'Global search',
		code: 'FEATURE_SEARCH',
		description: 'The search, suggest and facet endpoints and the index definitions they read.',
		image: null,
		link: 'pages/search',
		status: 'info',
		icon: 'search-outline',
		defaultEnabled: false
	}
];

/** The finer-grained flags: one behaviour inside a module, or one capability that reaches outside it. */
const DETAIL_FEATURES: ISeedFeature[] = [
	{
		name: 'Multi-currency pricing',
		code: 'FEATURE_MULTI_CURRENCY',
		description: 'More than one currency on a channel: exchange-rate use, currency overrides and FX conversion.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'swap-outline',
		defaultEnabled: false
	},
	{
		name: 'Multi-region pricing',
		code: 'FEATURE_MULTI_REGION',
		description: 'More than one region per channel, with region-specific tax and shipping.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'globe-outline',
		defaultEnabled: false
	},
	{
		name: 'Multi-location allocation',
		code: 'FEATURE_MULTI_WAREHOUSE',
		description: 'Allocation split across stock locations, per-location availability and transfers between them.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'cube-outline',
		defaultEnabled: false
	},
	{
		name: 'B2B credit',
		code: 'FEATURE_B2B_CREDIT',
		description: 'Credit limits, settlement terms, period spending limits and the credit check at placement.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'card-outline',
		defaultEnabled: false
	},
	{
		name: 'Order approvals',
		code: 'FEATURE_ORDER_APPROVALS',
		description: 'Routing an order through the approval module before it is placed.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'checkmark-circle-outline',
		defaultEnabled: false
	},
	{
		name: 'Gift cards',
		code: 'FEATURE_GIFT_CARDS',
		description: 'Issuing and redeeming gift cards, and the balance lookup endpoint.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'card-outline',
		defaultEnabled: false
	},
	{
		name: 'Webhooks',
		code: 'FEATURE_WEBHOOKS',
		description: 'Outbound webhook subscriptions and their deliveries.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'flash-outline',
		defaultEnabled: false
	},
	{
		name: 'External search engine',
		code: 'FEATURE_EXTERNAL_SEARCH',
		description: 'Using an external engine instead of the built-in database provider for global search.',
		image: null,
		link: 'pages/search/engine',
		status: 'info',
		icon: 'cloud-upload-outline',
		defaultEnabled: false
	},
	{
		name: 'Serve reads from the search index',
		code: 'FEATURE_SEARCH_INDEX',
		description: 'Routing reads to the search projection rather than to the source tables.',
		image: null,
		link: 'pages/search/index',
		status: 'info',
		icon: 'layers-outline',
		defaultEnabled: false
	},
	{
		name: 'Backorders',
		code: 'FEATURE_BACKORDERS',
		description: 'Allowing an order for more than is on hand, and the backorderable availability response.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'alert-circle-outline',
		defaultEnabled: false
	},
	{
		name: 'Price tiers',
		code: 'FEATURE_PRICE_TIERS',
		description: 'Quantity-band prices and per-contact-group prices.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'layers-outline',
		defaultEnabled: false
	},
	{
		name: 'Bulk API',
		code: 'FEATURE_BULK_API',
		description: 'The batch authoring endpoints.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'layers-outline',
		defaultEnabled: false
	},
	{
		name: 'Data export',
		code: 'FEATURE_DATA_EXPORT',
		description: 'Streaming exports of the catalog and of the order documents.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'download-outline',
		defaultEnabled: false
	},
	{
		name: 'Tax provider',
		code: 'FEATURE_TAX_PROVIDER',
		description: 'Delegating tax calculation to an external engine through configured integration credentials.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'cloud-upload-outline',
		defaultEnabled: false
	},
	{
		name: 'Subscription billing run',
		code: 'FEATURE_SUBSCRIPTION_BILLING',
		description: 'The recurring billing run and the automatic charge path.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'repeat-outline',
		defaultEnabled: false
	},
	{
		name: 'Scheduled seller payouts',
		code: 'FEATURE_SELLER_PAYOUT_SCHEDULER',
		description: 'Automatic payout runs on a seller payout schedule.',
		image: null,
		link: 'settings/features',
		status: 'info',
		icon: 'calendar-outline',
		defaultEnabled: false
	}
];

/**
 * Codes this programme reuses rather than introduces.
 *
 * They are inserted **only when absent**, so a deployment whose catalogue already carries them
 * converges on the same rows without this migration touching an administrator's existing toggle. They
 * get no toggle rows at all: a deployment that has the code already has whatever toggle it chose, and
 * one that does not is not this migration's to switch on.
 */
const REUSED_FEATURES: ISeedFeature[] = [
	{
		name: 'Payment',
		code: 'FEATURE_PAYMENT',
		description: 'Manage Payment, Create First Payment',
		image: 'payment.png',
		link: 'accounting/payments',
		status: 'success',
		icon: 'file-text-outline',
		defaultEnabled: false
	},
	{
		name: 'Lead, Customer & Client',
		code: 'FEATURE_CONTACT',
		description: 'Manage Leads, Customers and Clients, Create First Customer/Clients',
		image: 'contact.png',
		link: 'contacts/customers',
		status: 'info',
		icon: 'file-text-outline',
		defaultEnabled: false
	}
];

/** Every code this migration writes a catalogue row for: the new ones, then the reused pair. */
const ALL_FEATURES: ISeedFeature[] = [...MODULE_FEATURES, ...DETAIL_FEATURES, ...REUSED_FEATURES];

/** The features a live tenant gets an enabled toggle row for. */
const ENABLED_FEATURES: ISeedFeature[] = [...MODULE_FEATURES, ...DETAIL_FEATURES].filter(
	(feature) => feature.defaultEnabled
);

/**
 * The second of the three data-only kernel migrations: the feature seed.
 *
 * Permissions decide *who* may do something inside a tenant; a feature flag decides *whether* the
 * capability exists for that tenant at all. Both are per-tenant data, so a catalogue row written at
 * provisioning time never reaches a tenant that is already provisioned — the flags the new packages
 * carry would resolve to nothing, and `Store.hasFeatureEnabled()` reads a missing toggle row as
 * **disabled**.
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

		const seeded = [...MODULE_FEATURES, ...DETAIL_FEATURES];

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
		for (const feature of ALL_FEATURES) {
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
		for (const feature of ENABLED_FEATURES) {
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
		for (const feature of ALL_FEATURES) {
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
		for (const feature of ENABLED_FEATURES) {
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
		for (const feature of ALL_FEATURES) {
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
		for (const feature of ENABLED_FEATURES) {
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
