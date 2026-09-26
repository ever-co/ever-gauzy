import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags the catalog plugin contributes.
 *
 * `FEATURE_CATALOG` is on by default: publishing an extended product row is the first thing a tenant
 * does, and the tables it writes already exist. The finer-grained flags default off, so that loading
 * the plugin never changes what an existing installation serves.
 */
export const CATALOG_FEATURES: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_CATALOG',
		name: 'Catalog',
		description:
			'Product and collection publication, variant facets, relations and the catalog bulk endpoint.',
		icon: 'shopping-bag-outline',
		defaultEnabled: true
	},
	{
		code: 'FEATURE_DATA_EXPORT',
		name: 'Data export',
		description: 'Streaming exports of the catalog and of the order documents.',
		icon: 'download-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_CATALOG']
	},
	{
		code: 'FEATURE_BULK_API',
		name: 'Bulk API',
		description: 'The batch authoring endpoints.',
		icon: 'layers-outline',
		defaultEnabled: false,
		dependsOn: ['FEATURE_CATALOG']
	}
];
