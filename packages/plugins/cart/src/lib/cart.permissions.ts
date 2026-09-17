import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * Carries a permission value this plugin declares.
 *
 * The platform's permission catalogue is a closed enumeration, and this package must not edit it —
 * a plugin's permissions are contributed through the plugin metadata and unioned into the catalogue at
 * bootstrap, so the value is an ordinary string by the time a guard reads it. The cast states exactly
 * that: the value is a declared permission, not a member of the static enum.
 *
 * @param value The permission value.
 * @returns The value in the shape the guard reads its metadata in.
 */
const permission = (value: string): PermissionsEnum => value as PermissionsEnum;

/**
 * The permissions this plugin declares.
 *
 * The resource is the same word the route uses — `/carts` → `CARTS` — so a route and its permission can
 * be read against each other without a translation table.
 */
export const CART_PERMISSIONS = {
	/** Inspect carts, their eligible shipping options and their validation report. */
	CARTS_VIEW: permission('CARTS_VIEW'),
	/** Create a cart, edit its lines, set its delivery choice and apply its promotions. */
	CARTS_EDIT: permission('CARTS_EDIT'),
	/** Delete or expire a cart. */
	CARTS_DELETE: permission('CARTS_DELETE'),
	/**
	 * Start a checkout session, complete its steps and complete the checkout.
	 *
	 * Separate from `CARTS_EDIT` because completion is the point at which a cart becomes a financial
	 * document: a role that may prepare a cart for a buyer must not therefore be able to place it.
	 */
	CARTS_CHECKOUT: permission('CARTS_CHECKOUT')
} as const;

/**
 * The permission catalogue entries this plugin contributes to the platform role model.
 */
export const CART_PERMISSION_CONTRIBUTIONS: PluginPermissionContribution[] = [
	{
		value: 'CARTS_VIEW',
		label: 'View carts',
		group: 'GENERAL',
		description: 'Read carts, their eligibility report and the shipping options available to them.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'CARTS_EDIT',
		label: 'Edit carts',
		group: 'GENERAL',
		description: 'Create carts, add, change and remove lines, set the delivery choice and apply promotions.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'CARTS_DELETE',
		label: 'Delete carts',
		group: 'GENERAL',
		description: 'Delete or expire a cart.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'CARTS_CHECKOUT',
		label: 'Complete checkout',
		group: 'GENERAL',
		description: 'Run a checkout session and complete a cart, producing an order.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
