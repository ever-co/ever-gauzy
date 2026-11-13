import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { DocsLiveModule } from './docs-live.module';
import { DocsLiveResolver } from './graphql/docs-live.resolver';
import { docsLiveSchemaExtensions } from './graphql/docs-live.schema';

/**
 * Live co-editing of Docs pages (`docs-collaboration` plan, phase 3).
 *
 * Gauzy is production: `apps/api/src/plugins.ts` lists it only when `GAUZY_DOCS_LIVE_ENABLED` is exactly `true`
 * (`isDocsLiveEnabled`), after `DocsPlugin`. Off (the default) it is not loaded at all: no route, no GraphQL field,
 * and the editor keeps its single-writer autosave with the revision check. It has no table of its own: the live
 * state is stored in the page's `contentBinary`.
 */
@Plugin({
	imports: [DocsLiveModule],
	// `Subscription.documentLive`, served only with the plugin.
	extensions: {
		schema: docsLiveSchemaExtensions,
		resolvers: [DocsLiveResolver]
	},
	configuration: (config: ApplicationPluginConfig) => config
})
export class DocsLivePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('DocsLivePlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('DocsLivePlugin is being destroyed...');
	}
}
