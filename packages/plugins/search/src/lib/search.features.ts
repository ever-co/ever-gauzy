import { PluginFeatureContribution } from '@gauzy/plugin';

/**
 * The feature flags this plugin declares.
 *
 * A flag decides *whether* a capability exists for a tenant; a permission decides *who* may use it.
 * All three of these default off, for the same reason: the index duplicates rows into a projection, an
 * external engine is an operational commitment, and routing reads through the projection is a decision
 * a tenant makes only after it has seen the index work. A tenant with a small dataset should be able to
 * keep querying the source endpoints and pay nothing for an index.
 */
export const SEARCH_FEATURE_CONTRIBUTIONS: PluginFeatureContribution[] = [
	{
		code: 'FEATURE_SEARCH',
		name: 'Global search',
		description:
			'The search, suggestion and facet endpoints, and the index definitions behind them. It duplicates rows into a projection and needs a reindex run before it answers.',
		icon: 'search-outline',
		link: '/pages/search',
		defaultEnabled: false
	},
	{
		code: 'FEATURE_EXTERNAL_SEARCH',
		name: 'External search engine',
		description:
			'Answer queries through a registered search-engine provider instead of the built-in database provider. Global search works with nothing configured; this is what switches it to an engine.',
		icon: 'cloud-upload-outline',
		link: '/pages/search/engine',
		defaultEnabled: false,
		dependsOn: ['FEATURE_SEARCH']
	},
	{
		code: 'FEATURE_SEARCH_INDEX',
		name: 'Serve reads from the search index',
		description:
			'Route listing reads to the indexed documents rather than to the source tables. It lets a tenant build and inspect the index first, so a bad index cannot take listings down.',
		icon: 'layers-outline',
		link: '/pages/search/index',
		defaultEnabled: false,
		dependsOn: ['FEATURE_SEARCH']
	}
];
