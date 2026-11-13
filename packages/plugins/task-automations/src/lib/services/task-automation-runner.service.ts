import { Injectable, Logger } from '@nestjs/common';
import {
	ID,
	ITaskAutomationChange,
	ITaskAutomationRule,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { planActions } from '../engine/actions';
import { evaluateConditions } from '../engine/conditions';
import { isRateLimited, loopGuardReason, nextMarker } from '../engine/loop-guard';
import { referencesOf } from '../engine/rule-validation';
import { isClosedStatus } from '../engine/status-categories';
import { ITaskAutomationTaskSnapshot } from '../engine/task-snapshot';
import { allChildrenClosed } from '../engine/triggers';
import { TaskAutomationRuleService } from './task-automation-rule.service';
import { TaskAutomationRunStore } from './task-automation-run.store';
import { TaskAutomationTaskLock } from './task-automation-task-lock';
import { TaskAutomationTaskReader } from './task-automation-task-reader.service';
import { applyListEdit, listEdit, TaskAutomationTaskGoneError, TaskAutomationWriter } from './task-automation-writer.service';

/** One run of one rule for one task: what led to it, and what it must check before it claims anything. */
export interface ITaskAutomationRunOptions {
	/** The delivery identity: `<eventId>:<taskId>`, or `due:<taskId>:<dueDate>`. */
	eventKey: string;
	triggerType: TaskAutomationTriggerEnum;
	/** Automation hops that led to the change (0: a person's). */
	depth: number;
	/** The rules that led to the change. */
	chain: ID[];
	/** `ALL_SUBTASKS_DONE`: run only when every sub-task of the task is done. */
	requiresAllChildrenDone?: boolean;
	/** `SUBTASK_REOPENED`: run only while this sub-task of the task is still open. */
	requiresOpenChildId?: ID;
	/** `DUE_DATE_PASSED`: run only when the task is still open and still due at this instant (ISO). */
	requiresOpenAndDue?: string;
	now?: Date;
}

/** What a run did: its outcome, or `null` when it did not run (out of scope, not due any more, already run). */
export interface ITaskAutomationRunResult {
	outcome: TaskAutomationRunOutcomeEnum | null;
	runId?: ID;
	reason?: 'missing-task' | 'out-of-scope' | 'not-matched' | 'duplicate';
}

/** Whether a task is in a rule's scope: its project, one of its teams. */
export function inRuleScope(rule: Pick<ITaskAutomationRule, 'organizationId' | 'projectId' | 'organizationTeamId'>, task: ITaskAutomationTaskSnapshot): boolean {
	if (rule.organizationId && task.organizationId !== rule.organizationId) return false;
	if (rule.projectId && task.projectId !== rule.projectId) return false;
	if (rule.organizationTeamId && !task.teamIds.includes(rule.organizationTeamId)) return false;
	return true;
}

/** Notes the list changes an edit made meanwhile had already made (the writer left those lists as they were). */
function markAlreadySet(changes: ITaskAutomationChange[], fields: ReadonlyArray<'members' | 'tags'>): void {
	for (const change of changes) {
		if (change.failed || change.note === 'Already set.' || !fields.includes(change.field as 'members' | 'tags')) continue;
		change.note = 'Already set.';
	}
}

/** Marks the changes the failed update was to make as failed, with its reason. */
function failUpdateChanges(changes: ITaskAutomationChange[], reason: string): void {
	for (const change of changes) {
		if (change.failed || change.note === 'Already set.' || change.field === 'notice') continue;
		change.failed = true;
		change.note = reason;
	}
}

/**
 * Runs one rule for one task (spec FR-9 – FR-14): reads the task fresh, keeps to the rule's scope, claims the run
 * once per change, holds to the loop guard, the conditions and the rate limit, applies the actions through the
 * platform's task update as the rule's system actor, sends its notices, and records the outcome. A failure of the
 * task update or a notice is the run's outcome, never an exception: the change that set the rule off is not
 * delivered again for it. A failure to claim or record is thrown, so the delivery is tried again, and so is
 * `TaskAutomationRetryLaterError` (the task is busy with another run, or this run is still marked running).
 *
 * The whole run holds the task's lock (`TaskAutomationTaskLock`): the due sweep and the parent triggers reach a task
 * from outside its own outbox partition, and two runs must not read the same labels and write two full lists.
 */
@Injectable()
export class TaskAutomationRunner {
	private readonly logger = new Logger(TaskAutomationRunner.name);

	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly runs: TaskAutomationRunStore,
		private readonly reader: TaskAutomationTaskReader,
		private readonly writer: TaskAutomationWriter,
		private readonly taskLock: TaskAutomationTaskLock
	) {}

	async run(rule: ITaskAutomationRule, subjectTaskId: ID, options: ITaskAutomationRunOptions): Promise<ITaskAutomationRunResult> {
		return this.taskLock.run(subjectTaskId, () => this.runLocked(rule, subjectTaskId, options));
	}

	private async runLocked(rule: ITaskAutomationRule, subjectTaskId: ID, options: ITaskAutomationRunOptions): Promise<ITaskAutomationRunResult> {
		const now = options.now ?? new Date();
		const tenantId = rule.tenantId as ID;
		const organizationId = rule.organizationId as ID;
		const subject = await this.reader.snapshot(tenantId, subjectTaskId, { children: !!options.requiresAllChildrenDone });
		if (!subject) return { outcome: null, reason: 'missing-task' };
		if (!inRuleScope(rule, subject)) return { outcome: null, reason: 'out-of-scope' };
		const refs = referencesOf(rule);
		const catalog = await this.reader.catalog(tenantId, organizationId, { employeeIds: refs.employeeIds, tagIds: refs.tagIds });
		if (options.requiresAllChildrenDone && !allChildrenClosed(subject.children, catalog.statuses)) {
			return { outcome: null, reason: 'not-matched' };
		}
		if (options.requiresOpenAndDue) {
			const stillDue = !!subject.dueDate && subject.dueDate.toISOString() === options.requiresOpenAndDue;
			if (!stillDue || isClosedStatus(subject, catalog.statuses)) return { outcome: null, reason: 'not-matched' };
		}
		if (options.requiresOpenChildId) {
			// The sub-task may have been closed again (or moved) since its reopening was recorded.
			const child = await this.reader.snapshot(tenantId, options.requiresOpenChildId);
			if (!child || child.parentId !== subject.id || isClosedStatus(child, catalog.statuses)) {
				return { outcome: null, reason: 'not-matched' };
			}
		}

		const run = await this.runs.claim(
			{ tenantId, organizationId, ruleId: rule.id as ID, taskId: subject.id, eventKey: options.eventKey, triggerType: options.triggerType, depth: options.depth },
			now
		);
		if (!run) return { outcome: null, reason: 'duplicate' };
		const startedAt = Date.now();
		const finish = async (outcome: TaskAutomationRunOutcomeEnum, details?: unknown, error?: string | null): Promise<ITaskAutomationRunResult> => {
			await this.runs.finish(run, outcome, { details, error, durationMs: Date.now() - startedAt });
			await this.rules.touchLastRun(rule.id as ID, now).catch(() => undefined);
			return { outcome, runId: run.id as ID };
		};

		try {
			const guard = loopGuardReason(rule.id as ID, options.depth, options.chain);
			if (guard) {
				return finish(TaskAutomationRunOutcomeEnum.LOOP_GUARD, {
					note:
						guard === 'depth'
							? 'The change was made by an automation set off by another automation.'
							: 'The change was made by this rule (or one it set off).'
				});
			}
			const conditions = evaluateConditions(rule.conditions, subject, catalog);
			if (!conditions.passed) {
				return finish(TaskAutomationRunOutcomeEnum.CONDITIONS_NOT_MET, { conditions: conditions.results });
			}
			const plan = planActions(rule.actions, subject, catalog);
			const hasUpdate = Object.keys(plan.update).length > 0;
			if (!hasUpdate && !plan.notices.length) {
				const failed = plan.changes.some((change) => change.failed);
				return finish(failed ? TaskAutomationRunOutcomeEnum.FAILED : TaskAutomationRunOutcomeEnum.NO_CHANGE, {
					conditions: conditions.results,
					changes: plan.changes
				});
			}
			const recent = await this.runs.changesSince(subject.id, new Date(now.getTime() - TASK_AUTOMATION_LIMITS.rateLimitWindowMs));
			if (isRateLimited(recent)) {
				return finish(TaskAutomationRunOutcomeEnum.RATE_LIMITED, {
					note: `Automations changed this task ${recent} times in the last ${Math.round(TASK_AUTOMATION_LIMITS.rateLimitWindowMs / 60_000)} minutes.`,
					changes: plan.changes
				});
			}

			const marker = nextMarker({ id: rule.id as ID, name: rule.name }, run.id as ID, options.depth, options.chain);
			let applied = false;
			let updateFailed = false;
			// The task's assignees as stored just before the write: the base the notices are addressed from.
			let currentMembers: ID[] | null = null;
			// The task was deleted after the run read it: no notice goes out about it.
			let taskGone = false;
			if (hasUpdate) {
				try {
					const written = await this.writer.applyUpdate(subject, plan.update, marker);
					// Nothing was sent when an edit made meanwhile already did what the rule was to do: no change of the
					// rule's, so it does not count toward the task's rate limit either.
					applied = written.written;
					currentMembers = written.lists?.memberIds ?? null;
					markAlreadySet(plan.changes, written.unchanged);
				} catch (error) {
					updateFailed = true;
					taskGone = error instanceof TaskAutomationTaskGoneError;
					failUpdateChanges(plan.changes, this.writer.describe(error));
				}
			}
			if (plan.notices.length && !currentMembers && !taskGone) {
				try {
					const lists = await this.writer.currentLists(subject);
					if (lists) currentMembers = lists.memberIds;
					else taskGone = true;
				} catch {
					// The lists could not be read: the notices go by the task as the run read it.
				}
			}
			const baseMembers = currentMembers ?? subject.memberIds;
			const notices = plan.changes.filter((change) => change.field === 'notice' && change.to !== undefined);
			for (const [index, planned] of plan.notices.entries()) {
				const line = notices[index];
				// A notice goes to the assignees the task has at that point of the rule: what the actions before it added
				// and removed, applied to the assignees as stored now (an edit made meanwhile counts). When the update
				// failed, to the assignees as they are, never to people the failed update was to add.
				const employeeIds = updateFailed
					? [...baseMembers]
					: applyListEdit(baseMembers, listEdit(subject.memberIds, planned.employeeIds));
				const notice = { ...planned, employeeIds };
				if (taskGone) {
					if (line) {
						line.to = 0;
						line.note = 'The task no longer exists.';
					}
					continue;
				}
				if (!notice.employeeIds.length) {
					if (line) {
						line.to = 0;
						line.note = 'The task has no assignee.';
					}
					continue;
				}
				try {
					const sent = await this.writer.notify(subject, notice, marker, options.eventKey);
					if (line) {
						line.to = sent.recipients;
						line.note = sent.channel === 'inbox' ? 'Inbox notice.' : 'Platform notification.';
					}
					applied = applied || sent.recipients > 0;
				} catch (error) {
					if (line) {
						line.failed = true;
						line.note = this.writer.describe(error);
					}
				}
			}
			const anyFailed = plan.changes.some((change) => change.failed);
			const outcome = applied
				? anyFailed
					? TaskAutomationRunOutcomeEnum.PARTIAL
					: TaskAutomationRunOutcomeEnum.APPLIED
				: anyFailed
					? TaskAutomationRunOutcomeEnum.FAILED
					: TaskAutomationRunOutcomeEnum.NO_CHANGE;
			return finish(outcome, { conditions: conditions.results, changes: plan.changes });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Automation rule ${rule.id} failed on task ${subject.id}: ${message}`);
			return finish(TaskAutomationRunOutcomeEnum.FAILED, undefined, message);
		}
	}
}
