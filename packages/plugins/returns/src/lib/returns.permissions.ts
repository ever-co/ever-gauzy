import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values this plugin declares.
 *
 * A value is read through the helper below rather than written as a bare string at each use site, so
 * the catalogue in `RETURNS_PERMISSIONS` and the guards on the controllers can never drift apart.
 * The cast is needed because the platform permission enum is extended with these values when the
 * plugin is registered; the string literals are the same in both places.
 *
 * @param value The permission value.
 * @returns The value, as the platform permission enum.
 */
function permission(value: string): PermissionsEnum {
	return value as unknown as PermissionsEnum;
}

/**
 * Permission values used by the returns, claims and exchanges controllers.
 *
 * Each write action has its own value rather than sharing one "manage" value: receiving goods back
 * changes stock and triggers money, approving decides whether the customer may ship at all, and a
 * warehouse role holds one without the others.
 */
export const ReturnsPermissions = {
	/** Read returns, their lines and the governed return reasons. */
	RETURNS_VIEW: permission('RETURNS_VIEW'),
	/** Create and update a return, cancel it, and maintain the return reasons. */
	RETURNS_CREATE: permission('RETURNS_CREATE'),
	/** Approve a requested return. */
	RETURNS_APPROVE: permission('RETURNS_APPROVE'),
	/** Reject a requested return. */
	RETURNS_REJECT: permission('RETURNS_REJECT'),
	/** Receive returned goods, trigger the refund and close the return. */
	RETURNS_RECEIVE: permission('RETURNS_RECEIVE'),
	/** Read claims and their lines. */
	CLAIMS_VIEW: permission('CLAIMS_VIEW'),
	/** Create and cancel a claim. */
	CLAIMS_CREATE: permission('CLAIMS_CREATE'),
	/** Approve (settle) or reject a claim. */
	CLAIMS_RESOLVE: permission('CLAIMS_RESOLVE'),
	/** Read exchanges and their lines. */
	EXCHANGES_VIEW: permission('EXCHANGES_VIEW'),
	/** Request and cancel an exchange. */
	EXCHANGES_CREATE: permission('EXCHANGES_CREATE'),
	/** Approve or reject an exchange (re-reserve, adjust payment). */
	EXCHANGES_RESOLVE: permission('EXCHANGES_RESOLVE')
} as const;

/**
 * The permission catalogue this plugin contributes to the platform role model.
 *
 * Contributed values are unioned into the catalogue at bootstrap, so a role can be granted one
 * exactly like a built-in permission and an installation that does not load the plugin never sees
 * them.
 */
export const RETURNS_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'RETURNS_VIEW',
		label: 'View returns',
		group: 'GENERAL',
		description: 'Read returns, their lines and the governed return reasons.'
	},
	{
		value: 'RETURNS_CREATE',
		label: 'Request returns',
		group: 'GENERAL',
		description: 'Create and update a return, cancel it, and maintain the return reasons.'
	},
	{
		value: 'RETURNS_APPROVE',
		label: 'Approve returns',
		group: 'GENERAL',
		description: 'Approve a requested return so the customer may ship the goods back.'
	},
	{
		value: 'RETURNS_REJECT',
		label: 'Reject returns',
		group: 'GENERAL',
		description: 'Reject a requested return.'
	},
	{
		value: 'RETURNS_RECEIVE',
		label: 'Receive returned goods',
		group: 'GENERAL',
		description: 'Receive returned goods, restock or write them off, trigger the refund and close the return.'
	},
	{
		value: 'CLAIMS_VIEW',
		label: 'View claims',
		group: 'GENERAL',
		description: 'Read claims and their lines.'
	},
	{
		value: 'CLAIMS_CREATE',
		label: 'Raise claims',
		group: 'GENERAL',
		description: 'Create a claim against an order and cancel it.'
	},
	{
		value: 'CLAIMS_RESOLVE',
		label: 'Resolve claims',
		group: 'GENERAL',
		description: 'Approve and settle a claim, or reject it.'
	},
	{
		value: 'EXCHANGES_VIEW',
		label: 'View exchanges',
		group: 'GENERAL',
		description: 'Read exchanges and their lines.'
	},
	{
		value: 'EXCHANGES_CREATE',
		label: 'Request exchanges',
		group: 'GENERAL',
		description: 'Request an exchange against an order and cancel it.'
	},
	{
		value: 'EXCHANGES_RESOLVE',
		label: 'Resolve exchanges',
		group: 'GENERAL',
		description: 'Approve an exchange, re-reserving stock and adjusting the payment collection, or reject it.'
	}
];
