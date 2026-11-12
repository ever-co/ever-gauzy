import { TaskAutomationStatusCategoryEnum } from '@gauzy/contracts';
import {
	classifyStatus,
	firstStatusOfCategory,
	isClosedStatus,
	isDoneStatus,
	priorityMatches,
	resolveNamedPriority,
	resolveNamedStatus,
	statusMatches,
	statusRowOf
} from './status-categories';
import { CATALOG, STATUSES } from './testing/fixtures';

describe('status categories', () => {
	it('classifies by the row’s workflow flags first, then by the value', () => {
		expect(classifyStatus({ status: 'open', taskStatusId: 'st-open' }, STATUSES)).toBe(TaskAutomationStatusCategoryEnum.TODO);
		expect(classifyStatus({ status: 'shipped', taskStatusId: 'st-shipped' }, STATUSES)).toBe(TaskAutomationStatusCategoryEnum.DONE);
		// No flags on the row: its value decides.
		expect(classifyStatus({ status: 'completed', taskStatusId: 'st-completed' }, STATUSES)).toBe(TaskAutomationStatusCategoryEnum.DONE);
		expect(classifyStatus({ status: 'ready-for-review', taskStatusId: null }, STATUSES)).toBe(TaskAutomationStatusCategoryEnum.IN_PROGRESS);
		expect(classifyStatus({ status: 'backlog', taskStatusId: null }, [])).toBe(TaskAutomationStatusCategoryEnum.TODO);
		expect(classifyStatus({ status: 'cancelled', taskStatusId: null }, STATUSES)).toBe('cancelled');
		expect(classifyStatus({ status: 'waiting', taskStatusId: 'st-custom' }, STATUSES)).toBeNull();
		expect(classifyStatus({ status: null, taskStatusId: null }, STATUSES)).toBeNull();
	});

	it('counts done and cancelled as closed, and only done as done', () => {
		expect(isClosedStatus({ status: 'done', taskStatusId: null }, STATUSES)).toBe(true);
		expect(isClosedStatus({ status: 'cancelled', taskStatusId: null }, STATUSES)).toBe(true);
		expect(isClosedStatus({ status: 'in-progress', taskStatusId: null }, STATUSES)).toBe(false);
		expect(isDoneStatus({ status: 'cancelled', taskStatusId: null }, STATUSES)).toBe(false);
		expect(isDoneStatus({ status: 'DONE', taskStatusId: null }, STATUSES)).toBe(true);
	});

	it('finds a status row by id, else by value, the project’s own first', () => {
		expect(statusRowOf({ status: 'x', taskStatusId: 'st-done' }, STATUSES)?.id).toBe('st-done');
		expect(statusRowOf({ status: 'Done', taskStatusId: null }, STATUSES)?.id).toBe('st-done');
		expect(statusRowOf({ status: 'nothing', taskStatusId: null }, STATUSES)).toBeUndefined();
	});

	it('matches a status against ids, values and names without regard to case', () => {
		const ref = { status: 'in-progress', taskStatusId: 'st-progress' };
		expect(statusMatches(ref, ['st-progress'], STATUSES)).toBe(true);
		expect(statusMatches(ref, ['IN-PROGRESS'], STATUSES)).toBe(true);
		expect(statusMatches(ref, ['in progress'], STATUSES)).toBe(true);
		expect(statusMatches(ref, ['done'], STATUSES)).toBe(false);
		expect(statusMatches(ref, [], STATUSES)).toBe(false);
	});

	it('matches a priority by id, value or name', () => {
		expect(priorityMatches({ priority: 'high', taskPriorityId: null }, ['High'], CATALOG.priorities)).toBe(true);
		expect(priorityMatches({ priority: null, taskPriorityId: 'pr-low' }, ['low'], CATALOG.priorities)).toBe(true);
		expect(priorityMatches({ priority: 'low', taskPriorityId: null }, ['high'], CATALOG.priorities)).toBe(false);
	});

	it('picks the first status of a category: the project’s, then the organization’s, then a default value', () => {
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.DONE, 'project-web', STATUSES)?.id).toBe('st-shipped');
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.DONE, null, STATUSES)?.id).toBe('st-done');
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.IN_PROGRESS, null, STATUSES)?.id).toBe('st-progress');
		// No flagged row: the default value's row.
		const unflagged = STATUSES.map((row) => ({ ...row, isTodo: false, isInProgress: false, isDone: false }));
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.TODO, null, unflagged)?.id).toBe('st-open');
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.DONE, null, [])).toBeNull();
	});

	it('resolves a named status or priority to its row, or to a default value without one', () => {
		expect(resolveNamedStatus('st-done', null, STATUSES)).toEqual({ value: 'done', id: 'st-done' });
		expect(resolveNamedStatus('Done', null, STATUSES)).toEqual({ value: 'done', id: 'st-done' });
		expect(resolveNamedStatus('blocked', null, [])).toEqual({ value: 'blocked', id: null });
		expect(resolveNamedStatus('nope', null, STATUSES)).toBeNull();
		expect(resolveNamedPriority('HIGH', null, CATALOG.priorities)).toEqual({ value: 'high', id: 'pr-high' });
		expect(resolveNamedPriority('urgent', null, CATALOG.priorities)).toEqual({ value: 'urgent', id: null });
		expect(resolveNamedPriority('whenever', null, CATALOG.priorities)).toBeNull();
	});

	it('resolves a status by its display name, as saving a rule accepts it', () => {
		const review = [
			...STATUSES,
			{ id: 'st-review', value: 'ready-for-review', name: 'Ready for review', projectId: null, order: 3, isTodo: false, isInProgress: true, isDone: false },
			{ id: 'st-review-p', value: 'review-p', name: 'Ready for review', projectId: 'p-1', order: 3, isTodo: false, isInProgress: true, isDone: false }
		];
		expect(resolveNamedStatus('ready for REVIEW', null, review)).toEqual({ value: 'ready-for-review', id: 'st-review' });
		expect(resolveNamedStatus('Ready for review', 'p-1', review)).toEqual({ value: 'review-p', id: 'st-review-p' });
	});
});
