import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values this plugin declares.
 *
 * A value is read through the helper below rather than written as a bare string at each use site, so
 * the catalogue in `PURCHASING_PERMISSIONS` and the guards on the controllers can never drift apart.
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
 * Permission values used by the purchase-order and goods-receipt controllers.
 *
 * Committing the organization's money and releasing a supplier order are two different decisions, so
 * they are two values: `PURCHASE_ORDERS_APPROVE` decides whether an order may exist at all, and
 * `PURCHASE_ORDERS_SEND` decides whether the supplier is told about it. A buyer holds the second
 * without necessarily holding the first. Receiving is separate again, because goods arriving is a
 * warehouse event with stock consequences rather than an edit to the document.
 *
 * The vendor terms are their own pair for the same reason: a supplier's per-product terms are many per
 * supplier, several of them may be live at once for one product, and they are maintained by procurement
 * rather than by whoever maintains the supplier master. `PURCHASE_ORDERS_VIEW` deliberately does not
 * reveal them — a buyer sees the price that was applied on a line and the term it came from, which is
 * provenance recorded on the order, not the standing agreement.
 */
export const PurchasingPermissions = {
	/** Read purchase orders, goods receipts and their lines. */
	PURCHASE_ORDERS_VIEW: permission('PURCHASE_ORDERS_VIEW'),
	/** Raise a purchase order. */
	PURCHASE_ORDERS_CREATE: permission('PURCHASE_ORDERS_CREATE'),
	/** Amend a draft, acknowledge, cancel or close a purchase order. */
	PURCHASE_ORDERS_EDIT: permission('PURCHASE_ORDERS_EDIT'),
	/** Approve a purchase order internally, which is what lets it be sent. */
	PURCHASE_ORDERS_APPROVE: permission('PURCHASE_ORDERS_APPROVE'),
	/** Send a purchase order to the supplier. */
	PURCHASE_ORDERS_SEND: permission('PURCHASE_ORDERS_SEND'),
	/** Read goods receipts and their lines. */
	GOODS_RECEIPTS_VIEW: permission('GOODS_RECEIPTS_VIEW'),
	/** Receive goods against a purchase order, and reverse a receipt. */
	GOODS_RECEIPTS_CREATE: permission('GOODS_RECEIPTS_CREATE'),
	/** Read the negotiated terms with the organization's suppliers. */
	VENDOR_TERMS_VIEW: permission('VENDOR_TERMS_VIEW'),
	/** Write, amend, deactivate and bulk-write the negotiated terms. */
	VENDOR_TERMS_EDIT: permission('VENDOR_TERMS_EDIT')
} as const;

/**
 * The permission catalogue this plugin contributes to the platform role model.
 *
 * Contributed values are unioned into the catalogue at bootstrap, so a role can be granted one
 * exactly like a built-in permission and an installation that does not load the plugin never sees
 * them.
 */
export const PURCHASING_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'PURCHASE_ORDERS_VIEW',
		label: 'View purchase orders',
		group: 'GENERAL',
		description: 'Read purchase orders, goods receipts and their lines.'
	},
	{
		value: 'PURCHASE_ORDERS_CREATE',
		label: 'Raise purchase orders',
		group: 'GENERAL',
		description: 'Raise a purchase order against an existing supplier.'
	},
	{
		value: 'PURCHASE_ORDERS_EDIT',
		label: 'Amend purchase orders',
		group: 'GENERAL',
		description: 'Update a draft purchase order, acknowledge it, cancel it or close it short of the ordered quantity.'
	},
	{
		value: 'PURCHASE_ORDERS_APPROVE',
		label: 'Approve purchase orders',
		group: 'GENERAL',
		description: 'Approve a purchase order internally, which is what commits the organization to buying.'
	},
	{
		value: 'PURCHASE_ORDERS_SEND',
		label: 'Send purchase orders',
		group: 'GENERAL',
		description: 'Send an approved purchase order to the supplier and start counting the goods as incoming.'
	},
	{
		value: 'GOODS_RECEIPTS_VIEW',
		label: 'View goods receipts',
		group: 'GENERAL',
		description: 'Read goods receipts and their lines.'
	},
	{
		value: 'GOODS_RECEIPTS_CREATE',
		label: 'Receive goods',
		group: 'GENERAL',
		description: 'Receive goods against a purchase order, writing the stock movements, and reverse a receipt.'
	},
	{
		value: 'VENDOR_TERMS_VIEW',
		label: 'View vendor terms',
		group: 'GENERAL',
		description: "Read a supplier's per-product commercial terms and their validity windows."
	},
	{
		value: 'VENDOR_TERMS_EDIT',
		label: 'Edit vendor terms',
		group: 'GENERAL',
		description:
			'Create, amend, deactivate and bulk-write vendor terms: set a negotiated price, a quantity break, a lead time and an over-receipt tolerance.'
	}
];
