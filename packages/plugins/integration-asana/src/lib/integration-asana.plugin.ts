import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { CreateIntegrationAsanaTables1791000005000 } from './database/migrations/1791000005000-CreateIntegrationAsanaTables';
import { ASANA_ENTITIES, AsanaModule } from './asana.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const ASANA_MIGRATIONS = [CreateIntegrationAsanaTables1791000005000];

/**
 * The Asana integration (`@gauzy/plugin-integration-asana`): connect an Asana account with OAuth, map its
 * projects to platform projects, import their tasks, keep the name, notes, completion and due date in sync
 * both ways (sections as statuses), and take Asana's webhooks.
 *
 * Listed by `apps/api/src/plugins.ts` only when `ASANA_ENABLED` is exactly `true` (`isAsanaEnabled`). Off
 * (the default) it is not loaded at all: no route, no table (its migration is not even registered), no
 * outbound request.
 */
@Plugin({
	imports: [AsanaModule],
	entities: [...ASANA_ENTITIES],
	migrations: [...ASANA_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationAsanaPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationAsanaPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationAsanaPlugin is being destroyed...');
	}
}
