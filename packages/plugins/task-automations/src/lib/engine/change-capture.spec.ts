import { ActionTypeEnum, BaseEntityEnum } from '@gauzy/contracts';
import { changeFromActivity, parseChangeEvent } from './change-capture';

const fact = (previousValues: Array<Record<string, unknown>>, updatedValues: Array<Record<string, unknown>>, overrides = {}) => ({
	entity: BaseEntityEnum.Task,
	entityId: 'task-1',
	action: ActionTypeEnum.Updated,
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	previousValues,
	updatedValues,
	...overrides
});

describe('change capture', () => {
	it('turns a task created into a created change', () => {
		expect(changeFromActivity(fact([], [], { action: ActionTypeEnum.Created }), { actorUserId: 'user-1' })).toEqual({
			taskId: 'task-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			action: 'created',
			changes: {},
			actorUserId: 'user-1',
			depth: 0,
			chain: []
		});
	});

	it('reads the status, its id, the priority, the parent and the due date before and after', () => {
		const change = changeFromActivity(
			fact(
				[{ status: 'open' }, { taskStatusId: 'st-open' }, { priority: null }, { parentId: null }, { dueDate: new Date('2026-11-10T00:00:00Z') }],
				[{ status: 'done' }, { taskStatusId: 'st-done' }, { priority: 'high' }, { parentId: 'p-1' }, { dueDate: '2026-11-12T00:00:00.000Z' }]
			)
		);
		expect(change?.changes).toEqual({
			status: { from: 'open', to: 'done' },
			taskStatusId: { from: 'st-open', to: 'st-done' },
			priority: { from: null, to: 'high' },
			parentId: { from: null, to: 'p-1' },
			dueDate: { from: '2026-11-10T00:00:00.000Z', to: '2026-11-12T00:00:00.000Z' }
		});
	});

	it('takes a relation object for an id (`taskStatus: { id }`)', () => {
		const change = changeFromActivity(fact([{ taskStatus: { id: 'st-open' } }], [{ taskStatus: { id: 'st-done' } }]));
		expect(change?.changes.taskStatusId).toEqual({ from: 'st-open', to: 'st-done' });
	});

	it('compares the assignees as sets: the whole task sent back unchanged adds no one', () => {
		const unchanged = changeFromActivity(fact([{ members: [{ id: 'e-1', firstName: 'A' }] }], [{ members: [{ id: 'e-1' }] }]));
		expect(unchanged).toBeNull();
		const added = changeFromActivity(fact([{ members: [{ id: 'e-1' }] }], [{ members: [{ id: 'e-1' }, { id: 'e-2' }] }]));
		expect(added?.changes).toEqual({ membersAdded: ['e-2'] });
		const removed = changeFromActivity(fact([{ members: [{ id: 'e-1' }, { id: 'e-2' }] }], [{ members: [{ id: 'e-2' }] }]));
		expect(removed?.changes).toEqual({ membersRemoved: ['e-1'] });
	});

	it('ignores a same date written in another form, and a field the update did not state', () => {
		expect(changeFromActivity(fact([{ dueDate: new Date('2026-11-10T00:00:00Z') }], [{ dueDate: '2026-11-10T00:00:00.000Z' }]))).toBeNull();
		expect(changeFromActivity(fact([{ title: 'a' }], [{ title: 'b' }]))).toBeNull();
	});

	it('carries the automation’s depth and chain', () => {
		const change = changeFromActivity(fact([{ status: 'open' }], [{ status: 'done' }]), { depth: 1, chain: ['rule-a'] });
		expect(change).toMatchObject({ depth: 1, chain: ['rule-a'], actorUserId: null });
	});

	it('ignores other entities, deletions and facts without their scope', () => {
		expect(changeFromActivity(fact([{ status: 'open' }], [{ status: 'done' }], { entity: BaseEntityEnum.Document }))).toBeNull();
		expect(changeFromActivity(fact([], [], { action: ActionTypeEnum.Deleted }))).toBeNull();
		expect(changeFromActivity(fact([{ status: 'open' }], [{ status: 'done' }], { organizationId: null }))).toBeNull();
		expect(changeFromActivity(null as never)).toBeNull();
	});

	it('reads a change event back, and refuses what is not one', () => {
		const change = changeFromActivity(fact([{ status: 'open' }], [{ status: 'done' }]), { depth: 1, chain: ['rule-a'] });
		expect(parseChangeEvent(JSON.parse(JSON.stringify(change)))).toEqual(change);
		expect(parseChangeEvent({ taskId: 'x', tenantId: 't', organizationId: 'o', action: 'deleted' })).toBeNull();
		expect(parseChangeEvent({ tenantId: 't', organizationId: 'o', action: 'created' })).toBeNull();
		expect(parseChangeEvent('nope')).toBeNull();
		// Malformed changes are refused, never read as a trigger: a string where ids are due, a field that is not
		// `{ from, to }` of text.
		const base = { taskId: 'x', tenantId: 't', organizationId: 'o', action: 'updated' };
		expect(parseChangeEvent({ ...base, changes: { membersAdded: 'x' } })).toBeNull();
		expect(parseChangeEvent({ ...base, changes: { membersAdded: [1] } })).toBeNull();
		expect(parseChangeEvent({ ...base, changes: { status: 'done' } })).toBeNull();
		expect(parseChangeEvent({ ...base, changes: { status: { from: 'open', to: { id: 1 } } } })).toBeNull();
		expect(parseChangeEvent({ ...base, changes: [] })).toBeNull();
		// Both ends must be stated (null for none).
		expect(parseChangeEvent({ ...base, changes: { status: { from: 'open' } } })).toBeNull();
		expect(parseChangeEvent({ ...base, changes: { status: { from: null, to: 'open' } } })).toMatchObject({ changes: { status: { from: null, to: 'open' } } });
		expect(parseChangeEvent({ ...base, changes: { status: { from: 'open', to: 'done' }, other: 1 } })).toMatchObject({
			changes: { status: { from: 'open', to: 'done' } }
		});
		expect(parseChangeEvent({ taskId: 'x', tenantId: 't', organizationId: 'o', action: 'created', depth: 'x' })).toMatchObject({ depth: 0, chain: [] });
	});
});
