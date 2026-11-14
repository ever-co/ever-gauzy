import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
	ID,
	ITaskAutomationChangeEvent,
	ITaskAutomationRule,
	ITaskAutomationTestResult,
	ITaskLinkClosedEvent,
	TaskAutomationActionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { outcomeOfPlan, planActions } from '../engine/actions';
import { evaluateConditions } from '../engine/conditions';
import { referencesOf } from '../engine/rule-validation';
import { isClosedStatus, statusMatches } from '../engine/status-categories';
import { ITaskAutomationTaskSnapshot } from '../engine/task-snapshot';
import { allChildrenClosed, isDuePassed, matchChangeTrigger, matchLinkClosedTrigger } from '../engine/triggers';
import { TaskAutomationRuleService } from './task-automation-rule.service';
import { inRuleScope, TaskAutomationRunner } from './task-automation-runner.service';
import { TaskAutomationTaskReader } from './task-automation-task-reader.service';
import { TaskAutomationWriter } from './task-automation-writer.service';

/** The triggers a task change can fire (the others are the schedule's and the link event's). */
const CHANGE_TRIGGERS = new Set<string>([
	TaskAutomationTriggerEnum.TASK_CREATED,
	TaskAutomationTriggerEnum.STATUS_CHANGED,
	TaskAutomationTriggerEnum.TASK_ASSIGNED,
	TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE,
	TaskAutomationTriggerEnum.SUBTASK_REOPENED
]);

/**
 * Turns a delivered change into rule runs (spec FR-11): the organization's rules that are on, in their order, whose
 * trigger fires for the change; each runs once for the task it acts on (the parent, for the sub-task triggers) and
 * sees the task as the rules before it left it. Also answers the dry run (spec FR-15), which writes nothing.
 */
@Injectable()
export class TaskAutomationEngine {
	private readonly logger = new Logger(TaskAutomationEngine.name);

	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly runner: TaskAutomationRunner,
		private readonly reader: TaskAutomationTaskReader,
		private readonly writer: TaskAutomationWriter
	) {}

	/** Runs the rules a task change fires. Returns how many ran. */
	async processChange(eventId: ID, change: ITaskAutomationChangeEvent): Promise<number> {
		const rules = (await this.rules.enabledRules(change.tenantId, change.organizationId)).filter((rule) =>
			CHANGE_TRIGGERS.has(rule.trigger?.type)
		);
		if (!rules.length) return 0;
		const changed = await this.reader.snapshot(change.tenantId, change.taskId);
		if (!changed) return 0;
		const { statuses } = await this.reader.catalog(change.tenantId, change.organizationId);
		let ran = 0;
		for (const rule of rules) {
			const match = matchChangeTrigger(rule.trigger, change, changed, statuses);
			if (!match) continue;
			const result = await this.runner.run(rule, match.subjectTaskId, {
				eventKey: `${eventId}:${match.subjectTaskId}`,
				triggerType: rule.trigger.type,
				depth: change.depth,
				chain: change.chain,
				requiresAllChildrenDone: match.requiresAllChildrenDone,
				requiresOpenChildId: match.requiresOpenChildId
			});
			if (result.outcome) ran += 1;
		}
		return ran;
	}

	/** Runs the rules a closed link fires (`task_link.closed`, from an integration). */
	async processLinkClosed(eventId: ID, event: ITaskLinkClosedEvent): Promise<number> {
		const rules = await this.rules.enabledRules(event.tenantId, event.organizationId);
		let ran = 0;
		for (const rule of rules) {
			const match = matchLinkClosedTrigger(rule.trigger, event);
			if (!match) continue;
			const result = await this.runner.run(rule, match.subjectTaskId, {
				eventKey: `${eventId}:${match.subjectTaskId}`,
				triggerType: TaskAutomationTriggerEnum.LINK_CLOSED,
				depth: 0,
				chain: []
			});
			if (result.outcome) ran += 1;
		}
		return ran;
	}

	/**
	 * What a rule would do to a task (spec FR-15): whether its trigger applies to the task as it is now (`null` when
	 * only an event can tell), each condition's result, each action's planned change. Nothing is written: no task
	 * change, no run, no notice.
	 */
	async dryRun(rule: ITaskAutomationRule, taskId: ID, now = new Date()): Promise<ITaskAutomationTestResult> {
		const tenantId = rule.tenantId as ID;
		const organizationId = rule.organizationId as ID;
		const task = await this.reader.snapshot(tenantId, taskId, { children: true });
		if (!task || task.organizationId !== organizationId) throw new NotFoundException('The task was not found.');
		const refs = referencesOf(rule);
		const catalog = await this.reader.catalog(tenantId, organizationId, { employeeIds: refs.employeeIds, tagIds: refs.tagIds });

		let subject: ITaskAutomationTaskSnapshot | null = task;
		let triggerMatches: boolean | null = null;
		let triggerNote: string;
		switch (rule.trigger.type) {
			case TaskAutomationTriggerEnum.TASK_CREATED:
				triggerNote = 'Runs when a task is created.';
				break;
			case TaskAutomationTriggerEnum.STATUS_CHANGED:
				if (rule.trigger.toStatuses?.length) {
					triggerMatches = statusMatches(task, rule.trigger.toStatuses, catalog.statuses);
					triggerNote = triggerMatches
						? 'The task’s status is one the trigger waits for.'
						: 'The task’s status is not one the trigger waits for.';
				} else {
					triggerNote = 'Runs when the status changes.';
				}
				break;
			case TaskAutomationTriggerEnum.TASK_ASSIGNED:
				triggerNote = 'Runs when someone is added as an assignee.';
				break;
			case TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE:
			case TaskAutomationTriggerEnum.SUBTASK_REOPENED: {
				// The rule acts on a parent: a reopened sub-task's own parent first (the task picked is the sub-task), for
				// "every sub-task done" the task picked when it has sub-tasks. A parent of another organization is none.
				const parentOf = async (): Promise<ITaskAutomationTaskSnapshot | null> => {
					if (!task.parentId) return null;
					const parent = await this.reader.snapshot(tenantId, task.parentId, { children: true });
					return parent && parent.organizationId === organizationId ? parent : null;
				};
				subject =
					rule.trigger.type === TaskAutomationTriggerEnum.SUBTASK_REOPENED
						? ((await parentOf()) ?? (task.children?.length ? task : null))
						: task.children?.length
							? task
							: await parentOf();
				if (!subject) {
					triggerMatches = false;
					triggerNote = 'The task has no sub-tasks and no parent.';
				} else if (rule.trigger.type === TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE) {
					triggerMatches = allChildrenClosed(subject.children, catalog.statuses);
					triggerNote = triggerMatches ? 'Every sub-task is done.' : 'Not every sub-task is done.';
				} else {
					triggerNote = 'Runs on the parent when a done sub-task is reopened.';
				}
				break;
			}
			case TaskAutomationTriggerEnum.DUE_DATE_PASSED:
				triggerMatches = isDuePassed(task.dueDate, now) && !isClosedStatus(task, catalog.statuses);
				triggerNote = !task.dueDate
					? 'The task has no due date.'
					: triggerMatches
						? 'The due date passed and the task is open.'
						: isClosedStatus(task, catalog.statuses)
							? 'The task is closed.'
							: 'The due date has not passed yet.';
				break;
			case TaskAutomationTriggerEnum.LINK_CLOSED:
				triggerNote = rule.trigger.mergedOnly
					? 'Runs when an integration reports that a linked pull request was merged or a linked issue closed.'
					: 'Runs when an integration reports that a linked pull request or issue closed.';
				break;
			default:
				triggerMatches = false;
				triggerNote = 'The trigger is not one the platform knows.';
		}
		const parentTrigger =
			rule.trigger.type === TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE || rule.trigger.type === TaskAutomationTriggerEnum.SUBTASK_REOPENED;
		if (parentTrigger && !subject) {
			// No task the rule would act on: nothing is planned, and nothing would be applied.
			return {
				ruleId: rule.id as ID,
				taskId: task.id,
				triggerMatches: false,
				triggerNote,
				subjectTaskId: null,
				conditions: [],
				changes: [],
				outcome: TaskAutomationRunOutcomeEnum.NO_CHANGE
			};
		}
		const target = subject ?? task;
		if (subject && !inRuleScope(rule, subject)) {
			triggerMatches = false;
			triggerNote = 'The task is outside the rule’s project or team.';
		}
		const conditions = evaluateConditions(rule.conditions, target, catalog);
		const plan = planActions(rule.actions, target, catalog);
		for (const change of plan.changes) {
			if (change.action === TaskAutomationActionEnum.NOTIFY_ASSIGNEES && change.to !== undefined) {
				change.note = this.writer.inboxLoaded ? 'Inbox notice.' : 'Platform notification.';
			}
		}
		const outcome = !conditions.passed ? TaskAutomationRunOutcomeEnum.CONDITIONS_NOT_MET : outcomeOfPlan(plan);
		return {
			ruleId: rule.id as ID,
			taskId: task.id,
			triggerMatches,
			triggerNote,
			subjectTaskId: subject?.id ?? null,
			conditions: conditions.results,
			changes: plan.changes,
			outcome
		};
	}
}
