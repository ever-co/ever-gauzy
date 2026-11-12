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
		expect(statusRowOf({ status: 'done', taskStatusId: 'st-done' }, STATUSES)?.id).toBe('st-done');
		expect(statusRowOf({ status: null, taskStatusId: 'st-done' }, STATUSES)?.id).toBe('st-done');
		expect(statusRowOf({ status: 'Done', taskStatusId: null }, STATUSES)?.id).toBe('st-done');
		expect(statusRowOf({ status: 'nothing', taskStatusId: null }, STATUSES)).toBeUndefined();
	});

	it('reads the value when it moved away from the row its id names (a value-only update)', () => {
		const reopened = { status: 'open', taskStatusId: 'st-done' };
		expect(statusRowOf(reopened, STATUSES)?.id).toBe('st-open');
		expect(classifyStatus(reopened, STATUSES)).toBe(TaskAutomationStatusCategoryEnum.TODO);
		expect(isClosedStatus(reopened, STATUSES)).toBe(false);
		expect(statusMatches(reopened, ['st-done'], STATUSES)).toBe(false);
		expect(statusMatches(reopened, ['open'], STATUSES)).toBe(true);
		expect(priorityMatches({ priority: 'low', taskPriorityId: 'pr-high' }, ['pr-high'], CATALOG.priorities)).toBe(false);
		expect(priorityMatches({ priority: 'low', taskPriorityId: 'pr-high' }, ['pr-low'], CATALOG.priorities)).toBe(true);
		// A value alone still finds its row, so a list of row ids matches it.
		expect(priorityMatches({ priority: 'high', taskPriorityId: null }, ['pr-high'], CATALOG.priorities)).toBe(true);
	});

	it('never writes a row id as a value', () => {
		const valueless = [{ id: 'st-blank', value: null, name: 'Blank', projectId: null, order: 1 }];
		expect(resolveNamedStatus('st-blank', null, valueless)).toBeNull();
		expect(resolveNamedPriority('pr-blank', null, [{ id: 'pr-blank', value: null, name: 'Blank', projectId: null }])).toBeNull();
	});

	it('never takes another project’s row for a value, a name or a category', () => {
		// `shipped` is project-web's own status: a task of no project, or of another project, has no row of it.
		expect(statusRowOf({ status: 'shipped', taskStatusId: null }, STATUSES)).toBeUndefined();
		expect(statusRowOf({ status: 'shipped', taskStatusId: null, projectId: 'project-other' }, STATUSES)).toBeUndefined();
		expect(statusRowOf({ status: 'shipped', taskStatusId: null, projectId: 'project-web' }, STATUSES)?.id).toBe('st-shipped');
		// Classified by the task's own project: a `shipped` task of project-web is done, of another project unknown.
		expect(isDoneStatus({ status: 'shipped', taskStatusId: null, projectId: 'project-web' }, STATUSES)).toBe(true);
		expect(classifyStatus({ status: 'shipped', taskStatusId: null, projectId: 'project-other' }, STATUSES)).toBeNull();
		// An id of another project's status stands for its value here; no such value here, no status.
		expect(resolveNamedStatus('st-shipped', 'project-other', STATUSES)).toBeNull();
		expect(resolveNamedStatus('st-shipped', 'project-web', STATUSES)).toEqual({ value: 'shipped', id: 'st-shipped' });
		// The category's fallback value of another project only: the value without a row.
		const otherOnly = [{ id: 'b-done', value: 'done', name: 'Done', projectId: 'project-b', order: 1 }];
		expect(firstStatusOfCategory(TaskAutomationStatusCategoryEnum.DONE, 'project-a', otherOnly)).toBeNull();
		const priorities = [{ id: 'b-high', value: 'high', name: 'High', projectId: 'project-b' }];
		expect(resolveNamedPriority('high', 'project-a', priorities)).toEqual({ value: 'high', id: null });
		expect(resolveNamedPriority('b-high', 'project-a', priorities)).toEqual({ value: 'high', id: null });
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
