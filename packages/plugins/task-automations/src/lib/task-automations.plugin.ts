import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { TASK_AUTOMATION_MIGRATIONS } from './database/task-automation-migrations';
import { TASK_AUTOMATION_ENTITIES } from './entities';
import { TaskAutomationActivitySubscriber } from './events/task-automation-activity.subscriber';
import { TaskAutomationResolver } from './graphql/task-automation.resolver';
import { taskAutomationSchemaExtensions } from './graphql/task-automation.schema';
import { TaskAutomationsMaintenanceModule, TaskAutomationsModule, TaskAutomationsScheduleModule } from './task-automations.module';

export { TASK_AUTOMATION_MIGRATIONS };

/**
 * Task automations (`@gauzy/plugin-task-automations`, spec `docs/specs/features/task-automations`).
 *
 * Gauzy is production: the plugin is listed by `apps/api/src/plugins.ts` only when `GAUZY_TASK_AUTOMATIONS_ENABLED` is
 * exactly `true` (`isTaskAutomationsEnabled`). Off (the default) it is not loaded at all: no route, no GraphQL field,
 * no table (its migrations are not even registered), no outbox row, no schedule and no role grant.
 *
 * Where a queue root exists it also consumes the due-date queue the worker's schedule fills
 * (`TaskAutomationsMaintenanceModule`); without one the API sweeps on a timer of its own.
 */
@Plugin({
	imports: [TaskAutomationsModule, ...(isSchedulerQueueRootEnabled() ? [TaskAutomationsMaintenanceModule] : [])],
	// Arrays, not factories: the platform resolves a factory for migrations but not for entities.
	entities: [...TASK_AUTOMATION_ENTITIES],
	migrations: [...TASK_AUTOMATION_MIGRATIONS],
	// The attribution of the activity rows a rule's changes write ("by automation <name>").
	subscribers: [TaskAutomationActivitySubscriber],
	extensions: {
		schema: taskAutomationSchemaExtensions,
		resolvers: [TaskAutomationResolver]
	},
	configuration: (config: ApplicationPluginConfig) => config
})
export class TaskAutomationsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('TaskAutomationsPlugin is being bootstrapped...');
		if (isSchedulerQueueRootEnabled()) {
			// The API cannot read the worker's switches: say where the due-date sweep comes from, so a deployment whose
			// worker scheduler is off sees why due-date rules never fire.
			console.log(
				'TaskAutomationsPlugin: the due-date sweep is asked for by the worker schedule (queue root on): keep the ' +
					'worker running with GAUZY_TASK_AUTOMATIONS_ENABLED=true and its scheduler on (WORKER_SCHEDULER_ENABLED not false).'
			);
		}
	}

	onPluginDestroy(): void {
		console.log('TaskAutomationsPlugin is being destroyed...');
	}
}

/**
 * The worker's half (`apps/worker/src/plugins.ts`, behind the same switch): the due-date schedule only — the queue and
 * the 15-minute job that enqueues onto it. No entity, no migration, no route: the API owns those, and the sweep runs
 * in the API, which hosts the task services the actions write through.
 */
@Plugin({
	imports: [...(isSchedulerQueueRootEnabled() ? [TaskAutomationsScheduleModule] : [])],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => config
})
export class TaskAutomationsSchedulePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	onPluginBootstrap(): void {
		console.log('TaskAutomationsSchedulePlugin is being bootstrapped...');
	}

	onPluginDestroy(): void {
		console.log('TaskAutomationsSchedulePlugin is being destroyed...');
	}
}
