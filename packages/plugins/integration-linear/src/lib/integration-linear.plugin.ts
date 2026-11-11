import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CreateIntegrationLinearTables1791000004900 } from './database/migrations/1791000004900-CreateIntegrationLinearTables';
import { CreateIntegrationLinearConflictTables1791000007010 } from './database/migrations/1791000007010-CreateIntegrationLinearConflictTables';
import { LINEAR_ENTITIES, LinearModule } from './linear.module';
import { LinearMaintenanceModule } from './maintenance/linear-maintenance.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const LINEAR_MIGRATIONS = [CreateIntegrationLinearTables1791000004900, CreateIntegrationLinearConflictTables1791000007010];

/**
 * The Linear integration (`@gauzy/plugin-integration-linear`): connect a Linear workspace with OAuth, map
 * its teams to projects, import their issues as tasks, keep the status, title, description, priority and
 * due date in sync both ways, and take Linear's webhooks.
 *
 * Listed by `apps/api/src/plugins.ts` only when `LINEAR_ENABLED` is exactly `true` (`isLinearEnabled`).
 * Off (the default) it is not loaded at all: no route, no table (its migration is not even registered),
 * no outbound request.
 */
@Plugin({
	// The scheduled import travels on a queue, so it is registered only where a queue root exists (the worker
	// process, or an API with `REDIS_ENABLED`); `LINEAR_IMPORT_INTERVAL_MINUTES=0` switches the imports off; the sweep still runs to file the refused-token notices the Inbox has not taken.
	// Without it the integration is whole: webhooks and "import now" need no schedule.
	imports: [LinearModule, ...(isSchedulerQueueRootEnabled() ? [LinearMaintenanceModule] : [])],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...LINEAR_ENTITIES],
	migrations: [...LINEAR_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationLinearPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationLinearPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationLinearPlugin is being destroyed...');
	}
}
