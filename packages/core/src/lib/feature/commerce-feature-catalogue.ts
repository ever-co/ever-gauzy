/**
 * The commerce feature catalogue: one definition, read by both seed paths.
 *
 * A feature flag reaches a tenant through one of exactly two paths, and before this module existed
 * each path carried its own hand-written copy of the same list:
 *
 * 1. **An existing installation** is converged by `1791000000510-SeedCoreFeatures`, which writes a
 *    catalogue row per code and an enabled toggle row per default-on code.
 * 2. **A fresh installation** is provisioned by `createDefaultFeatureToggle` in `feature.seed.ts`,
 *    which *deletes* the `feature` and `feature_organization` rows and recreates only what
 *    `DEFAULT_FEATURES` lists — so anything missing from that list is not merely absent, it is wiped.
 *
 * Two copies of one catalogue drift the moment either is edited, and the second path's failure mode
 * is silent: a code the migration seeds and the seed does not is deleted again on the fresh install,
 * the guard resolves it as disabled, and an administrator has no row to switch on. This module is the
 * one definition; `default-features.ts` derives the fresh-install entries from it and the migration
 * imports it, so the metadata and the default status of every code below are stated once.
 *
 * Three properties are deliberate:
 *
 * - **`code` is a string, not a `FeatureEnum` member.** The compiled enum belongs to the platform and
 *   a package does not edit it to register itself. `feature.code` is a `varchar` holding this text,
 *   the packages declare these codes as text, and the guard compares text — so this is the value, not
 *   a cast of one.
 * - **`defaultEnabled` is the appendix B §4 default**: `true` for a code marked *on* (it gets a
 *   catalogue row **and** an enabled toggle row on both paths), `false` for a code marked *off* (it
 *   gets its catalogue row so an administrator can turn it on deliberately, and no *enabled* toggle —
 *   the migration writes no toggle row at all, and the fresh-install seed writes the toggle row
 *   `isEnabled: false`, which the guard resolves identically).
 * - **`image` is null for every code introduced here.** `feature.image` is nullable and no commerce
 *   flag ships artwork; the reused pair below is the exception and carries the filename its existing
 *   `DEFAULT_FEATURES` entry already names.
 */

/**
 * One catalogue row.
 *
 * The shape matches a `DEFAULT_FEATURES` entry in `default-features.ts` (`name`, `code`,
 * `description`, `image`, `link`, `status`, `icon`) plus the default status, so a row written by the
 * migration and a row written by the fresh-install seed are the same row as far as every reader is
 * concerned.
 */
export interface IFeatureCatalogueEntry {
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
 * The default-on eight are the ones whose capability is additive to an installation that already
 * holds the underlying tables — an enabled module with no data changes nothing observable. The
 * default-off ones are enabled by an explicit business decision (see the appendix's rationale
 * column), so they get a catalogue row and no enabled toggle.
 */
export const MODULE_FEATURES: IFeatureCatalogueEntry[] = [
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
export const DETAIL_FEATURES: IFeatureCatalogueEntry[] = [
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

/** The 32 codes this programme introduces: the module flags and the finer-grained flags. */
export const COMMERCE_CATALOGUE: IFeatureCatalogueEntry[] = [...MODULE_FEATURES, ...DETAIL_FEATURES];

/** The features a tenant provisioned from scratch gets an **enabled** toggle row for. */
export const DEFAULT_ENABLED_FEATURES: IFeatureCatalogueEntry[] = COMMERCE_CATALOGUE.filter(
	(feature) => feature.defaultEnabled
);

/**
 * Codes this programme reuses rather than introduces.
 *
 * They are inserted **only when absent**, so a deployment whose catalogue already carries them
 * converges on the same rows without the migration touching an administrator's existing toggle. They
 * get no toggle rows at all: a deployment that has the code already has whatever toggle it chose, and
 * one that does not is not the migration's to switch on.
 *
 * Their metadata is deliberately **not** restated here. `DEFAULT_FEATURES` already carries the one
 * definition of each — an entry this change must not alter — so the migration derives the reused rows
 * from `DEFAULT_FEATURES` itself and the two paths cannot disagree about a row neither of them owns.
 */
export const REUSED_FEATURE_CODES: string[] = ['FEATURE_PAYMENT', 'FEATURE_CONTACT'];
