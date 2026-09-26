import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values this plugin declares.
 *
 * A value is read through the helper below rather than written as a bare string at each use site, so
 * the catalogue in `SUBSCRIPTION_PERMISSIONS` and the guards on the controllers can never drift
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
 * Permission values used by the subscription controllers.
 *
 * Four values rather than a "manage" pair, because the four acts differ in blast radius: reading a
 * plan changes nothing, creating one prices a product, editing a subscription changes what a
 * customer is committed to, and billing moves money against an instrument nobody is present to
 * authorise again. A support role holds the first and not the last.
 *
 * Plans are folded into the same four: a plan has no meaning without the subscriptions that
 * instantiate it and is edited by the same role.
 */
export const SubscriptionPermissions = {
	/** Read plans, subscriptions, their items and their billing history. */
	SUBSCRIPTIONS_VIEW: permission('SUBSCRIPTIONS_VIEW'),
	/** Create a plan or a subscription. */
	SUBSCRIPTIONS_CREATE: permission('SUBSCRIPTIONS_CREATE'),
	/** Update a plan; update, pause, resume, cancel or expire a subscription. */
	SUBSCRIPTIONS_EDIT: permission('SUBSCRIPTIONS_EDIT'),
	/** Bill a cycle, pay or waive a billing row, and trigger the billing run. */
	SUBSCRIPTIONS_BILL: permission('SUBSCRIPTIONS_BILL')
} as const;

/**
 * The permission catalogue this plugin contributes to the platform role model.
 *
 * Contributed values are unioned into the catalogue at bootstrap, so a role can be granted one
 * exactly like a built-in permission and an installation that does not load the plugin never sees
 * them.
 *
 * Each entry names the endpoints it guards, so the catalogue is a description of what is actually
 * reachable rather than an intention that decays.
 */
export const SUBSCRIPTION_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: 'SUBSCRIPTIONS_VIEW',
		label: 'View subscriptions',
		group: 'GENERAL',
		description:
			'Read plans, subscriptions, their items and their billing history: GET /subscription-plans, /subscription-plans/:id, /subscriptions, /subscriptions/:id, /subscriptions/:id/billings and /subscription-billings.'
	},
	{
		value: 'SUBSCRIPTIONS_CREATE',
		label: 'Create subscriptions',
		group: 'GENERAL',
		description: 'Create a plan or a subscription: POST /subscription-plans and POST /subscriptions.'
	},
	{
		value: 'SUBSCRIPTIONS_EDIT',
		label: 'Edit subscriptions',
		group: 'GENERAL',
		description:
			'Update a plan; update, pause, resume, cancel or expire a subscription: PUT and DELETE /subscription-plans/:id, PUT /subscriptions/:id and POST /subscriptions/:id/pause, /resume, /cancel, /expire.'
	},
	{
		value: 'SUBSCRIPTIONS_BILL',
		label: 'Bill subscriptions',
		group: 'ADMINISTRATION',
		description:
			'Bill a cycle, pay or waive a billing row, and trigger the billing run: POST /subscriptions/:id/bill, POST /subscription-billings/:id/pay, /waive and POST /subscriptions/billing-run.'
	}
];
