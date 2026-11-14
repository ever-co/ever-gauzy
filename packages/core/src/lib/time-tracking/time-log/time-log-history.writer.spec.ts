// Must stay first: loads the entity graph before the writer pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum } from '@gauzy/contracts';
import { isBetterSqlite3 } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { Employee, OrganizationProject, Task } from '../../core/entities/internal';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { updatedChange } from './time-log-history';
import { recordTimeLogHistory } from './time-log-history.writer';

// The database the writer runs on; better-sqlite3 is switched on per test.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isBetterSqlite3: jest.fn(() => false),
	isSqlite: jest.fn(() => false)
}));

const SUBJECT = {
	id: 'log-1',
	employeeId: 'employee-paul',
	organizationId: 'organization-1',
	tenantId: 'tenant-1',
	taskId: 'task-login',
	projectId: 'project-a'
};

/** A manager that answers the name reads from fixed rows and keeps what is saved. */
function fakeManager() {
	const saved: Partial<ActivityLog>[] = [];
	const rowsOf = new Map<unknown, object[]>([
		[
			Task,
			[
				{ id: 'task-login', title: 'Fix login' },
				{ id: 'task-signup', title: 'Fix signup' }
			]
		],
		[OrganizationProject, [{ id: 'project-a', name: 'Website' }]],
		[Employee, [{ id: 'employee-paul', user: { firstName: 'Paul', lastName: 'Martin' } }]]
	]);
	const manager = {
		find: jest.fn<Promise<object[]>, [unknown, unknown?]>(async (entity) => rowsOf.get(entity) ?? []),
		create: jest.fn<Partial<ActivityLog>, [unknown, Partial<ActivityLog>]>((...args) => ({ ...args[1] })),
		save: jest.fn<Promise<Partial<ActivityLog>[]>, [unknown, Partial<ActivityLog>[]]>(async (...args) => {
			saved.push(...args[1]);
			return args[1];
		})
	};
	return { manager, saved };
}

describe('recordTimeLogHistory', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-manager');
	});
	afterEach(() => {
		jest.mocked(isBetterSqlite3).mockReturnValue(false);
		jest.restoreAllMocks();
	});

	it('writes one TimeLog row per change, with the owner and the reason in data and the editor as author', async () => {
		const { manager, saved } = fakeManager();
		const change = updatedChange(
			{ startedAt: '2026-11-10T09:00:00Z', stoppedAt: '2026-11-10T11:00:00Z', taskId: 'task-login' },
			{ startedAt: '2026-11-10T09:00:00Z', stoppedAt: '2026-11-10T14:00:00Z', taskId: 'task-signup' }
		);

		await recordTimeLogHistory(manager as never, [{ subject: SUBJECT, change, reason: 'Forgot to stop' }]);

		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({
			entity: BaseEntityEnum.TimeLog,
			entityId: 'log-1',
			action: ActionTypeEnum.Updated,
			actorType: ActorTypeEnum.User,
			updatedFields: ['stoppedAt', 'taskId', 'duration'],
			data: { employeeId: 'employee-paul', reason: 'Forgot to stop' },
			employeeId: 'employee-manager',
			organizationId: 'organization-1',
			tenantId: 'tenant-1',
			description: 'Updated TimeLog "Fix login"'
		});
		expect(saved[0].previousEntities).toEqual([{ taskId: { id: 'task-login', name: 'Fix login' } }]);
		expect(saved[0].updatedEntities).toEqual([{ taskId: { id: 'task-signup', name: 'Fix signup' } }]);
	});

	it('reads the names of deleted records too, and only in the entries tenant', async () => {
		const { manager } = fakeManager();
		const change = updatedChange({ taskId: 'task-login' }, { taskId: 'task-signup' });

		await recordTimeLogHistory(manager as never, [{ subject: SUBJECT, change }]);

		const taskRead = manager.find.mock.calls.find(([entity]) => entity === Task)[1];
		expect(taskRead).toMatchObject({ withDeleted: true, where: { tenantId: 'tenant-1' } });
	});

	it('keeps the request tenant on a row whose entry arrives without one', async () => {
		const { manager, saved } = fakeManager();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		const change = updatedChange({ taskId: 'task-login' }, { taskId: 'task-signup' });

		await recordTimeLogHistory(manager as never, [{ subject: { ...SUBJECT, tenantId: undefined }, change }]);

		expect(saved[0].tenantId).toBe('tenant-1');
	});

	it('stores the JSON fields as text on SQLite, the changed fields included', async () => {
		jest.mocked(isBetterSqlite3).mockReturnValue(true);
		const { manager, saved } = fakeManager();
		const change = updatedChange({ taskId: 'task-login' }, { taskId: 'task-signup' });

		await recordTimeLogHistory(manager as never, [{ subject: SUBJECT, change }]);

		expect(saved[0].updatedFields).toBe('["taskId"]');
		expect(saved[0].previousValues).toBe('[{"taskId":"task-login"}]');
	});

	it('writes nothing, and reads nothing, for no change', async () => {
		const { manager } = fakeManager();

		await recordTimeLogHistory(manager as never, []);

		expect(manager.find).not.toHaveBeenCalled();
		expect(manager.save).not.toHaveBeenCalled();
	});
});
