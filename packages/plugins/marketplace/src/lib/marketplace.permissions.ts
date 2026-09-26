import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The marketplace permission catalogue.
 *
 * Two decisions are worth reading before the list. **Transactions are read through a settle
 * permission rather than authored**: a seller's ledger is written by the order flow and never by a
 * caller, so there is nothing to create and everything to read and to advance. And **approving a
 * payout is separate from creating one**, because creating a payout is preparation and approving one
 * moves money — a tenant that wants four-eyes control assigns the two values to different roles,
 * which is the platform's existing way of expressing that separation rather than a new mechanism.
 */
export const MARKETPLACE_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'SELLERS_VIEW',
		label: 'View sellers',
		group: 'ADMINISTRATION',
		description: 'Read seller accounts, their commission terms, their balance and their statement.'
	},
	{
		value: 'SELLERS_CREATE',
		label: 'Create sellers',
		group: 'ADMINISTRATION',
		description: 'Create a seller account bound to a party of this organization.'
	},
	{
		value: 'SELLERS_EDIT',
		label: 'Edit sellers',
		group: 'ADMINISTRATION',
		description: 'Edit a seller profile and terms; submit, verify, activate, suspend, reinstate, reject or offboard it.'
	},
	{
		value: 'SELLERS_DELETE',
		label: 'Delete sellers',
		group: 'ADMINISTRATION',
		description: 'Delete a seller account that carries no ledger rows; a seller with a balance is offboarded instead.'
	},
	{
		value: 'SELLER_OFFERINGS_VIEW',
		label: 'View offerings',
		group: 'ADMINISTRATION',
		description: 'Read what a seller offers, at what price and in which channels.'
	},
	{
		value: 'SELLER_OFFERINGS_EDIT',
		label: 'Edit offerings',
		group: 'ADMINISTRATION',
		description: 'Author, submit, publish, pause, withdraw and re-price an offering, and set its channel publication.'
	},
	{
		value: 'SELLER_TRANSACTIONS_VIEW',
		label: 'View seller transactions',
		group: 'ADMINISTRATION',
		description: 'Read the per-seller split of orders and the split reconciliation report.'
	},
	{
		value: 'SELLER_TRANSACTIONS_SETTLE',
		label: 'Settle seller transactions',
		group: 'ADMINISTRATION',
		description: 'Force a ledger row to settleable, or hold one out of payouts, without changing any amount.'
	},
	{
		value: 'SELLER_PAYOUTS_VIEW',
		label: 'View payouts',
		group: 'ADMINISTRATION',
		description: 'Read payouts, their lines and the settlements that report them.'
	},
	{
		value: 'SELLER_PAYOUTS_CREATE',
		label: 'Create payouts',
		group: 'ADMINISTRATION',
		description: 'Build a payout from settleable transactions and run the scheduled payout pass.'
	},
	{
		value: 'SELLER_PAYOUTS_APPROVE',
		label: 'Approve and execute payouts',
		group: 'ADMINISTRATION',
		description: 'Approve a payout and instruct the provider to execute it, which moves money.'
	},
	{
		value: 'SELLER_PAYOUTS_CANCEL',
		label: 'Cancel payouts',
		group: 'ADMINISTRATION',
		description: 'Cancel an unpaid payout and release the transactions it covered.'
	},
	{
		value: 'SELLER_SETTLEMENTS_VIEW',
		label: 'View settlements',
		group: 'ADMINISTRATION',
		description: 'Read what the provider reported it settled, and the discrepancies against the ledger.'
	},
	{
		value: 'SELLER_SETTLEMENTS_EDIT',
		label: 'Record and reconcile settlements',
		group: 'ADMINISTRATION',
		description: 'Record a provider report, reconcile it, dispute it or close it.'
	},
	{
		value: 'SELLER_COMMISSIONS_VIEW',
		label: 'View commission defaults',
		group: 'ADMINISTRATION',
		description: 'Read the platform default commission a seller-owned line falls back to.'
	},
	{
		value: 'SELLER_COMMISSIONS_EDIT',
		label: 'Edit commission defaults',
		group: 'ADMINISTRATION',
		description: 'Set the platform default commission, including a channel-scoped override.'
	}
];

/**
 * The permission values, for code that needs to reference one without importing the catalogue.
 */
export const MarketplacePermission = {
	SELLERS_VIEW: 'SELLERS_VIEW',
	SELLERS_CREATE: 'SELLERS_CREATE',
	SELLERS_EDIT: 'SELLERS_EDIT',
	SELLERS_DELETE: 'SELLERS_DELETE',
	SELLER_OFFERINGS_VIEW: 'SELLER_OFFERINGS_VIEW',
	SELLER_OFFERINGS_EDIT: 'SELLER_OFFERINGS_EDIT',
	SELLER_TRANSACTIONS_VIEW: 'SELLER_TRANSACTIONS_VIEW',
	SELLER_TRANSACTIONS_SETTLE: 'SELLER_TRANSACTIONS_SETTLE',
	SELLER_PAYOUTS_VIEW: 'SELLER_PAYOUTS_VIEW',
	SELLER_PAYOUTS_CREATE: 'SELLER_PAYOUTS_CREATE',
	SELLER_PAYOUTS_APPROVE: 'SELLER_PAYOUTS_APPROVE',
	SELLER_PAYOUTS_CANCEL: 'SELLER_PAYOUTS_CANCEL',
	SELLER_SETTLEMENTS_VIEW: 'SELLER_SETTLEMENTS_VIEW',
	SELLER_SETTLEMENTS_EDIT: 'SELLER_SETTLEMENTS_EDIT',
	SELLER_COMMISSIONS_VIEW: 'SELLER_COMMISSIONS_VIEW',
	SELLER_COMMISSIONS_EDIT: 'SELLER_COMMISSIONS_EDIT'
} as const;
