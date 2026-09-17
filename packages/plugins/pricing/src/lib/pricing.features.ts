import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin contributes.
 *
 * A flag decides whether a capability exists for a tenant at all; a permission decides who may use
 * it. Pricing therefore has one module flag and two finer flags that switch on an authoring shape
 * rather than a surface:
 *
 * - `FEATURE_PRICING` is on by default because price resolution falls back to the legacy variant
 *   retail price when no price list exists, so an enabled module with no data changes nothing
 *   observable — the sign that a module flag is safe to default on.
 * - `FEATURE_MULTI_CURRENCY` and `FEATURE_PRICE_TIERS` are off by default because each one changes
 *   what a caller must send and what a quantity selector returns: a single-currency, single-price
 *   tenant must never reach the conversion path or be offered a tier it does not use.
 */
export const PRICING_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_PRICING',
		name: 'Pricing',
		description:
			'Price lists, product prices with quantity tiers and windows, tax-inclusivity preferences and the price resolution endpoints.',
		icon: 'pricetags-outline',
		defaultEnabled: true
	},
	{
		code: 'FEATURE_MULTI_CURRENCY',
		name: 'Multi-currency pricing',
		description:
			'More than one currency on a channel: foreign-exchange rates, currency-specific prices and conversion of a resolved amount.',
		icon: 'swap-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_PRICING']
	},
	{
		code: 'FEATURE_PRICE_TIERS',
		name: 'Price tiers',
		description:
			'Quantity-band prices and per-customer-group prices, which change what a given quantity resolves to.',
		icon: 'layers-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_PRICING']
	}
];
