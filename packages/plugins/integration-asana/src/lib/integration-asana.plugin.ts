import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CreateIntegrationAsanaTables1791000005000 } from './database/migrations/1791000005000-CreateIntegrationAsanaTables';
import { CreateIntegrationAsanaConflictTables1791000007020 } from './database/migrations/1791000007020-CreateIntegrationAsanaConflictTables';
import { ASANA_ENTITIES, AsanaModule } from './asana.module';
import { AsanaMaintenanceModule } from './maintenance/asana-maintenance.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const ASANA_MIGRATIONS = [CreateIntegrationAsanaTables1791000005000, CreateIntegrationAsanaConflictTables1791000007020];

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
	// The scheduled import travels on a queue, so it is registered only where a queue root exists (the worker
	// process, or an API with `REDIS_ENABLED`); `ASANA_IMPORT_INTERVAL_MINUTES=0` switches the imports off; the sweep still runs to file the refused-token notices the Inbox has not taken.
	// Without it the integration is whole: webhooks and "import now" need no schedule.
	imports: [AsanaModule, ...(isSchedulerQueueRootEnabled() ? [AsanaMaintenanceModule] : [])],
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
