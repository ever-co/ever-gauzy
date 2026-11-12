import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { IOutboxWriteInput, TASK_AUTOMATION_EVENT_NAMES, TASK_AUTOMATION_LIMITS } from '@gauzy/contracts';
import { ActivityLogEvent, EventOutboxService, getORMType, MultiORMEnum, RequestContext } from '@gauzy/core';
import { changeFromActivity, ITaskActivityFact } from '../engine/change-capture';
import { triggersOfChange } from '../engine/triggers';
import { currentAutomationMarker } from '../services/task-automation-context';
import { TaskAutomationRuleService } from '../services/task-automation-rule.service';
import { TASK_AUTOMATION_AGGREGATE, taskAutomationPartitionKey } from '../task-automation.constants';

/**
 * Turns the platform's task change facts into `task_automation.task_changed` on the event outbox (plan §4).
 *
 * The fact is the activity log's (`ActivityLogEvent`): every task create, update — the form, the status route, a bulk
 * update, GraphQL — and assignee change publishes one, with the values of the fields it changed before and after,
 * which is what a status-transition trigger needs and the task's own `TaskEvent` does not carry. It arrives once the
 * task's write committed and inside the writer's request context, so a change an automation made carries the
 * automation's marker here: its depth and its chain travel with the event, and the loop guard reads them.
 *
 * It appends only what can fire a rule the organization has switched on (the organization's triggers are cached a
 * few seconds), so a task save in an organization without automations adds nothing. Best effort after the commit,
 * as the real-time hints: a lost append costs the rules that change, never the task's save; nothing is thrown.
 */
@Injectable()
@EventsHandler(ActivityLogEvent)
export class TaskAutomationChangeCapture implements IEventHandler<ActivityLogEvent> {
	private readonly logger = new Logger(TaskAutomationChangeCapture.name);

	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly outbox: EventOutboxService,
		private readonly dataSource: DataSource
	) {}

	async handle(event: ActivityLogEvent): Promise<void> {
		try {
			const marker = currentAutomationMarker();
			const change = changeFromActivity((event?.input ?? {}) as ITaskActivityFact, {
				depth: marker?.depth ?? 0,
				chain: marker?.chain ?? [],
				actorUserId: marker ? null : this.actor()
			});
			if (!change) return;
			// A change two hops deep is still appended, so the rule it would set off records the loop guard; deeper
			// ones cannot happen (a change of depth 2 runs no rule).
			if (change.depth > TASK_AUTOMATION_LIMITS.maxDepth + 1) return;
			const triggers = triggersOfChange(change);
			if (!triggers.length) return;
			const enabled = await this.rules.enabledTriggers(change.tenantId, change.organizationId);
			if (!triggers.some((trigger) => enabled.has(trigger))) return;
			await this.append({
				name: TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED,
				aggregateType: TASK_AUTOMATION_AGGREGATE,
				aggregateId: change.taskId,
				partitionKey: taskAutomationPartitionKey(change.taskId),
				tenantId: change.tenantId,
				organizationId: change.organizationId,
				headers: {
					...(change.actorUserId ? { actorUserId: change.actorUserId } : {}),
					...(marker ? { causationId: marker.runId } : {})
				},
				data: change as unknown as Record<string, unknown>
			});
		} catch (error) {
			this.logger.warn(`A task change was not handed to the automations: ${(error as Error)?.message}`);
		}
	}

	/**
	 * Appends through the ORM `DB_ORM` configures (under MikroORM the outbox's TypeORM entity maps its base columns
	 * only, so the row must be written through MikroORM), in a transaction of its own: the outbox's commit hook then
	 * wakes the dispatch pass at once.
	 */
	private async append(input: IOutboxWriteInput): Promise<void> {
		if (getORMType() === MultiORMEnum.MikroORM) {
			const em = this.outbox.mikroOrmEventOutboxRepository?.getEntityManager?.();
			if (em) {
				await em.fork().transactional((transaction) => this.outbox.append(transaction as never, input));
				return;
			}
		}
		await this.dataSource.manager.transaction((manager) => this.outbox.append(manager, input));
	}

	private actor() {
		try {
			return RequestContext.currentUserId();
		} catch {
			return null;
		}
	}
}
