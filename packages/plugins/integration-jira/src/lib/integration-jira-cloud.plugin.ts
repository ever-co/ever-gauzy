import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { CreateIntegrationJiraTables1791000008400 } from './database/migrations/1791000008400-CreateIntegrationJiraTables';
import { JIRA_ENTITIES, JiraCloudModule } from './jira-cloud.module';
import { JiraMaintenanceModule } from './maintenance/jira-maintenance.module';

/** The sync's migrations, oldest first (ordered with the platform's by their timestamps). */
export const JIRA_MIGRATIONS = [CreateIntegrationJiraTables1791000008400];

/**
 * The Jira Cloud sync (`@gauzy/plugin-integration-jira`): connect a Jira Cloud site with OAuth 2.0 (3LO), map its
 * projects to projects, import their issues as tasks (streamed, resumable runs with a report), keep the title,
 * description, status, priority and due date in sync both ways (a status moves by the transition that reaches it), and
 * take the site's dynamic webhooks.
 *
 * Listed by `apps/api/src/plugins.ts` only when `JIRA_ENABLED` is exactly `true` (`isJiraEnabled`), and right after
 * `IntegrationJiraPlugin` (the Connect descriptor routes under the same prefix, which must be registered first). Off
 * (the default) it is not loaded at all: no route, no table (its migration is not even registered), no outbound request.
 */
@Plugin({
	// The scheduled import travels on a queue, so it is registered only where a queue root exists (the worker process,
	// or an API with `REDIS_ENABLED`); `JIRA_IMPORT_INTERVAL_MINUTES=0` switches the imports off (the sweep still renews
	// the webhooks and files the refused-token notices). Without it the integration is whole: webhooks and "import now"
	// need no schedule (a webhook then lapses after 30 days unless the connection's mappings change).
	imports: [JiraCloudModule, ...(isSchedulerQueueRootEnabled() ? [JiraMaintenanceModule] : [])],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...JIRA_ENTITIES],
	migrations: [...JIRA_MIGRATIONS],
	configuration: (config: ApplicationPluginConfig) => config
})
export class IntegrationJiraCloudPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('IntegrationJiraCloudPlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('IntegrationJiraCloudPlugin is being destroyed...');
	}
}
