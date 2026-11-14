import { ID, ITaskBulkUpdateOutcome, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import {
	bulkRequest,
	changedTaskIds,
	deleteOutcome,
	dueDateChanges,
	hasChanges,
	priorityChanges,
	sanitizeChanges,
	statusChanges,
	summarizeOutcome,
	restoredInPart,
	undoLosses,
	undoRequest
} from './bulk-undo';

const scope = { organizationId: 'org' as ID, tenantId: 'tenant' as ID };

describe('bulk request and undo', () => {
	describe('the changes', () => {
		it('names a built-in status by id and name, a custom one by id alone', () => {
			expect(statusChanges({ id: 's1', value: 'in-progress', name: 'in-progress' })).toEqual({
				taskStatusId: 's1',
				status: TaskStatusEnum.IN_PROGRESS
			});
			expect(statusChanges({ id: 's2', value: 'waiting-on-client', name: 'Waiting on client' })).toEqual({
				taskStatusId: 's2'
			});
			expect(priorityChanges({ id: 'p1', value: 'urgent', name: 'urgent' })).toEqual({
				taskPriorityId: 'p1',
				priority: TaskPriorityEnum.URGENT
			});
		});

		it('drops what the platform would refuse, and keeps nulls that clear a field', () => {
			expect(
				sanitizeChanges({ status: 'nope' as never, taskStatusId: null, dueDate: null, extra: 1 } as never)
			).toEqual({ taskStatusId: null, dueDate: null });
			expect(hasChanges({})).toBe(false);
			expect(hasChanges({ isArchived: false })).toBe(true);
		});

		it('sets a due date as the day picked in the date-only form (midnight UTC), or clears it', () => {
			const due = dueDateChanges(new Date(2026, 10, 20, 9, 30)).dueDate as Date;
			expect(due.toISOString()).toBe('2026-11-20T00:00:00.000Z');
			expect(dueDateChanges(null)).toEqual({ dueDate: null });
		});
	});

	describe('the request', () => {
		it('sends the selection once each, with the scope, in one request', () => {
			const built = bulkRequest(['a', 'b', 'a'] as ID[], { addTagIds: ['t1'] as ID[] }, scope);
			expect(built).toEqual({
				request: {
					organizationId: 'org',
					tenantId: 'tenant',
					taskIds: ['a', 'b'],
					changes: { addTagIds: ['t1'] }
				}
			});
		});

		it('refuses an empty selection, one over the limit, and changes that change nothing', () => {
			expect(bulkRequest([], { isArchived: true }, scope)).toEqual({ refusal: 'empty' });
			expect(
				bulkRequest(
					Array.from({ length: 101 }, (_, index) => `t${index}` as ID),
					{ isArchived: true },
					scope
				)
			).toEqual({ refusal: 'limit' });
			expect(bulkRequest(['a'] as ID[], { status: 'nope' as never }, scope)).toEqual({ refusal: 'no-changes' });
		});
	});

	describe('the outcome and its undo', () => {
		const outcome: ITaskBulkUpdateOutcome = {
			applied: 2,
			refused: 1,
			results: [
				{ taskId: 'a' as ID, ok: true, previous: { taskStatusId: 's0' as ID, status: TaskStatusEnum.OPEN } },
				{
					taskId: 'b' as ID,
					ok: true,
					previous: { setTagIds: ['t9'] as ID[], status: 'legacy-name' as never }
				},
				{ taskId: 'c' as ID, ok: false, error: 'Forbidden' }
			]
		};

		it('puts back the previous values of the tasks that changed, as the platform undo form (items)', () => {
			expect(undoRequest(outcome, scope)).toEqual({
				organizationId: 'org',
				tenantId: 'tenant',
				items: [
					{ taskId: 'a', changes: { taskStatusId: 's0', status: 'open' } },
					// A previous status name the platform no longer takes would refuse the whole undo: it is left out.
					{ taskId: 'b', changes: { setTagIds: ['t9'] } }
				]
			});
		});

		it('names the tasks an undo puts back only in part (an old name the platform does not take)', () => {
			expect(undoLosses(outcome)).toEqual(['b']);
			expect(
				undoLosses({
					applied: 1,
					refused: 0,
					results: [{ taskId: 'a' as ID, ok: true, previous: { status: null } }]
				})
			).toEqual([]);
			expect(undoLosses(null)).toEqual([]);
		});

		it('takes a priority or size the platform puts back by its record as put back whole, and any name left out as a loss', () => {
			const previousOf = (previous: Record<string, unknown>) => ({
				applied: 1,
				refused: 0,
				results: [{ taskId: 'a' as ID, ok: true, previous: previous as never }]
			});
			// The platform leaves out a team's own name that the record beside it gives back: nothing is left out here.
			expect(undoLosses(previousOf({ taskPriorityId: 'p-own' }))).toEqual([]);
			expect(undoLosses(previousOf({ taskSizeId: 'z-own' }))).toEqual([]);
			// A name it answers is one its record does not give back (none, or renamed since): leaving it out loses it.
			expect(undoLosses(previousOf({ priority: 'p0', taskPriorityId: 'p-own' }))).toEqual(['a']);
			expect(undoLosses(previousOf({ priority: 'p0', taskPriorityId: null }))).toEqual(['a']);
			expect(undoLosses(previousOf({ size: 'huge' }))).toEqual(['a']);
			expect(undoLosses(previousOf({ status: 'legacy-name', taskStatusId: 's0' }))).toEqual(['a']);
		});

		it('counts only those the undo did put back: a refused one is not partly restored', () => {
			const lossy = ['b', 'd'] as ID[];
			expect(
				restoredInPart(lossy, {
					applied: 2,
					refused: 1,
					results: [
						{ taskId: 'a' as ID, ok: true },
						{ taskId: 'b' as ID, ok: false, error: 'Forbidden' },
						{ taskId: 'd' as ID, ok: true }
					]
				})
			).toBe(1);
			expect(restoredInPart(lossy, null)).toBe(0);
			expect(restoredInPart([], { applied: 1, refused: 0, results: [{ taskId: 'a' as ID, ok: true }] })).toBe(0);
		});

		it('has nothing to undo when nothing changed', () => {
			expect(
				undoRequest({ applied: 0, refused: 1, results: [{ taskId: 'c' as ID, ok: false, error: 'x' }] }, scope)
			).toBeNull();
			expect(undoRequest(null, scope)).toBeNull();
			expect(
				undoRequest({ applied: 1, refused: 0, results: [{ taskId: 'a' as ID, ok: true, previous: {} }] }, scope)
			).toBeNull();
		});

		it('sums the outcome up for the toast and names the refused tasks', () => {
			expect(summarizeOutcome(outcome)).toEqual({
				applied: 2,
				refused: 1,
				refusals: [{ taskId: 'c', error: 'Forbidden' }]
			});
			expect(changedTaskIds(outcome)).toEqual(['a', 'b']);
			expect(summarizeOutcome({ results: [{ taskId: 'a' as ID, ok: true }] } as ITaskBulkUpdateOutcome)).toEqual({
				applied: 1,
				refused: 0,
				refusals: []
			});
		});

		it('sums deletes made one by one the same way', () => {
			expect(
				deleteOutcome([
					{ taskId: 'a' as ID, ok: true },
					{ taskId: 'b' as ID, ok: false, error: 'You can only delete a task of a team you manage.' }
				])
			).toEqual({
				applied: 1,
				refused: 1,
				refusals: [{ taskId: 'b', error: 'You can only delete a task of a team you manage.' }]
			});
		});
	});
});
