import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CreateEverWorksConnection1791000001100 } from './database/migrations/1791000001100-CreateEverWorksConnection';
import { CreateEverWorksSyncTables1791000001300 } from './database/migrations/1791000001300-CreateEverWorksSyncTables';
import { EVER_WORKS_ENTITIES, EverWorksModule } from './ever-works.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const EVER_WORKS_MIGRATIONS = [CreateEverWorksConnection1791000001100, CreateEverWorksSyncTables1791000001300];

/**
 * Ever Gauzy ↔ Ever Works integration (`@gauzy/plugin-integration-ever-works`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`
 * only when `EVER_WORKS_ENABLED` is exactly `true` (`isEverWorksEnabled`). Off (the default) it is not
 * loaded at all: no route, no table (its migrations are not even registered), no timer and no
 * outbound request.
 */
@Plugin({
	imports: [EverWorksModule],
	entities: () => [...EVER_WORKS_ENTITIES],
	migrations: () => [...EVER_WORKS_MIGRATIONS],
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
