import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * Carries a permission value this plugin declares.
 *
 * The platform's permission catalogue is a closed enumeration and this package must not edit it: a
 * plugin's permissions are contributed through the plugin metadata and unioned into the catalogue at
 * bootstrap, so the value is an ordinary string by the time a guard reads it. The cast states exactly
 * that, and nothing more.
 *
 * @param value The permission value.
 * @returns The value in the shape the guard reads its metadata in.
 */
const permission = (value: string): PermissionsEnum => value as PermissionsEnum;

/**
 * The permissions this plugin declares.
 *
 * The resource is the word the route uses — `/orders` → `ORDERS` — so a route and its permission can be
 * read against each other without a translation table. Invoice and quote generation are deliberately
 * absent: they are guarded by the existing invoice and estimate permissions, because the invoice is the
 * accounting document and it keeps its own.
 */
export const ORDER_PERMISSIONS = {
	/** Read orders, their totals history, timeline, transactions, credit lines and changes. */
	ORDERS_VIEW: permission('ORDERS_VIEW'),
	/** Create draft orders and import historical ones. */
	ORDERS_CREATE: permission('ORDERS_CREATE'),
	/**
	 * Update and place a draft, add notes, archive a terminal order, and create, edit, confirm, decline
	 * or cancel an order change.
	 */
	ORDERS_EDIT: permission('ORDERS_EDIT'),
	/** Cancel an order, with the restock and refund options. */
	ORDERS_CANCEL: permission('ORDERS_CANCEL'),
	/** Approve or reject an order held by a B2B approval policy. */
	ORDERS_APPROVE: permission('ORDERS_APPROVE')
} as const;

/**
 * The permission catalogue entries this plugin contributes to the platform role model.
 */
export const ORDER_PERMISSION_CONTRIBUTIONS: PluginPermissionContribution[] = [
	{
		value: 'ORDERS_VIEW',
		label: 'View orders',
		group: 'GENERAL',
		description:
			'Read orders, their totals history, timeline, transactions, credit lines and changes, and export them.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'ORDERS_CREATE',
		label: 'Create orders',
		group: 'GENERAL',
		description: 'Create draft orders and import historical orders.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'ORDERS_EDIT',
		label: 'Edit orders',
		group: 'GENERAL',
		description:
			'Update and place a draft order, add notes, archive a terminal order, and work an order change through to application.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'ORDERS_CANCEL',
		label: 'Cancel orders',
		group: 'GENERAL',
		description: 'Cancel an order, choosing whether stock is restocked and whether money is refunded.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'ORDERS_APPROVE',
		label: 'Approve orders',
		group: 'GENERAL',
		description: 'Approve or reject an order held by a B2B approval policy.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
