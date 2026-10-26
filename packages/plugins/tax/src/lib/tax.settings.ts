import { PluginSettingContribution } from '@gauzy/plugin';

/**
 * The settings the tax plugin reads.
 *
 * The declarations are metadata only: the values are resolved through the platform settings store, so a
 * tenant, an organization or a channel can override either of them without a code change.
 */
export const TAX_SETTINGS: PluginSettingContribution[] = [
	{
		key: 'tax.allowUntaxedCatalog',
		type: 'boolean',
		default: false,
		scope: 'CHANNEL',
		description:
			'When true, a destination no rate matches is taxed at zero and a notice is raised instead of refusing the calculation.'
	},
	{
		key: 'tax.providerTimeoutMs',
		type: 'number',
		default: 5000,
		scope: 'ORGANIZATION',
		description: 'How long a call to an external tax engine may take before the built-in resolver takes over.'
	}
];
