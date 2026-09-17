/**
 * Permission catalogue declared by the inventory plugin.
 *
 * The values are contributed to the platform role model at bootstrap, so a role is granted one
 * exactly like a built-in permission and no shared enumeration is edited to add a plugin.
 *
 * The pre-existing inventory surface keeps its own permissions — `ORG_INVENTORY_VIEW` and
 * `ORG_INVENTORY_PRODUCT_EDIT` — which are reused rather than replaced, so the screen that
 * already exists is not re-authorised by installing this package.
 */
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/** The permission values this plugin guards its controllers with. */
export const InventoryPermission = {
	/** Read locations, levels, movements, reservations, availability and alert rules. */
	STOCK_VIEW: 'STOCK_VIEW' as PermissionsEnum,
	/** Adjust quantities, record counts, maintain level policy and maintain reservations. */
	STOCK_EDIT: 'STOCK_EDIT' as PermissionsEnum,
	/** Reconcile the level tables against the ledger, optionally repairing. */
	STOCK_RECONCILE: 'STOCK_RECONCILE' as PermissionsEnum,
	/** Read stock transfers and their lines. */
	STOCK_TRANSFER_VIEW: 'STOCK_TRANSFER_VIEW' as PermissionsEnum,
	/** Create and edit a transfer. */
	STOCK_TRANSFER_CREATE: 'STOCK_TRANSFER_CREATE' as PermissionsEnum,
	/** Approve or reject a requested transfer. */
	STOCK_TRANSFER_APPROVE: 'STOCK_TRANSFER_APPROVE' as PermissionsEnum,
	/** Dispatch a transfer, writing the outbound movements. */
	STOCK_TRANSFER_SHIP: 'STOCK_TRANSFER_SHIP' as PermissionsEnum,
	/** Receive a transfer, writing the inbound movements. */
	STOCK_TRANSFER_RECEIVE: 'STOCK_TRANSFER_RECEIVE' as PermissionsEnum,
	/** Cancel a transfer that has not been received. */
	STOCK_TRANSFER_CANCEL: 'STOCK_TRANSFER_CANCEL' as PermissionsEnum
} as const;

/** Every permission value the plugin guards with, as a plain list. */
export const INVENTORY_PERMISSION_VALUES: PermissionsEnum[] = Object.values(InventoryPermission);

/** The catalogue entries the plugin contributes to the platform role model. */
export const INVENTORY_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: InventoryPermission.STOCK_VIEW,
		label: 'View stock',
		group: 'GENERAL',
		description:
			'Read stock locations, levels, movements, reservations, availability and alert rules.',
		defaultFor: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE']
	},
	{
		value: InventoryPermission.STOCK_EDIT,
		label: 'Edit stock',
		group: 'GENERAL',
		description:
			'Update level and location policy, adjust quantities, record counts and maintain reservations and alert rules.',
		defaultFor: ['ADMIN', 'MANAGER']
	},
	{
		value: InventoryPermission.STOCK_RECONCILE,
		label: 'Reconcile stock',
		group: 'ADMINISTRATION',
		description: 'Reconcile the level tables against the movement ledger, optionally repairing.',
		defaultFor: ['ADMIN']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_VIEW,
		label: 'View stock transfers',
		group: 'GENERAL',
		description: 'Read stock transfers and their lines.',
		defaultFor: ['ADMIN', 'MANAGER', 'ACCOUNTANT']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_CREATE,
		label: 'Create stock transfers',
		group: 'GENERAL',
		description: 'Create and edit a transfer between two locations.',
		defaultFor: ['ADMIN', 'MANAGER']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_APPROVE,
		label: 'Approve stock transfers',
		group: 'GENERAL',
		description: 'Approve or reject a requested transfer, and cancel one that has not been received.',
		defaultFor: ['ADMIN', 'MANAGER']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_SHIP,
		label: 'Ship stock transfers',
		group: 'GENERAL',
		description: 'Dispatch a transfer, writing the outbound movements at the source location.',
		defaultFor: ['ADMIN', 'MANAGER']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_RECEIVE,
		label: 'Receive stock transfers',
		group: 'GENERAL',
		description: 'Receive a transfer, writing the inbound movements at the destination location.',
		defaultFor: ['ADMIN', 'MANAGER']
	},
	{
		value: InventoryPermission.STOCK_TRANSFER_CANCEL,
		label: 'Cancel stock transfers',
		group: 'GENERAL',
		description: 'Cancel a transfer that has not been received.',
		defaultFor: ['ADMIN', 'MANAGER']
	}
];
