import { PluginSettingContribution } from '@gauzy/plugin';

/**
 * The setting keys this plugin reads.
 *
 * Declared rather than hard-coded, so an operator overrides any of them per tenant, per organization
 * or per channel without a code change. The declaration is metadata: the value always comes from the
 * platform settings store, and this file's `default` is the documented fallback the code is written
 * against.
 */
export const SEARCH_SETTING_CONTRIBUTIONS: PluginSettingContribution[] = [
	{
		key: 'search.engineKey',
		type: 'string',
		default: '',
		scope: 'TENANT',
		description:
			'The registered engine provider a query is answered by. Empty means the built-in database provider, which is the deployment that needs nothing configured.'
	},
	{
		key: 'search.resultPageSizeLimit',
		type: 'number',
		default: 100,
		scope: 'TENANT',
		description: 'The largest number of hits one search request may return, whatever page size it asks for.'
	},
	{
		key: 'search.suggestLimit',
		type: 'number',
		default: 10,
		scope: 'TENANT',
		description: 'The largest number of type-ahead suggestions one request may return.'
	},
	{
		key: 'search.reindexBatchSize',
		type: 'number',
		default: 500,
		scope: 'TENANT',
		description:
			'How many source rows one reindex batch materialises and writes. A smaller batch bounds peak memory; a larger one reduces the number of round trips.'
	},
	{
		key: 'search.facetCountsEnabled',
		type: 'boolean',
		default: true,
		scope: 'TENANT',
		description:
			'Whether a search computes facet value counts. Turning it off makes a search answer with an empty facet list rather than with counts it did not compute.'
	}
];

/**
 * The declared defaults, in the shape the services read them.
 *
 * The values are the same ones {@link SEARCH_SETTING_CONTRIBUTIONS} declares; keeping them in one
 * place is what stops a documented default and an enforced one from drifting apart.
 */
export const SEARCH_SETTING_DEFAULTS = {
	/** Empty: no external engine is configured, so the database provider answers. */
	engineKey: '',
	resultPageSizeLimit: 100,
	suggestLimit: 10,
	reindexBatchSize: 500,
	facetCountsEnabled: true
} as const;
