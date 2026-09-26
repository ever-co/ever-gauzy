import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin contributes.
 *
 * `FEATURE_PROMOTION` gates the whole domain — the discount engine, campaigns, budgets and coupons.
 * It is enabled by default because evaluation is opt-in per cart: a tenant that has created no
 * promotion sees no behavioural change from the module being on, while a tenant that has created one
 * and finds it silently ignored would have no way to tell a misconfiguration from a switched-off
 * module.
 *
 * `FEATURE_GIFT_CARDS` is separate and off by default. A gift card is a liability on the balance
 * sheet — value is issued before it is spent — so switching it on is an accounting decision rather
 * than a merchandising one, and it must not happen because an operator enabled promotions.
 */
export const PROMOTION_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_PROMOTION',
		name: 'Promotions',
		description: 'Promotions, campaigns, budgets, coupons and the discount engine.',
		icon: 'pricetags-outline',
		defaultEnabled: true
	},
	{
		code: 'FEATURE_GIFT_CARDS',
		name: 'Gift cards',
		description: 'Issuing, redeeming and adjusting stored-value cards, and the balance lookup.',
		icon: 'card-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_PROMOTION']
	}
];
