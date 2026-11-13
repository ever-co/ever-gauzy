import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventOutboxModule, RolePermissionModule } from '@gauzy/core';
import { isSchedulerQueueRootEnabled, SchedulerModule } from '@gauzy/scheduler';
import { TASK_AUTOMATION_ENTITIES } from './entities';
import { TaskAutomationChangeCapture } from './events/task-automation-change.capture';
import { TaskAutomationEventConsumer } from './events/task-automation-event.consumer';
import { TaskAutomationLinkClosedCapture } from './events/task-automation-link-closed.capture';
import { TaskAutomationResolver } from './graphql/task-automation.resolver';
import { TaskAutomationDueSweepScheduler } from './schedule/task-automation-due-sweep.scheduler';
import { TaskAutomationDueSweepService } from './schedule/task-automation-due-sweep.service';
import { TaskAutomationDueSweepTimer, TaskAutomationDueSweepWorker } from './schedule/task-automation-due-sweep.worker';
import { TaskAutomationEngine } from './services/task-automation-engine.service';
import { TaskAutomationLinkClosureStore } from './services/task-automation-link-closure.store';
import { TaskAutomationRuleService } from './services/task-automation-rule.service';
import { TaskAutomationRunStore } from './services/task-automation-run.store';
import { TaskAutomationRunner } from './services/task-automation-runner.service';
import { TaskAutomationTaskLock } from './services/task-automation-task-lock';
import { TaskAutomationTaskReader } from './services/task-automation-task-reader.service';
import { TaskAutomationWriter } from './services/task-automation-writer.service';
import { TaskAutomationController } from './task-automation.controller';
import { TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME } from './task-automation.constants';

/**
 * The task automations (`@gauzy/plugin-task-automations`), loaded by the API only when
 * `GAUZY_TASK_AUTOMATIONS_ENABLED=true`: the routes and GraphQL reads, the change capture (CQRS `ActivityLogEvent` →
 * outbox), the closed-link capture (CQRS `TaskLinkClosedEvent` → outbox, once per task and link), the outbox consumer
 * that runs the rules, and the due-date sweep. Without a queue root the API sweeps on a
 * timer of its own (`TaskAutomationDueSweepTimer`); with one, the worker's schedule asks and
 * `TaskAutomationsMaintenanceModule` runs it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(TASK_AUTOMATION_ENTITIES),
		MikroOrmModule.forFeature(TASK_AUTOMATION_ENTITIES),
		// The tenant and permission guards of the routes need the role permissions.
		RolePermissionModule,
		// `TaskUpdateCommand` (the actions), `ActivityLogEvent` and `TaskLinkClosedEvent` (the captures), the notification event.
		CqrsModule,
		// The outbox the capture appends to and the registry the consumer registers with (the same instances as the
		// platform's: Nest builds one module per class).
		EventOutboxModule
	],
	controllers: [TaskAutomationController],
	providers: [
		TaskAutomationRuleService,
		TaskAutomationTaskReader,
		TaskAutomationRunStore,
		TaskAutomationWriter,
		TaskAutomationTaskLock,
		TaskAutomationRunner,
		TaskAutomationEngine,
		TaskAutomationDueSweepService,
		TaskAutomationChangeCapture,
		TaskAutomationLinkClosureStore,
		TaskAutomationLinkClosedCapture,
		TaskAutomationEventConsumer,
		// Listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is never
		// registered, and the schema would advertise fields nothing resolves.
		TaskAutomationResolver,
		...(isSchedulerQueueRootEnabled() ? [] : [TaskAutomationDueSweepTimer])
	],
	exports: [TaskAutomationRuleService, TaskAutomationEngine, TaskAutomationRunStore, TaskAutomationDueSweepService]
})
export class TaskAutomationsModule {}

/**
 * The consumer of the due-date queue, in the process that hosts the task services (the API), where a queue root
 * exists. A job provider lives in the scheduler's injector, so the services it reaches travel with the registration.
 */
@Module({
	imports: [
		TaskAutomationsModule,
		SchedulerModule.forFeature({
			queues: [TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME],
			jobProviders: [TaskAutomationDueSweepWorker],
			imports: [TaskAutomationsModule]
		})
	]
})
export class TaskAutomationsMaintenanceModule {}

/**
 * The schedule only, for the worker process (where a `@ScheduledJob` fires): the queue and the 15-minute job that
 * enqueues onto it, and no consumer — the worker does not host the platform's task services the actions write
 * through, so the sweep runs where they are (the outbox's own split, `EventOutboxDispatchScheduleModule`).
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME],
			jobProviders: [TaskAutomationDueSweepScheduler]
		})
	]
})
export class TaskAutomationsScheduleModule {}
