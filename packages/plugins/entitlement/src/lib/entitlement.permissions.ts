import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values this plugin declares.
 *
 * A value is read through the helper below rather than written as a bare string at each use site, so
 * the catalogue in `ENTITLEMENT_PERMISSIONS` and the guards on the controllers can never drift
 * apart. The cast is needed because the platform permission enum is extended with these values when
 * the plugin is registered; the string literals are the same in both places.
 *
 * @param value The permission value.
 * @returns The value, as the platform permission enum.
 */
function permission(value: string): PermissionsEnum {
	return value as unknown as PermissionsEnum;
}

/**
 * Permission values used by the entitlement controllers.
 *
 * Three values, not one "manage" value, because the three things an operator does here are held by
 * different people: reading what a customer holds is a support task, granting a right that no order
 * produced is a commercial decision, and suspending, extending or revoking one is an intervention
 * that has to be auditable on its own.
 */
export const EntitlementPermissions = {
	/** Read entitlements, their activations and their issued keys. */
	ENTITLEMENTS_VIEW: permission('ENTITLEMENTS_VIEW'),
	/** Grant an entitlement that no order produced, and issue a key for it. */
	ENTITLEMENTS_GRANT: permission('ENTITLEMENTS_GRANT'),
	/** Suspend, resume, extend or revoke an entitlement; release an activation; revoke or re-issue a key. */
	ENTITLEMENTS_EDIT: permission('ENTITLEMENTS_EDIT')
} as const;

/** Every permission value the plugin guards with, as a plain list. */
export const ENTITLEMENT_PERMISSION_VALUES: PermissionsEnum[] = Object.values(EntitlementPermissions);

/**
 * The permission catalogue this plugin contributes to the platform role model.
 *
 * Contributed values are unioned into the catalogue at bootstrap, so a role can be granted one
 * exactly like a built-in permission and an installation that does not load the plugin never sees
 * them.
 */
export const ENTITLEMENT_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'ENTITLEMENTS_VIEW',
		label: 'View entitlements',
		group: 'GENERAL',
		description: 'Read entitlements, their activations and their issued keys.'
	},
	{
		value: 'ENTITLEMENTS_GRANT',
		label: 'Grant entitlements',
		group: 'GENERAL',
		description: 'Grant an entitlement that no order produced, and issue a licence key for it.'
	},
	{
		value: 'ENTITLEMENTS_EDIT',
		label: 'Edit entitlements',
		group: 'GENERAL',
		description:
			'Suspend, resume, extend or revoke an entitlement; release an activation; revoke or re-issue a licence key.'
	}
];
