import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { EverWorksModule } from './ever-works.module';

/**
 * Ever Gauzy ↔ Ever Works integration (`@gauzy/plugin-integration-ever-works`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`
 * only when `EVER_WORKS_ENABLED` is exactly `true` (`isEverWorksEnabled`). Off (the default) it is not
 * loaded at all: no route, no table read, no timer and no outbound request.
 */
@Plugin({
	imports: [EverWorksModule],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationEverWorksPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationEverWorksPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationEverWorksPlugin is being destroyed...');
	}
}
