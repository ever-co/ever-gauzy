import { PluginFeatureContribution, PluginSettingContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin declares.
 *
 * The module flag defaults **off**: fulfilment implies either a carrier adapter or at least a shipping
 * price list, and a tenant that only invoices digitised orders should not be pushed through a shipping
 * configuration it does not have.
 */
export const FULFILLMENT_FEATURE_CONTRIBUTIONS: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_FULFILLMENT',
		name: 'Fulfillment',
		description:
			'Shipping profiles and options, fulfilments and labels. Disabled by default: enabling it is meaningful once a carrier or a shipping price list exists.',
		icon: 'cube-outline',
		link: '/pages/sales/fulfillments',
		defaultEnabled: false
	}
];

/**
 * The setting keys this plugin reads.
 */
export const FULFILLMENT_SETTING_CONTRIBUTIONS: PluginSettingContribution[] = [
	{
		key: 'fulfillment.defaultProfileCode',
		type: 'string',
		default: 'DEFAULT',
		scope: 'ORGANIZATION',
		description: 'The code of the profile a variant with no explicit attachment uses.'
	},
	{
		key: 'fulfillment.reservationTtlMinutes',
		type: 'number',
		default: 30,
		scope: 'TENANT',
		description: 'How long the reservations a fulfilment consumes are held before they expire.'
	}
];
