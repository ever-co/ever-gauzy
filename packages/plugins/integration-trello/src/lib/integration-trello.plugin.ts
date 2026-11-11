import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CreateIntegrationTrelloTables1791000005150 } from './database/migrations/1791000005150-CreateIntegrationTrelloTables';
import { CreateIntegrationTrelloConflictTables1791000007030 } from './database/migrations/1791000007030-CreateIntegrationTrelloConflictTables';
import { TRELLO_ENTITIES, TrelloModule } from './trello.module';
import { TrelloMaintenanceModule } from './maintenance/trello-maintenance.module';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const TRELLO_MIGRATIONS = [CreateIntegrationTrelloTables1791000005150, CreateIntegrationTrelloConflictTables1791000007030];

/**
 * The Trello integration (`@gauzy/plugin-integration-trello`): connect a Trello member with the application's key
 * and their token, map boards to platform projects, import their cards, keep the name, description, completion
 * and due date in sync both ways (lists as statuses), and take Trello's webhooks.
 *
 * Listed by `apps/api/src/plugins.ts` only when `TRELLO_ENABLED` is exactly `true` (`isTrelloEnabled`). Off
 * (the default) it is not loaded at all: no route, no table (its migration is not even registered), no
 * outbound request.
 */
@Plugin({
	// The scheduled import travels on a queue, so it is registered only where a queue root exists (the worker
	// process, or an API with `REDIS_ENABLED`); `TRELLO_IMPORT_INTERVAL_MINUTES=0` switches the imports off; the sweep still runs to file the refused-token notices the Inbox has not taken.
	// Without it the integration is whole: webhooks and "import now" need no schedule.
	imports: [TrelloModule, ...(isSchedulerQueueRootEnabled() ? [TrelloMaintenanceModule] : [])],
	entities: [...TRELLO_ENTITIES],
	migrations: [...TRELLO_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationTrelloPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationTrelloPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationTrelloPlugin is being destroyed...');
	}
}
