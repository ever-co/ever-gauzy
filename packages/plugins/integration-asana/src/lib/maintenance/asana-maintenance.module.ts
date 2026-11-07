import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { AsanaModule } from '../asana.module';
import { ASANA_QUEUE_NAME } from '../asana.constants';
import { AsanaImportScheduler } from './asana-import.scheduler';
import { AsanaImportWorker } from './asana-import.worker';

/**
 * The scheduled import of the Asana integration: the schedule that asks for a sweep and the worker that runs it.
 *
 * A module of its own for the reason the platform's other maintenance modules are: a job provider lives in the
 * scheduler's injector, so the services it reaches travel with the registration (`imports`). The plugin imports it
 * only where a queue root exists (`isSchedulerQueueRootEnabled`) and the interval is not `0`; without it the
 * integration is whole — webhooks and "import now" — and nothing is scheduled. The schedule fires in the worker
 * process (`apps/worker`), the only one whose scheduler root is enabled.
 */
@Module({
	imports: [
		AsanaModule,
		SchedulerModule.forFeature({
			queues: [ASANA_QUEUE_NAME],
			jobProviders: [AsanaImportScheduler, AsanaImportWorker],
			imports: [AsanaModule]
		})
	]
})
export class AsanaMaintenanceModule {}
