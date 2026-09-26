import { FeatureEnum } from '@gauzy/contracts';
import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature codes this plugin gates its endpoints with.
 *
 * @param code The feature code.
 * @returns The code, as the platform feature enum.
 */
function feature(code: string): FeatureEnum {
	return code as unknown as FeatureEnum;
}

/**
 * Feature flags the purchasing domain uses.
 *
 * The module flag is read through `@FeatureFlag` on every controller this plugin registers, so a
 * tenant that does not run procurement carries the tables (empty) and none of the endpoints.
 */
export const PurchasingFeatures = {
	/** Purchase orders and goods receipts. */
	PURCHASING: feature('FEATURE_PURCHASING')
} as const;

/**
 * The feature catalogue this plugin contributes.
 *
 * The flag defaults to off: procurement is a separate process with its own approval policy, and
 * enabling it by default would expose the purchase-order endpoints to tenants that keep no supplier
 * data at all.
 */
export const PURCHASING_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_PURCHASING',
		name: 'Purchasing',
		description:
			'Raise purchase orders against a supplier, receive goods against them, and let the receipt write the stock movements that make the goods sellable.',
		icon: 'shopping-cart-outline',
		defaultEnabled: false
	}
];
