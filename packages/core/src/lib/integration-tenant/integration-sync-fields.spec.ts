import { sanitizeRichHtml } from '../core/html-sanitizer';
import {
	mergeSyncedFields,
	parseSyncedValues,
	sameSyncedValue,
	syncedValuesOf,
	SyncedTaskValues,
	taskPatchOf,
	withoutKeptFields
} from './integration-sync-fields';

/**
 * The three-way merge of the task integrations' inbound apply (Linear, Asana, Trello): what both sides last agreed
 * on, the task now, the provider now. A field changed on one side follows that side; changed on both to different
 * values, the provider wins and the task's value is a conflict.
 */
describe('integration sync fields', () => {
	const agreed: SyncedTaskValues = syncedValuesOf({ title: 'A', description: 'Body', status: 'Todo', priority: 'Low', dueDate: '2026-11-10T00:00:00.000Z' });

	describe('syncedValuesOf', () => {
		it('trims text, empties to null, and keeps a due date to the second', () => {
			expect(syncedValuesOf({ title: '  T  ', description: '   ', status: null, priority: undefined, dueDate: new Date('2026-11-10T08:09:10.789Z') })).toEqual({
				title: 'T',
				description: null,
				status: null,
				priority: null,
				dueDate: '2026-11-10T08:09:10.000Z'
			});
		});

		it('takes a description in the form the task store keeps it, so a raw value and its saved copy compare equal', () => {
			const raw = 'Fish & chips <a href="https://example.com" onclick="steal()">menu</a><script>x()</script>';
			const saved = sanitizeRichHtml(raw);
			expect(saved).not.toBe(raw);
			expect(syncedValuesOf({ description: raw }).description).toBe(syncedValuesOf({ description: saved }).description);
			expect(syncedValuesOf({ description: raw }).description).toBe(saved.trim());
		});

		it('reads an unreadable due date as none', () => {
			expect(syncedValuesOf({ dueDate: 'not a date' }).dueDate).toBeNull();
		});
	});

	describe('sameSyncedValue', () => {
		it('compares statuses and priorities whatever the case, the rest exactly', () => {
			expect(sameSyncedValue('status', 'In Progress', 'in progress')).toBe(true);
			expect(sameSyncedValue('priority', 'HIGH', 'high')).toBe(true);
			expect(sameSyncedValue('title', 'Fix', 'fix')).toBe(false);
			expect(sameSyncedValue('description', null, null)).toBe(true);
			expect(sameSyncedValue('description', null, 'x')).toBe(false);
		});
	});

	describe('mergeSyncedFields', () => {
		it('applies everything when nothing was agreed yet, or there is no task', () => {
			const external = { ...agreed, title: 'B' };
			expect(mergeSyncedFields(null, { ...agreed, title: 'C' }, external)).toEqual({ keepPlatform: [], conflicts: [] });
			expect(mergeSyncedFields(agreed, null, external)).toEqual({ keepPlatform: [], conflicts: [] });
		});

		it('applies a change made only by the provider', () => {
			expect(mergeSyncedFields(agreed, agreed, { ...agreed, title: 'B', status: 'Done' })).toEqual({ keepPlatform: [], conflicts: [] });
		});

		it('keeps a change made only on the platform', () => {
			expect(mergeSyncedFields(agreed, { ...agreed, status: 'In Review', dueDate: null }, agreed)).toEqual({ keepPlatform: ['status', 'dueDate'], conflicts: [] });
		});

		it('has nothing to decide when both sides made the same change', () => {
			expect(mergeSyncedFields(agreed, { ...agreed, title: 'B', status: 'done' }, { ...agreed, title: 'B', status: 'Done' })).toEqual({ keepPlatform: [], conflicts: [] });
		});

		it('records a field changed on both sides to different values, the provider winning', () => {
			const merge = mergeSyncedFields(agreed, { ...agreed, title: 'Platform', priority: 'High' }, { ...agreed, title: 'Provider', description: 'New body' });
			expect(merge.conflicts).toEqual([{ field: 'title', synced: 'A', platform: 'Platform', external: 'Provider' }]);
			// The priority changed only on the platform: kept.
			expect(merge.keepPlatform).toEqual(['priority']);
		});

		it('treats clearing a field as a change', () => {
			const merge = mergeSyncedFields(agreed, { ...agreed, description: null }, { ...agreed, description: 'Edited' });
			expect(merge.conflicts).toEqual([{ field: 'description', synced: 'Body', platform: null, external: 'Edited' }]);
		});
	});

	describe('parseSyncedValues', () => {
		it('reads stored values back', () => {
			expect(parseSyncedValues(JSON.stringify(agreed))).toEqual(agreed);
		});

		it('answers null for nothing or something unreadable, and null for a field of the wrong type', () => {
			expect(parseSyncedValues(null)).toBeNull();
			expect(parseSyncedValues('{')).toBeNull();
			expect(parseSyncedValues('[]')).toBeNull();
			expect(parseSyncedValues(JSON.stringify({ title: 3, status: 'Todo' }))).toEqual({ title: null, description: null, status: 'Todo', priority: null, dueDate: null });
		});
	});

	describe('task columns', () => {
		const task = { title: 'T', status: 'In Review', taskStatusId: 's-1', priority: null, taskPriorityId: undefined, dueDate: new Date('2026-11-10T00:00:00.000Z') };

		it('takes a status or a priority with its row id, and a due date as text', () => {
			expect(taskPatchOf(task, 'status')).toEqual({ status: 'In Review', taskStatusId: 's-1' });
			expect(taskPatchOf(task, 'priority')).toEqual({ priority: null, taskPriorityId: null });
			expect(taskPatchOf(task, 'dueDate')).toEqual({ dueDate: '2026-11-10T00:00:00.000Z' });
		});

		it('leaves the kept fields out of an inbound write', () => {
			const entity = { title: 'B', description: 'D', status: 'Todo', taskStatusId: 's-0', priority: 'Low', taskPriorityId: 'p-0', dueDate: null, projectId: 'p' };
			expect(withoutKeptFields(entity, ['status', 'dueDate'])).toEqual({ title: 'B', description: 'D', priority: 'Low', taskPriorityId: 'p-0', projectId: 'p' });
			expect(withoutKeptFields(entity, [])).toBe(entity);
		});
	});
});
