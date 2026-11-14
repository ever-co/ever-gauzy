import { ITaskBulkUpdateInput, TASK_BULK_UPDATE_MAX, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import {
	BulkChangeRecords,
	BulkUpdateRequestError,
	changesToUpdate,
	hasChanges,
	IBulkChangeRecord,
	normalizeBulkUpdate,
	previousWithoutRecordNames,
	recordChangesOfUpdate,
	recordIdsOf,
	recordRefusalOf,
	withRecordNames
} from './bulk-update';
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
		const after = { ...(task as Record<string, unknown>), status: TaskStatusEnum.COMPLETED, tags: first.update.tags } as never;
		const undo = changesToUpdate(after, first.previous);
		expect(undo.update).toEqual({ status: TaskStatusEnum.OPEN, tags: [{ id: 'tag-a' }, { id: 'tag-b' }] });
	});
});

describe('the records a change names', () => {
	const TENANT = '00000000-0000-4000-8000-00000000000a';
	const ORGANIZATION = '00000000-0000-4000-8000-0000000000a1';
	const OTHER = '00000000-0000-4000-8000-0000000000a2';
	const record = (id: string, extra: Partial<IBulkChangeRecord> = {}): [string, IBulkChangeRecord] => [id.toLowerCase(), { id, ...extra }];
	const records: BulkChangeRecords = {
		taskStatusId: new Map([record('s-own', { name: 'QA', value: 'qa', tenantId: TENANT, organizationId: ORGANIZATION })]),
		taskPriorityId: new Map([
			record('p-own', { name: 'P0', value: 'p0', tenantId: TENANT, organizationId: ORGANIZATION }),
			record('p-shared', { name: 'Shared', value: '', tenantId: TENANT, organizationId: null }),
			record('p-default', { name: 'Urgent', value: 'urgent', tenantId: null, organizationId: null }),
			record('p-other-organization', { name: 'Theirs', value: 'theirs', tenantId: TENANT, organizationId: OTHER }),
			record('p-other-tenant', { name: 'Foreign', value: 'foreign', tenantId: 'another-tenant', organizationId: OTHER })
		]),
		taskSizeId: new Map([record('z-own', { name: 'Huge', value: 'huge', tenantId: TENANT, organizationId: ORGANIZATION })])
	};
	const scope = { tenantId: TENANT, organizationId: ORGANIZATION };

	it('lists each record id once, whatever its case, and leaves out a cleared one', () => {
		const ids = recordIdsOf([
			{ taskId: 'a', changes: { taskPriorityId: 'P-OWN', taskSizeId: null } },
			{ taskId: 'b', changes: { taskPriorityId: 'p-own', taskStatusId: 's-own' } }
		]);
		expect(ids).toEqual({ taskStatusId: ['s-own'], taskPriorityId: ['p-own'], taskSizeId: [] });
	});

	it('takes the organization’s own record, the tenant’s shared one and a platform default', () => {
		for (const id of ['p-own', 'P-OWN', 'p-shared', 'p-default']) {
			expect(recordRefusalOf({ taskPriorityId: id }, records, scope)).toBeNull();
		}
		expect(recordRefusalOf({ taskStatusId: 's-own', taskSizeId: 'z-own', taskPriorityId: null }, records, scope)).toBeNull();
		expect(recordRefusalOf({ priority: TaskPriorityEnum.HIGH }, records, scope)).toBeNull();
	});

	it('refuses another organization’s or tenant’s record, or one that does not exist, as not found', () => {
		expect(recordRefusalOf({ taskPriorityId: 'p-other-organization' }, records, scope)).toBe(
			'TASK_PRIORITY_NOT_FOUND: taskPriorityId names no priority of this organization.'
		);
		expect(recordRefusalOf({ taskPriorityId: 'p-other-tenant' }, records, scope)).toMatch(/^TASK_PRIORITY_NOT_FOUND/);
		expect(recordRefusalOf({ taskSizeId: 'nowhere' }, records, scope)).toMatch(/^TASK_SIZE_NOT_FOUND/);
		expect(recordRefusalOf({ taskStatusId: 's-own' }, records, { tenantId: TENANT, organizationId: OTHER })).toMatch(/^TASK_STATUS_NOT_FOUND/);
		expect(recordRefusalOf({ taskStatusId: 's-own' }, records, { tenantId: 'another-tenant', organizationId: ORGANIZATION })).toMatch(
			/^TASK_STATUS_NOT_FOUND/
		);
	});

	it('takes only a platform default when the tenant is unknown, and refuses an id that was not read', () => {
		const unknownTenant = { tenantId: undefined, organizationId: ORGANIZATION };
		expect(recordRefusalOf({ taskPriorityId: 'p-default' }, records, unknownTenant)).toBeNull();
		for (const id of ['p-own', 'p-shared']) {
			expect(recordRefusalOf({ taskPriorityId: id }, records, unknownTenant)).toMatch(/^TASK_PRIORITY_NOT_FOUND/);
		}
		expect(recordRefusalOf({ taskSizeId: 'not-a-uuid' }, records, scope)).toMatch(/^TASK_SIZE_NOT_FOUND/);
	});

	it('gives a priority or size named by its record alone the record’s value, else its name', () => {
		expect(withRecordNames({ taskPriorityId: 'p-own', taskSizeId: 'z-own' }, records)).toEqual({
			taskPriorityId: 'p-own',
			priority: 'p0',
			taskSizeId: 'z-own',
			size: 'huge'
		});
		expect(withRecordNames({ taskPriorityId: 'p-shared' }, records)).toEqual({ taskPriorityId: 'p-shared', priority: 'Shared' });
	});

	it('keeps a name sent beside the record, leaves a cleared record’s name, and never names a status', () => {
		const sent = { taskPriorityId: 'p-own', priority: TaskPriorityEnum.LOW };
		expect(withRecordNames(sent, records)).toBe(sent);
		const cleared = { taskPriorityId: null };
		expect(withRecordNames(cleared, records)).toBe(cleared);
		const status = { taskStatusId: 's-own' };
		expect(withRecordNames(status, records)).toBe(status);
		const unknown = { taskSizeId: 'nowhere' };
		expect(withRecordNames(unknown, records)).toBe(unknown);
	});

	it('leaves out of the previous values a priority’s or size’s name that the record beside it gives back', () => {
		expect(previousWithoutRecordNames({ priority: 'p0' as never, taskPriorityId: 'p-own', size: 'huge' as never, taskSizeId: 'z-own' }, records)).toEqual({
			taskPriorityId: 'p-own',
			taskSizeId: 'z-own'
		});
		// The shared record has no value: its name is what it gives back.
		expect(previousWithoutRecordNames({ priority: 'Shared' as never, taskPriorityId: 'p-shared' }, records)).toEqual({ taskPriorityId: 'p-shared' });
	});

	it('keeps a name its record does not give back, one with no record, and a status', () => {
		const renamed = { priority: 'p-zero' as never, taskPriorityId: 'p-own' };
		expect(previousWithoutRecordNames(renamed, records)).toBe(renamed);
		const none = { priority: TaskPriorityEnum.LOW, taskPriorityId: null };
		expect(previousWithoutRecordNames(none, records)).toBe(none);
		const unknown = { size: 'huge' as never, taskSizeId: 'nowhere' };
		expect(previousWithoutRecordNames(unknown, records)).toBe(unknown);
		const status = { status: 'qa' as never, taskStatusId: 's-own' };
		expect(previousWithoutRecordNames(status, records)).toBe(status);
	});

	it('records the name a priority had, so the undo puts it back', () => {
		const task = { id: 't1', priority: TaskPriorityEnum.LOW, taskPriorityId: null } as never;
		const { update, previous } = changesToUpdate(task, withRecordNames({ taskPriorityId: 'p-own' }, records));
		expect(update).toEqual({ priority: 'p0', taskPriorityId: 'p-own' });
		expect(previous).toEqual({ priority: TaskPriorityEnum.LOW, taskPriorityId: null });
	});
});

describe('the records a single update moves a task to', () => {
	const held = { taskStatusId: 's-held', taskPriorityId: 'p-held', taskSizeId: null };

	it('takes a record named by its id or by its relation, with the name sent beside it', () => {
		const sent = { title: 'One', taskPriorityId: 'p-new', taskSize: { id: 'z-new', name: 'Huge' }, priority: 'P0' };
		const { update, changes, named } = recordChangesOfUpdate(sent, held);
		expect(update).toBe(sent);
		expect(changes).toEqual({ taskPriorityId: 'p-new', priority: 'P0', taskSizeId: 'z-new' });
		expect(named).toEqual({ taskPriorityId: 'p-new', taskSizeId: 'z-new' });
	});

	it('takes no change from the records the task holds, whatever their case, a cleared one, or a name alone', () => {
		const sent = {
			taskStatusId: 'S-HELD',
			taskStatus: { id: 's-held' },
			taskPriority: { id: 'p-held', value: 'p0' },
			priority: TaskPriorityEnum.HIGH,
			taskSizeId: null,
			size: 'large'
		};
		const { update, changes, named } = recordChangesOfUpdate(sent, held);
		expect(update).toBe(sent);
		expect(hasChanges(changes)).toBe(false);
		expect(named).toEqual({ taskStatusId: 's-held', taskPriorityId: 'p-held', taskSizeId: null });
	});

	it('judges every record named when the task holds none', () => {
		expect(recordChangesOfUpdate({ taskStatusId: 's-held', taskPriority: { id: 'p-held' } }, {}).changes).toEqual({
			taskStatusId: 's-held',
			taskPriorityId: 'p-held'
		});
	});

	it('saves the new id a client sends beside the relation the task holds, in both places', () => {
		const sent = { taskPriorityId: 'p-new', taskPriority: { id: 'p-held', name: 'Held' }, priority: 'urgent' };
		const { update, changes } = recordChangesOfUpdate(sent, held);
		expect(update).toEqual({ taskPriorityId: 'p-new', taskPriority: { id: 'p-new' }, priority: 'urgent' });
		expect(sent.taskPriority).toEqual({ id: 'p-held', name: 'Held' });
		expect(changes).toEqual({ taskPriorityId: 'p-new', priority: 'urgent' });

		const cleared = recordChangesOfUpdate({ taskStatusId: null, taskStatus: { id: 's-held' } }, held);
		expect(cleared).toEqual({ update: { taskStatusId: null, taskStatus: null }, changes: {}, named: { taskStatusId: null } });
	});

	it('saves a new id beside a cleared relation when the task holds none, and clears it when the id is the held one', () => {
		const added = recordChangesOfUpdate({ taskSize: null, taskSizeId: 'z-new' }, held);
		expect(added).toEqual({
			update: { taskSize: { id: 'z-new' }, taskSizeId: 'z-new' },
			changes: { taskSizeId: 'z-new' },
			named: { taskSizeId: 'z-new' }
		});
		const cleared = recordChangesOfUpdate({ taskPriority: null, taskPriorityId: 'p-held' }, held);
		expect(cleared).toEqual({ update: { taskPriority: null, taskPriorityId: null }, changes: {}, named: { taskPriorityId: null } });
		const relationAlone = { taskPriority: null };
		expect(recordChangesOfUpdate(relationAlone, held)).toEqual({ update: relationAlone, changes: {}, named: { taskPriorityId: null } });
	});

	it('saves a new relation sent beside the id the task holds, and the relation when both change, as the save takes it', () => {
		const relationChanged = recordChangesOfUpdate({ taskPriorityId: 'p-held', taskPriority: { id: 'p-new' } }, held);
		expect(relationChanged).toEqual({
			update: { taskPriorityId: 'p-new', taskPriority: { id: 'p-new' } },
			changes: { taskPriorityId: 'p-new' },
			named: { taskPriorityId: 'p-new' }
		});
		const bothChanged = recordChangesOfUpdate({ taskPriorityId: 'p-other', taskPriority: { id: 'p-new' } }, held);
		expect(bothChanged.changes).toEqual({ taskPriorityId: 'p-new' });
		expect(bothChanged.update).toEqual({ taskPriorityId: 'p-new', taskPriority: { id: 'p-new' } });
	});

	it('reads a relation without an id as naming none', () => {
		const sent = { taskSize: { name: 'Huge' }, taskSizeId: 'z-new' };
		expect(recordChangesOfUpdate(sent, held)).toEqual({ update: sent, changes: { taskSizeId: 'z-new' }, named: { taskSizeId: 'z-new' } });
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
