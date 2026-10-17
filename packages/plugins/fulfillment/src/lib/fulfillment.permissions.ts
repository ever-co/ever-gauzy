import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * Carries a permission value this plugin declares.
 *
 * The platform's permission catalogue is a closed enumeration and this package must not edit it: a
 * plugin's permissions are contributed through the plugin metadata and unioned into the catalogue at
 * bootstrap, so the value is an ordinary string by the time a guard reads it.
 *
 * @param value The permission value.
 * @returns The value in the shape the guard reads its metadata in.
 */
const permission = (value: string): PermissionsEnum => value as PermissionsEnum;

/**
 * The permissions this plugin declares.
 *
 * A shipping profile is a property of the shipping configuration rather than a resource with a life of
 * its own, so it is folded into the shipping-option permissions: the same person edits both, and a
 * separate set would double every role definition for one screen.
 */
export const FULFILLMENT_PERMISSIONS = {
	/** Read fulfilments with their lines, tracking and labels. */
	FULFILLMENTS_VIEW: permission('FULFILLMENTS_VIEW'),
	/** Create a fulfilment, partially or in full. */
	FULFILLMENTS_CREATE: permission('FULFILLMENTS_CREATE'),
	/** Update tracking, ship, deliver or cancel a fulfilment. */
	FULFILLMENTS_EDIT: permission('FULFILLMENTS_EDIT'),
	/** Read shipping options and profiles, and calculate the options available to a cart. */
	SHIPPING_OPTIONS_VIEW: permission('SHIPPING_OPTIONS_VIEW'),
	/** Create a shipping option or a shipping profile. */
	SHIPPING_OPTIONS_CREATE: permission('SHIPPING_OPTIONS_CREATE'),
	/** Update options and profiles, and assign variants to a profile. */
	SHIPPING_OPTIONS_EDIT: permission('SHIPPING_OPTIONS_EDIT'),
	/** Delete an option or a profile. */
	SHIPPING_OPTIONS_DELETE: permission('SHIPPING_OPTIONS_DELETE')
} as const;

/**
 * The permission catalogue entries this plugin contributes to the platform role model.
 */
export const FULFILLMENT_PERMISSION_CONTRIBUTIONS: PluginPermissionContribution[] = [
	{
		value: 'FULFILLMENTS_VIEW',
		label: 'View fulfillments',
		group: 'GENERAL',
		description: 'Read fulfilments with their lines, tracking, labels, pack slips and manifests.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'FULFILLMENTS_CREATE',
		label: 'Create fulfillments',
		group: 'GENERAL',
		description: 'Create a fulfilment for an order, partially or in full.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'FULFILLMENTS_EDIT',
		label: 'Edit fulfillments',
		group: 'GENERAL',
		description: 'Update tracking, ship, deliver or cancel a fulfilment.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SHIPPING_OPTIONS_VIEW',
		label: 'View shipping options',
		group: 'GENERAL',
		description:
			'Read shipping options and profiles, and calculate which options are available to a cart.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SHIPPING_OPTIONS_CREATE',
		label: 'Create shipping options',
		group: 'GENERAL',
		description: 'Create a shipping option or a shipping profile.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SHIPPING_OPTIONS_EDIT',
		label: 'Edit shipping options',
		group: 'GENERAL',
		description: 'Update options and profiles, and assign variants to a profile.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SHIPPING_OPTIONS_DELETE',
		label: 'Delete shipping options',
		group: 'GENERAL',
		description: 'Delete a shipping option or a shipping profile.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
