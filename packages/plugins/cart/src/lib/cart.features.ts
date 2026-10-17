import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin declares.
 *
 * A flag decides *whether* a capability exists for a tenant; a permission decides *who* may use it.
 * This package's flag is therefore about presence, not about authority: with it off, no cart endpoint
 * resolves at all.
 */
export const CART_FEATURE_CONTRIBUTIONS: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_CART',
		name: 'Cart',
		description:
			'The cart family and the checkout session. A prerequisite for orders; nothing happens until a caller creates a cart.',
		icon: 'shopping-cart-outline',
		link: '/pages/sales/carts',
		defaultEnabled: true
	}
];

/**
 * The setting keys this plugin reads.
 *
 * Declared rather than hard-coded so an operator can override any of them per tenant, per organization
 * or per channel without a code change; the values in the service are the documented fallbacks.
 */
export const CART_SETTING_CONTRIBUTIONS = [
	{
		key: 'cart.ttlHoursAnonymous',
		type: 'number' as const,
		default: 168,
		scope: 'TENANT' as const,
		description: 'How long a cart without a customer lives before it expires.'
	},
	{
		key: 'cart.ttlHoursCustomer',
		type: 'number' as const,
		default: 720,
		scope: 'TENANT' as const,
		description: 'How long a cart belonging to a known customer lives before it expires.'
	},
	{
		key: 'cart.abandonedAfterHours',
		type: 'number' as const,
		default: 24,
		scope: 'TENANT' as const,
		description: 'Inactivity after which a cart is marked abandoned and becomes a notification target.'
	},
	{
		key: 'checkout.lockTimeoutMinutes',
		type: 'number' as const,
		default: 15,
		scope: 'TENANT' as const,
		description: 'How long a running checkout may hold a cart before the lock is treated as stale.'
	}
];
