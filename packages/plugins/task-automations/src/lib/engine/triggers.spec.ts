import { ITaskAutomationChangeEvent, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import {
	allChildrenClosed,
	isDuePassed,
	matchChangeTrigger,
	matchLinkClosedTrigger,
	statusChangeOf,
	triggersOfChange
} from './triggers';
import { STATUSES } from './testing/fixtures';

function change(overrides: Partial<ITaskAutomationChangeEvent> = {}): ITaskAutomationChangeEvent {
	return {
		taskId: 'task-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		action: 'updated',
		changes: {},
		depth: 0,
		chain: [],
		...overrides
	};
}

const moved = (from: string, to: string) =>
	change({ changes: { status: { from, to }, taskStatusId: { from: `st-${from}`, to: `st-${to}` } } });

describe('triggers', () => {
	it('names the triggers a change can fire', () => {
		expect(triggersOfChange(change({ action: 'created' }))).toEqual([TaskAutomationTriggerEnum.TASK_CREATED]);
		expect(triggersOfChange(moved('open', 'done'))).toEqual([
			TaskAutomationTriggerEnum.STATUS_CHANGED,
			TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE,
			TaskAutomationTriggerEnum.SUBTASK_REOPENED
		]);
		expect(triggersOfChange(change({ changes: { membersAdded: ['e-1'] } }))).toEqual([TaskAutomationTriggerEnum.TASK_ASSIGNED]);
		expect(triggersOfChange(change({ changes: { priority: { from: 'low', to: 'high' } } }))).toEqual([]);
		expect(triggersOfChange(change({ changes: { membersRemoved: ['e-1'] } }))).toEqual([]);
	});

	it('reads a status change from either field, and only what the change states', () => {
		expect(statusChangeOf(change())).toBeNull();
		expect(statusChangeOf(change({ changes: { status: { from: 'open', to: 'open' } } }))).toBeNull();
		expect(statusChangeOf(change({ changes: { status: { from: 'open', to: 'done' } } }))).toEqual({
			from: { status: 'open', taskStatusId: null },
			to: { status: 'done', taskStatusId: null }
		});
		expect(statusChangeOf(change({ changes: { taskStatusId: { from: 'st-open', to: 'st-done' } } }))?.to).toEqual({
			status: null,
			taskStatusId: 'st-done'
		});
	});

	describe('TASK_CREATED', () => {
		const trigger = { type: TaskAutomationTriggerEnum.TASK_CREATED };
		it('fires on a created task only', () => {
			expect(matchChangeTrigger(trigger, change({ action: 'created' }), null, STATUSES)).toEqual({ subjectTaskId: 'task-1' });
			expect(matchChangeTrigger(trigger, moved('open', 'done'), null, STATUSES)).toBeNull();
		});
	});

	describe('STATUS_CHANGED', () => {
		it('fires on any status change without lists', () => {
			const trigger = { type: TaskAutomationTriggerEnum.STATUS_CHANGED };
			expect(matchChangeTrigger(trigger, moved('open', 'in-progress'), null, STATUSES)).toEqual({ subjectTaskId: 'task-1' });
			expect(matchChangeTrigger(trigger, change({ changes: { priority: { from: null, to: 'high' } } }), null, STATUSES)).toBeNull();
			expect(matchChangeTrigger(trigger, change({ action: 'created' }), null, STATUSES)).toBeNull();
		});

		it('fires only to and from the statuses named', () => {
			const toReview = { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['Ready for review'] };
			expect(matchChangeTrigger(toReview, moved('in-progress', 'ready-for-review'), null, STATUSES)).not.toBeNull();
			expect(matchChangeTrigger(toReview, moved('in-progress', 'done'), null, STATUSES)).toBeNull();
			const fromOpen = { type: TaskAutomationTriggerEnum.STATUS_CHANGED, fromStatuses: ['st-open'] };
			expect(matchChangeTrigger(fromOpen, moved('open', 'done'), null, STATUSES)).not.toBeNull();
			expect(matchChangeTrigger(fromOpen, moved('in-progress', 'done'), null, STATUSES)).toBeNull();
		});
	});

	describe('TASK_ASSIGNED', () => {
		const trigger = { type: TaskAutomationTriggerEnum.TASK_ASSIGNED };
		it('fires when someone is added to an existing task', () => {
			expect(matchChangeTrigger(trigger, change({ changes: { membersAdded: ['e-1'] } }), null, STATUSES)).toEqual({ subjectTaskId: 'task-1' });
			expect(matchChangeTrigger(trigger, change({ changes: { membersRemoved: ['e-1'] } }), null, STATUSES)).toBeNull();
			// A task created with its creator as a member is not "assigned".
			expect(matchChangeTrigger(trigger, change({ action: 'created', changes: { membersAdded: ['e-1'] } }), null, STATUSES)).toBeNull();
		});
	});

	describe('ALL_SUBTASKS_DONE', () => {
		const trigger = { type: TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE };
		it('fires on the parent when a sub-task closes, asking for every sub-task done', () => {
			expect(matchChangeTrigger(trigger, moved('in-progress', 'done'), { parentId: 'parent-1' }, STATUSES)).toEqual({
				subjectTaskId: 'parent-1',
				requiresAllChildrenDone: true
			});
			expect(matchChangeTrigger(trigger, moved('open', 'cancelled'), { parentId: 'parent-1' }, STATUSES)).not.toBeNull();
		});

		it('does not fire for a task without a parent, a move between closed statuses, or a reopen', () => {
			expect(matchChangeTrigger(trigger, moved('open', 'done'), { parentId: null }, STATUSES)).toBeNull();
			expect(matchChangeTrigger(trigger, moved('done', 'completed'), { parentId: 'parent-1' }, STATUSES)).toBeNull();
			expect(matchChangeTrigger(trigger, moved('done', 'open'), { parentId: 'parent-1' }, STATUSES)).toBeNull();
		});
	});

	describe('SUBTASK_REOPENED', () => {
		const trigger = { type: TaskAutomationTriggerEnum.SUBTASK_REOPENED };
		it('fires on the parent when a closed sub-task opens again', () => {
			expect(matchChangeTrigger(trigger, moved('done', 'in-progress'), { parentId: 'parent-1' }, STATUSES)).toEqual({
				subjectTaskId: 'parent-1',
				requiresOpenChildId: 'task-1'
			});
			expect(matchChangeTrigger(trigger, moved('open', 'in-progress'), { parentId: 'parent-1' }, STATUSES)).toBeNull();
			expect(matchChangeTrigger(trigger, moved('done', 'open'), { parentId: null }, STATUSES)).toBeNull();
		});
	});

	it('leaves the schedule’s and the link’s triggers to them', () => {
		expect(matchChangeTrigger({ type: TaskAutomationTriggerEnum.DUE_DATE_PASSED }, moved('open', 'done'), null, STATUSES)).toBeNull();
		expect(matchChangeTrigger({ type: TaskAutomationTriggerEnum.LINK_CLOSED }, moved('open', 'done'), null, STATUSES)).toBeNull();
	});

	it('LINK_CLOSED fires on the linked task', () => {
		expect(matchLinkClosedTrigger({ type: TaskAutomationTriggerEnum.LINK_CLOSED }, { taskId: 'task-9' })).toEqual({ subjectTaskId: 'task-9' });
		expect(matchLinkClosedTrigger({ type: TaskAutomationTriggerEnum.STATUS_CHANGED }, { taskId: 'task-9' })).toBeNull();
	});

	it('LINK_CLOSED, merged only: a pull request when merged, also after a reopen; an issue as without it (spec FR-21)', () => {
		const any = { type: TaskAutomationTriggerEnum.LINK_CLOSED };
		const mergedOnly = { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true };
		const fired = { subjectTaskId: 'task-9' };
		const unmerged = { taskId: 'task-9', kind: 'pull_request' as const, merged: false };
		const merged = { taskId: 'task-9', kind: 'pull_request' as const, merged: true };
		const mergedAfterReopen = { ...merged, closedBefore: true };
		const issue = { taskId: 'task-9', kind: 'issue' as const };

		expect(matchLinkClosedTrigger(mergedOnly, unmerged)).toBeNull();
		expect(matchLinkClosedTrigger(mergedOnly, merged)).toEqual(fired);
		expect(matchLinkClosedTrigger(mergedOnly, mergedAfterReopen)).toEqual(fired);
		expect(matchLinkClosedTrigger(mergedOnly, issue)).toEqual(fired);

		// Without the option: every first close; the merge after a reopen is the merged-only rules' alone.
		expect(matchLinkClosedTrigger(any, unmerged)).toEqual(fired);
		expect(matchLinkClosedTrigger(any, merged)).toEqual(fired);
		expect(matchLinkClosedTrigger({ ...any, mergedOnly: false }, merged)).toEqual(fired);
		expect(matchLinkClosedTrigger(any, mergedAfterReopen)).toBeNull();
		expect(matchLinkClosedTrigger(any, issue)).toEqual(fired);
	});

	it('checks that every sub-task is closed, and that there is one', () => {
		expect(allChildrenClosed([], STATUSES)).toBe(false);
		expect(allChildrenClosed([{ id: 'a', status: 'done', taskStatusId: null }, { id: 'b', status: 'cancelled', taskStatusId: null }], STATUSES)).toBe(true);
		expect(allChildrenClosed([{ id: 'a', status: 'done', taskStatusId: null }, { id: 'b', status: 'open', taskStatusId: null }], STATUSES)).toBe(false);
	});

	it('DUE_DATE_PASSED: a due date passed by now', () => {
		const now = new Date('2026-11-11T12:00:00Z');
		expect(isDuePassed(new Date('2026-11-11T11:59:00Z'), now)).toBe(true);
		expect(isDuePassed('2026-11-11T12:00:00Z', now)).toBe(true);
		expect(isDuePassed(new Date('2026-11-12T00:00:00Z'), now)).toBe(false);
		expect(isDuePassed(null, now)).toBe(false);
		expect(isDuePassed('not a date', now)).toBe(false);
	});
});
