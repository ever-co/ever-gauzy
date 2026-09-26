import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission catalogue this plugin contributes.
 *
 * The values are the ones the platform permission model unions in at bootstrap, so a role can be
 * granted a pricing capability exactly like a built-in one. The naming follows the platform
 * convention — resource, underscore, action, both upper case — and the resource is the API path
 * (`/price-lists` → `PRICE_LISTS`), so a route and its permission can be read against each other
 * without a translation table.
 *
 * Two values are administrative rather than operational, because the blast radius of getting them
 * wrong reaches every price in the tenant rather than one row: `PRODUCT_PRICES_BULK_EDIT` writes
 * the whole matrix in one call, and `EXCHANGE_RATES_EDIT` changes the conversion applied to every
 * foreign-currency amount. Both are listed under `ADMINISTRATION` so a role editor only offers them
 * to an administrator; everything else is routine authoring and is listed under `GENERAL`.
 */
export const PRICING_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'PRICE_LISTS_VIEW',
		label: 'View price lists',
		group: 'GENERAL',
		description: 'Read price lists with their rules and price counts.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRICE_LISTS_CREATE',
		label: 'Create price lists',
		group: 'GENERAL',
		description: 'Create a price list.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRICE_LISTS_EDIT',
		label: 'Edit price lists',
		group: 'GENERAL',
		description: 'Update a price list and activate it.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRICE_LISTS_DELETE',
		label: 'Delete price lists',
		group: 'GENERAL',
		description: 'Delete a price list and the prices it carries.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRICE_LISTS_SIMULATE',
		label: 'Simulate price resolution',
		group: 'GENERAL',
		description: 'Dry-run price resolution for an arbitrary context without writing anything.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRODUCT_PRICES_VIEW',
		label: 'View product prices',
		group: 'GENERAL',
		description: 'Read product prices, resolve an effective price, and read tax-inclusivity preferences.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRODUCT_PRICES_EDIT',
		label: 'Edit product prices',
		group: 'GENERAL',
		description: 'Create, update and delete product prices, and maintain price preferences.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'PRODUCT_PRICES_BULK_EDIT',
		label: 'Bulk edit product prices',
		group: 'ADMINISTRATION',
		description: 'Run the price matrix bulk endpoint, including its replace mode.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: 'EXCHANGE_RATES_VIEW',
		label: 'View exchange rates',
		group: 'GENERAL',
		description: 'Read foreign-exchange rates.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'EXCHANGE_RATES_EDIT',
		label: 'Edit exchange rates',
		group: 'ADMINISTRATION',
		description: 'Create, update and delete rates and trigger a provider sync.',
		defaultFor: ['SUPER_ADMIN']
	}
];

/**
 * The contributed permission values by name.
 *
 * Declared as data rather than as members of the platform enumeration, because a plugin owns its
 * own values and the platform unions them in at bootstrap; this object is what the controllers and
 * resolvers read so that no permission string is ever written twice.
 */
export const PRICING_PERMISSION_VALUES = {
	PRICE_LISTS_VIEW: 'PRICE_LISTS_VIEW',
	PRICE_LISTS_CREATE: 'PRICE_LISTS_CREATE',
	PRICE_LISTS_EDIT: 'PRICE_LISTS_EDIT',
	PRICE_LISTS_DELETE: 'PRICE_LISTS_DELETE',
	PRICE_LISTS_SIMULATE: 'PRICE_LISTS_SIMULATE',
	PRODUCT_PRICES_VIEW: 'PRODUCT_PRICES_VIEW',
	PRODUCT_PRICES_EDIT: 'PRODUCT_PRICES_EDIT',
	PRODUCT_PRICES_BULK_EDIT: 'PRODUCT_PRICES_BULK_EDIT',
	EXCHANGE_RATES_VIEW: 'EXCHANGE_RATES_VIEW',
	EXCHANGE_RATES_EDIT: 'EXCHANGE_RATES_EDIT'
} as const;

/**
 * Narrows a contributed permission value to the platform enumeration.
 *
 * The guard decorators are typed against `PermissionsEnum`, and the contributed values become
 * members of that enumeration only once the plugin is registered. This helper states that
 * promotion in one place so a controller writes the contributed constant and gets the decorator's
 * type back, instead of scattering casts through the route definitions.
 *
 * @param value One of the values declared in `PRICING_PERMISSIONS`.
 * @returns The same value, typed as a platform permission.
 */
export function pricingPermission(value: string): PermissionsEnum {
	return value as PermissionsEnum;
}
