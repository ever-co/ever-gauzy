import { PluginFeatureContribution, PluginSettingContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin declares.
 *
 * A flag decides *whether* a capability exists for a tenant; a permission decides *who* may use it.
 * The order module's flag is therefore about presence — with it off no order endpoint resolves at all.
 */
export const ORDER_FEATURE_CONTRIBUTIONS: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_ORDER',
		name: 'Orders',
		description:
			'Orders, order lines, order changes, the order timeline and the invoice bridge. Enabled by default: it is what an ERP-shaped installation wants orders for.',
		icon: 'file-text-outline',
		link: '/pages/sales/orders',
		defaultEnabled: true
	},
	{
		code: 'FEATURE_ORDER_APPROVALS',
		name: 'Order approvals',
		description:
			'Routing an order through the platform approval module before it is confirmed. Disabled by default: approval routing is organisation-specific configuration.',
		icon: 'checkmark-circle-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_ORDER']
	}
];

/**
 * The setting keys this plugin reads.
 *
 * Declared rather than hard-coded, so an operator can override any of them per tenant, per organization
 * or per channel without a code change; the values in the service are the documented fallbacks.
 */
export const ORDER_SETTING_CONTRIBUTIONS: PluginSettingContribution[] = [
	{
		key: 'order.changeTtlMinutes',
		type: 'number',
		default: 1440,
		scope: 'TENANT',
		description: 'How long a pending order change may sit before the cleanup job cancels it as stale.'
	},
	{
		key: 'order.archiveAfterDays',
		type: 'number',
		default: 90,
		scope: 'TENANT',
		description: 'How long after completion an order becomes eligible for archival.'
	},
	{
		key: 'order.requireApprovalAboveAmount',
		type: 'number',
		default: 0,
		scope: 'ORGANIZATION',
		description: 'Order value above which a B2B order is routed for approval. Zero disables the check.'
	}
];
