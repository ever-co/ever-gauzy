import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values the tax capability registers.
 *
 * The values are declared here rather than added to the platform's `PermissionsEnum`, because a package
 * contributes its own permissions through the plugin metadata and never edits a shared enum: the
 * catalogue unions `TAX_PERMISSIONS` into the role model at bootstrap, so a role can be granted these
 * exactly like a built-in permission, and an installation that does not load the plugin never sees them.
 */
export const TAX_PERMISSION_VALUES = {
	/** Read tax categories and the rates attached to them. */
	TAX_CATEGORIES_VIEW: 'TAX_CATEGORIES_VIEW',
	/** Create, update and delete tax categories. */
	TAX_CATEGORIES_EDIT: 'TAX_CATEGORIES_EDIT',
	/** Read rates, resolve a rate for an address and compute tax for a given amount. */
	TAX_RATES_VIEW: 'TAX_RATES_VIEW',
	/** Create, update, delete and bulk-upsert rates. */
	TAX_RATES_EDIT: 'TAX_RATES_EDIT'
} as const;

/**
 * A value of the tax permission set.
 */
export type TaxPermissionValue = (typeof TAX_PERMISSION_VALUES)[keyof typeof TAX_PERMISSION_VALUES];

/**
 * Types a contributed permission value as a platform permission.
 *
 * The guards and the `@Permissions()` decorator are typed with the platform enum, while a plugin's own
 * values only exist in the contribution registry. The cast is what lets a guarded route name a
 * contributed value without the plugin editing the shared enum; the value itself is what the registry
 * registers and what the guard resolves against the caller's role permissions.
 *
 * @param value One of the values of `TAX_PERMISSION_VALUES`.
 * @returns The same value, typed as a platform permission.
 */
export function taxPermission(value: string): PermissionsEnum {
	return value as PermissionsEnum;
}

/**
 * The permission catalogue the tax plugin contributes.
 */
export const TAX_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: TAX_PERMISSION_VALUES.TAX_CATEGORIES_VIEW,
		label: 'Read tax categories',
		group: 'GENERAL',
		description: 'Read tax categories and their rates.'
	},
	{
		value: TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT,
		label: 'Edit tax categories',
		group: 'GENERAL',
		description: 'Create, update and delete tax categories.'
	},
	{
		value: TAX_PERMISSION_VALUES.TAX_RATES_VIEW,
		label: 'Read tax rates',
		group: 'GENERAL',
		description: 'Read rates, resolve a rate for an address, and compute tax for a given amount.'
	},
	{
		value: TAX_PERMISSION_VALUES.TAX_RATES_EDIT,
		label: 'Edit tax rates',
		group: 'GENERAL',
		description: 'Create, update, delete and bulk-upsert tax rates.'
	}
];
