import { ITaskBulkUpdateInput, TASK_BULK_UPDATE_MAX, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { BulkUpdateRequestError, changesToUpdate, hasChanges, normalizeBulkUpdate } from './bulk-update';
import { relationsTreeOf } from './built-in-views';

describe('normalizeBulkUpdate', () => {
	it('turns taskIds + changes into items, each task once', () => {
		const items = normalizeBulkUpdate({ taskIds: ['a', 'b', 'a'], changes: { status: TaskStatusEnum.COMPLETED } } as ITaskBulkUpdateInput);
		expect(items).toEqual([
			{ taskId: 'a', changes: { status: TaskStatusEnum.COMPLETED } },
			{ taskId: 'b', changes: { status: TaskStatusEnum.COMPLETED } }
		]);
	});

	it('merges repeated items, the later change winning', () => {
		const items = normalizeBulkUpdate({
			items: [
				{ taskId: 'a', changes: { priority: TaskPriorityEnum.HIGH } },
				{ taskId: 'a', changes: { priority: TaskPriorityEnum.LOW, isArchived: true } }
			]
		} as ITaskBulkUpdateInput);
		expect(items).toEqual([{ taskId: 'a', changes: { priority: TaskPriorityEnum.LOW, isArchived: true } }]);
	});

	it('refuses an empty, an ambiguous, an oversize and a change-less request, each with its code', () => {
		const codeOf = (input: ITaskBulkUpdateInput) => {
			try {
				normalizeBulkUpdate(input);
				return null;
			} catch (error) {
				return (error as BulkUpdateRequestError).code;
			}
		};
		expect(codeOf({} as ITaskBulkUpdateInput)).toBe('BULK_UPDATE_EMPTY');
		expect(codeOf({ taskIds: [], items: [] } as ITaskBulkUpdateInput)).toBe('BULK_UPDATE_EMPTY');
		expect(codeOf({ taskIds: ['a'], changes: { isArchived: true }, items: [{ taskId: 'b', changes: { isArchived: true } }] } as ITaskBulkUpdateInput)).toBe(
			'BULK_UPDATE_AMBIGUOUS'
		);
		const manyItems = Array.from({ length: TASK_BULK_UPDATE_MAX + 1 }, (_, at) => ({ taskId: `t${at}`, changes: { isArchived: true } }));
		expect(codeOf({ items: manyItems } as ITaskBulkUpdateInput)).toBe('BULK_LIMIT_EXCEEDED');
		expect(codeOf({ items: [{ taskId: 'a', changes: {} }] } as ITaskBulkUpdateInput)).toBe('BULK_UPDATE_NO_CHANGES');
		expect(() => normalizeBulkUpdate({} as ITaskBulkUpdateInput)).toThrow(BulkUpdateRequestError);
		expect(() => normalizeBulkUpdate({ taskIds: ['a'], changes: { isArchived: true }, items: [{ taskId: 'b', changes: { isArchived: true } }] } as ITaskBulkUpdateInput)).toThrow(
			/not both/
		);
		const many = Array.from({ length: TASK_BULK_UPDATE_MAX + 1 }, (_, at) => `t${at}`);
		expect(() => normalizeBulkUpdate({ taskIds: many, changes: { isArchived: true } } as ITaskBulkUpdateInput)).toThrow(/at most/);
		expect(() => normalizeBulkUpdate({ taskIds: ['a'], changes: {} } as ITaskBulkUpdateInput)).toThrow(/at least one change/);
		expect(hasChanges({ dueDate: null })).toBe(true);
		expect(hasChanges({})).toBe(false);
	});
});

describe('changesToUpdate', () => {
	const task = {
		id: 't1',
		status: TaskStatusEnum.OPEN,
		taskStatusId: 's-open',
		priority: TaskPriorityEnum.LOW,
		taskPriorityId: 'p-low',
		size: undefined,
		taskSizeId: null,
		projectId: 'p1',
		organizationSprintId: null,
		dueDate: new Date('2026-11-10T00:00:00Z'),
		isArchived: false,
		tags: [{ id: 'tag-a' }, { id: 'tag-b' }],
		members: [{ id: 'emp-1' }]
	} as never;

	it('records the previous value of every scalar it changes', () => {
		const { update, previous } = changesToUpdate(task, { status: TaskStatusEnum.COMPLETED, taskStatusId: 's-done', dueDate: null });
		expect(update).toEqual({ status: TaskStatusEnum.COMPLETED, taskStatusId: 's-done', dueDate: null });
		expect(previous).toEqual({ status: TaskStatusEnum.OPEN, taskStatusId: 's-open', dueDate: new Date('2026-11-10T00:00:00Z') });
	});

	it('adds and removes tags and members from the task as it is, and remembers the full lists', () => {
		const { update, previous } = changesToUpdate(task, { addTagIds: ['tag-c', 'tag-a'], removeTagIds: ['tag-b'], addMemberIds: ['emp-2'] });
		expect(update.tags).toEqual([{ id: 'tag-a' }, { id: 'tag-c' }]);
		expect(update.members).toEqual([{ id: 'emp-1' }, { id: 'emp-2' }]);
		expect(previous).toEqual({ setTagIds: ['tag-a', 'tag-b'], setMemberIds: ['emp-1'] });
	});

	it('replaces the lists with set, and leaves untouched lists alone', () => {
		const { update, previous } = changesToUpdate(task, { setMemberIds: [] , isArchived: true });
		expect(update.members).toEqual([]);
		expect(update.tags).toBeUndefined();
		expect(update.isArchived).toBe(true);
		expect(previous).toEqual({ isArchived: false, setMemberIds: ['emp-1'] });
	});

	it('undoes with the previous values as the next changes', () => {
		const first = changesToUpdate(task, { addTagIds: ['tag-c'], status: TaskStatusEnum.COMPLETED });
		const after = { ...task, status: TaskStatusEnum.COMPLETED, tags: first.update.tags } as never;
		const undo = changesToUpdate(after, first.previous);
		expect(undo.update).toEqual({ status: TaskStatusEnum.OPEN, tags: [{ id: 'tag-a' }, { id: 'tag-b' }] });
	});
});

describe('relationsTreeOf', () => {
	it('nests dotted names and keeps leaves', () => {
		expect(relationsTreeOf(['members', 'members.user', 'tags', 'project.organization'])).toEqual({
			members: { user: true },
			tags: true,
			project: { organization: true }
		});
	});

	it('refuses a segment that names the prototype and leaves shared objects alone', () => {
		expect(() => relationsTreeOf(['__proto__.polluted'])).toThrow(/not a relation/);
		expect(() => relationsTreeOf(['constructor.prototype.polluted'])).toThrow(/not a relation/);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});
});
