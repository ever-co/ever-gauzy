import {
	ID,
	ITaskAutomationChangeEvent,
	ITaskAutomationTrigger,
	ITaskLinkClosedEvent,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { isClosedStatus, statusMatches } from './status-categories';
import { ITaskAutomationChildSnapshot, ITaskAutomationStatusRef, ITaskAutomationStatusRow } from './task-snapshot';

/** What a trigger that fired asks of the engine: the task the rule acts on, and what to check of it first. */
export interface ITaskAutomationTriggerMatch {
	/** The task the conditions test and the actions change. */
	subjectTaskId: ID;
	/** `ALL_SUBTASKS_DONE`: the rule runs only when every sub-task of the subject is done. */
	requiresAllChildrenDone?: boolean;
	/**
	 * `SUBTASK_REOPENED`: the rule runs only while this sub-task is still open when the rule runs (it may have been
	 * closed again since the change was recorded).
	 */
	requiresOpenChildId?: ID;
}

/** The triggers a change event is fired for, whatever the organization's rules (the capture asks before it appends). */
export function triggersOfChange(change: Pick<ITaskAutomationChangeEvent, 'action' | 'changes'>): TaskAutomationTriggerEnum[] {
	if (change.action === 'created') {
		return [TaskAutomationTriggerEnum.TASK_CREATED];
	}
	const triggers: TaskAutomationTriggerEnum[] = [];
	if (statusChangeOf(change)) {
		triggers.push(
			TaskAutomationTriggerEnum.STATUS_CHANGED,
			TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE,
			TaskAutomationTriggerEnum.SUBTASK_REOPENED
		);
	}
	if ((change.changes.membersAdded ?? []).length > 0) {
		triggers.push(TaskAutomationTriggerEnum.TASK_ASSIGNED);
	}
	return triggers;
}

/**
 * The status before and after a change, or `null` when the status did not change. Each side keeps only what the
 * change states: an update that set the value alone leaves the old `TaskStatus` id on the row, which must not be
 * read as the new status.
 */
export function statusChangeOf(
	change: Pick<ITaskAutomationChangeEvent, 'changes'>
): { from: ITaskAutomationStatusRef; to: ITaskAutomationStatusRef } | null {
	const { status, taskStatusId } = change.changes ?? {};
	const valueChanged = !!status && (status.from ?? null) !== (status.to ?? null);
	const idChanged = !!taskStatusId && (taskStatusId.from ?? null) !== (taskStatusId.to ?? null);
	if (!valueChanged && !idChanged) return null;
	return {
		from: { status: status?.from ?? null, taskStatusId: taskStatusId?.from ?? null },
		to: { status: status?.to ?? null, taskStatusId: taskStatusId?.to ?? null }
	};
}

/**
 * Whether a rule's trigger fires for a change of a task, and on which task the rule then acts.
 *
 * @param trigger The rule's trigger.
 * @param change The change, as the capture recorded it.
 * @param changedTask The changed task as it is now (for its parent, and its project: a status is named by its
 * project's row first).
 * @param statuses The organization's statuses (for the done / open tests).
 */
export function matchChangeTrigger(
	trigger: ITaskAutomationTrigger,
	change: Pick<ITaskAutomationChangeEvent, 'taskId' | 'action' | 'changes'>,
	changedTask: { parentId: ID | null; projectId?: ID | null } | null,
	statuses: readonly ITaskAutomationStatusRow[]
): ITaskAutomationTriggerMatch | null {
	const projectId = changedTask?.projectId ?? null;
	const statusChange = () => {
		const moved = change.action === 'updated' ? statusChangeOf(change) : null;
		return moved ? { from: { ...moved.from, projectId }, to: { ...moved.to, projectId } } : null;
	};
	switch (trigger?.type) {
		case TaskAutomationTriggerEnum.TASK_CREATED:
			return change.action === 'created' ? { subjectTaskId: change.taskId } : null;
		case TaskAutomationTriggerEnum.STATUS_CHANGED: {
			const moved = statusChange();
			if (!moved) return null;
			if (trigger.toStatuses?.length && !statusMatches(moved.to, trigger.toStatuses, statuses)) return null;
			if (trigger.fromStatuses?.length && !statusMatches(moved.from, trigger.fromStatuses, statuses)) return null;
			return { subjectTaskId: change.taskId };
		}
		case TaskAutomationTriggerEnum.TASK_ASSIGNED:
			return change.action === 'updated' && (change.changes.membersAdded ?? []).length > 0
				? { subjectTaskId: change.taskId }
				: null;
		case TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE: {
			const moved = statusChange();
			const parentId = changedTask?.parentId ?? null;
			if (!moved || !parentId) return null;
			// Only the move that closes a sub-task: a done sub-task edited again does not close the parent twice.
			if (isClosedStatus(moved.from, statuses) || !isClosedStatus(moved.to, statuses)) return null;
			return { subjectTaskId: parentId, requiresAllChildrenDone: true };
		}
		case TaskAutomationTriggerEnum.SUBTASK_REOPENED: {
			const moved = statusChange();
			const parentId = changedTask?.parentId ?? null;
			if (!moved || !parentId) return null;
			if (!isClosedStatus(moved.from, statuses) || isClosedStatus(moved.to, statuses)) return null;
			return { subjectTaskId: parentId, requiresOpenChildId: change.taskId };
		}
		default:
			// DUE_DATE_PASSED is the schedule's, LINK_CLOSED the link event's.
			return null;
	}
}

/**
 * Whether a rule's trigger fires for a closed link (`task_link.closed`): the rule acts on the linked task.
 *
 * A rule fires on the link's first reported close. With `mergedOnly`, a pull request fires only when it was merged —
 * also when its merge comes after a close without merging and a reopen (`closedBefore`: the event only those rules
 * run on) — and an issue as without it.
 */
export function matchLinkClosedTrigger(
	trigger: ITaskAutomationTrigger,
	event: Pick<ITaskLinkClosedEvent, 'taskId'> &
		Partial<Pick<ITaskLinkClosedEvent, 'kind' | 'merged' | 'closedBefore'>>
): ITaskAutomationTriggerMatch | null {
	if (trigger?.type !== TaskAutomationTriggerEnum.LINK_CLOSED || !event?.taskId) return null;
	let fires: boolean;
	if (trigger.mergedOnly === true && event.kind === 'pull_request') {
		// A merged-only rule on a pull request: its merge, whether or not its close was reported before.
		fires = event.merged === true;
	} else {
		// Any other rule, and a merged-only rule on an issue: the link's first reported close only.
		fires = event.closedBefore !== true;
	}
	return fires ? { subjectTaskId: event.taskId } : null;
}

/** Every sub-task is done or cancelled (and there is at least one). */
export function allChildrenClosed(
	children: readonly ITaskAutomationChildSnapshot[] | null | undefined,
	statuses: readonly ITaskAutomationStatusRow[]
): boolean {
	return !!children?.length && children.every((child) => isClosedStatus(child, statuses));
}

/** Whether a due date has passed by `now`. */
export function isDuePassed(dueDate: Date | string | null | undefined, now: Date): boolean {
	if (!dueDate) return false;
	const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
	return !Number.isNaN(due.getTime()) && due.getTime() <= now.getTime();
}
