import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags the tax plugin contributes.
 *
 * A contributed feature is registered in the platform feature catalogue and starts from the
 * `defaultEnabled` declared here: the module flag is on, because categories and rates only ever change
 * what a caller that asks for them is charged, and the legacy per-variant tax value stays the fallback
 * for an organization that has not defined any category. The provider flag is off, because delegating
 * the calculation to an external engine is an egress decision a tenant makes deliberately, once it has
 * the integration credentials.
 */
export const TAX_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_TAX',
		name: 'Tax',
		description: 'Tax categories, rates and resolution for the things a tenant sells and the parties it sells to.',
		defaultEnabled: true
	},
	{
		code: 'FEATURE_TAX_PROVIDER',
		name: 'Tax provider',
		description: 'Delegating tax calculation to an external engine through integration credentials.',
		defaultEnabled: false,
		dependsOn: ['FEATURE_TAX']
	}
];
