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
function permission(value: string): PermissionsEnum {
	return value as unknown as PermissionsEnum;
}

/**
 * The permission values this plugin declares.
 *
 * Reading the layout, changing the layout and doing the work are three different jobs in a warehouse,
 * and the guard values keep them apart: somebody who may re-code a shelf is not therefore somebody who
 * may hand parcels to a carrier. Each write action has its own value for the same reason — a picker
 * holds `PICK_LISTS_PICK` without holding `PICK_LISTS_EDIT`, which is what releasing work takes.
 */
export const WarehousePermissions = {
	/** Read zones and their bins. */
	WAREHOUSE_ZONES_VIEW: permission('WAREHOUSE_ZONES_VIEW'),
	/** Create a zone inside a location. */
	WAREHOUSE_ZONES_CREATE: permission('WAREHOUSE_ZONES_CREATE'),
	/** Update a zone, its type and its put-away and picking rules. */
	WAREHOUSE_ZONES_EDIT: permission('WAREHOUSE_ZONES_EDIT'),
	/** Delete an empty zone. */
	WAREHOUSE_ZONES_DELETE: permission('WAREHOUSE_ZONES_DELETE'),
	/** Read bins, their contents and their capacity. */
	WAREHOUSE_BINS_VIEW: permission('WAREHOUSE_BINS_VIEW'),
	/** Create a bin, including a bulk range. */
	WAREHOUSE_BINS_CREATE: permission('WAREHOUSE_BINS_CREATE'),
	/** Update a bin, move it in the hierarchy, block or unblock it. */
	WAREHOUSE_BINS_EDIT: permission('WAREHOUSE_BINS_EDIT'),
	/** Delete an empty bin. */
	WAREHOUSE_BINS_DELETE: permission('WAREHOUSE_BINS_DELETE'),
	/** Read pick waves, pick lists and their lines. */
	PICK_LISTS_VIEW: permission('PICK_LISTS_VIEW'),
	/** Create a wave from shipments, release it, generate and assign pick lists, and cancel a list. */
	PICK_LISTS_EDIT: permission('PICK_LISTS_EDIT'),
	/** Record a pick outcome against a line — picked, short or skipped. */
	PICK_LISTS_PICK: permission('PICK_LISTS_PICK'),
	/** Close a wave short, releasing its bin pins. */
	PICK_LISTS_CANCEL: permission('PICK_LISTS_CANCEL'),

	/*
	 * Packing and manifests are not a separate resource.
	 *
	 * A pack slip and a carrier manifest exist to ship a fulfilment, they hang off it, and the appendix
	 * of the platform's permission model authorises them with the fulfilment values rather than with a
	 * parallel set — a role that may pack is a role that may edit fulfilments. The two values below are
	 * therefore read from the catalogue the fulfilment domain contributes, not declared again here:
	 * declaring a second spelling of the same right is how two roles that should be one drift apart.
	 */
	/** Read pack slips and carrier manifests, as the fulfilment domain grants it. */
	FULFILLMENTS_VIEW: PermissionsEnum.FULFILLMENTS_VIEW,
	/** Create, pack, void, build, submit and cancel a slip or a manifest. */
	FULFILLMENTS_EDIT: PermissionsEnum.FULFILLMENTS_EDIT
} as const;

/**
 * The permission catalogue entries this plugin contributes to the platform role model.
 *
 * The twelve values below are exactly the ones this domain owns. The fulfilment pair above is
 * referenced and never re-contributed.
 */
export const WAREHOUSE_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'WAREHOUSE_ZONES_VIEW',
		label: 'View warehouse zones',
		group: 'GENERAL',
		description: 'Read the zones of a stock location and the bins inside them.'
	},
	{
		value: 'WAREHOUSE_ZONES_CREATE',
		label: 'Create warehouse zones',
		group: 'GENERAL',
		description: 'Create a zone inside a stock location.'
	},
	{
		value: 'WAREHOUSE_ZONES_EDIT',
		label: 'Edit warehouse zones',
		group: 'GENERAL',
		description: 'Update a zone, its type, its visiting order and its put-away, picking and shipping rules.'
	},
	{
		value: 'WAREHOUSE_ZONES_DELETE',
		label: 'Delete warehouse zones',
		group: 'GENERAL',
		description: 'Delete a zone that holds no bin.'
	},
	{
		value: 'WAREHOUSE_BINS_VIEW',
		label: 'View warehouse bins',
		group: 'GENERAL',
		description: 'Read the bins of a location, the derived contents of one and its capacity.'
	},
	{
		value: 'WAREHOUSE_BINS_CREATE',
		label: 'Create warehouse bins',
		group: 'GENERAL',
		description: 'Create a bin, including a consecutive range of them.'
	},
	{
		value: 'WAREHOUSE_BINS_EDIT',
		label: 'Edit warehouse bins',
		group: 'GENERAL',
		description: 'Update a bin, move it in the hierarchy, block or unblock it, and reconcile its stock.'
	},
	{
		value: 'WAREHOUSE_BINS_DELETE',
		label: 'Delete warehouse bins',
		group: 'GENERAL',
		description: 'Delete a bin that is empty and holds no position under it.'
	},
	{
		value: 'PICK_LISTS_VIEW',
		label: 'View picking work',
		group: 'GENERAL',
		description: 'Read pick waves, pick lists and their lines with the bins they name.'
	},
	{
		value: 'PICK_LISTS_EDIT',
		label: 'Plan and release picking work',
		group: 'GENERAL',
		description:
			'Create a wave from shipments, release it, generate and assign pick lists, complete them and cancel one that was not started.'
	},
	{
		value: 'PICK_LISTS_PICK',
		label: 'Record picks',
		group: 'GENERAL',
		description:
			'Record a pick outcome against a line: what was taken, what came up short and what was deliberately skipped.'
	},
	{
		value: 'PICK_LISTS_CANCEL',
		label: 'Close a wave short',
		group: 'GENERAL',
		description: 'Close a wave with at least one line short, releasing the work that will not be done.'
	}
];
