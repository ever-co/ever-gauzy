import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { TaskEvent } from '../event-bus/events';
import { TaskService } from './task.service';

/**
 * `TaskEvent` covered create and update only: a task removed through `DELETE /tasks/:id`, `DELETE
 * /tasks/:id/soft` or the GraphQL twins left every subscriber (GitHub, SIM workflows, the Ever Works
 * integration) believing it still existed. Both delete paths now publish `DELETED`, carrying the task and
 * its scope in `input` — the members the existing subscribers read before they switch on the type.
 */
describe('TaskService — TaskEvent DELETED', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const stored = {
		id: 'task-1',
		title: 'Task 1',
		tenantId: fixture.tenantId,
		organizationId: fixture.organizationId,
		projectId: 'project-1',
		teams: []
	};

	let restore: () => void;
	let publish: jest.Mock;
	let service: TaskService;

	const published = (): TaskEvent[] => publish.mock.calls.map(([event]) => event);

	beforeEach(() => {
		publish = jest.fn();
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_domainEventBus: { publish },
			_managedEmployeeService: { isManagerOfTeamsOrProjects: jest.fn().mockResolvedValue(false) }
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		jest
			.spyOn(TenantAwareCrudService.prototype, 'findOneOrFailByIdString')
			.mockResolvedValue({ success: true, record: stored } as never);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	it('publishes DELETED after a hard delete, with the task and its scope', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ORG_TASK_DELETE] }));
		const remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });

		await expect(service.deleteTask('task-1')).resolves.toEqual({ affected: 1, raw: [] });

		expect(remove).toHaveBeenCalledWith('task-1');
		expect(published()).toHaveLength(1);
		const [event] = published();
		expect(event).toBeInstanceOf(TaskEvent);
		expect(event.type).toBe(BaseEntityEventTypeEnum.DELETED);
		expect(event.entity).toBe(stored);
		expect(event.input).toEqual({
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			projectId: 'project-1'
		});
	});

	it('publishes nothing when the delete removed nothing', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ORG_TASK_DELETE] }));
		jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 0, raw: [] });

		await service.deleteTask('task-1');

		expect(published()).toEqual([]);
	});

	it('publishes nothing when the caller may not delete the task', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ORG_TASK_EDIT] }));
		const remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete');

		await expect(service.deleteTask('task-1')).rejects.toBeInstanceOf(ForbiddenException);

		expect(remove).not.toHaveBeenCalled();
		expect(published()).toEqual([]);
	});

	it('publishes DELETED after a soft delete', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ALL_ORG_EDIT] }));
		const softRemoved = { ...stored, deletedAt: new Date() };
		jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue(softRemoved as never);

		await expect(service.softRemove('task-1')).resolves.toBe(softRemoved);

		const [event] = published();
		expect(event.type).toBe(BaseEntityEventTypeEnum.DELETED);
		expect(event.entity).toBe(softRemoved);
		expect(event.input).toMatchObject({ projectId: 'project-1', organizationId: fixture.organizationId });
	});

	it('never fails the delete when publishing throws', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ORG_TASK_DELETE] }));
		publish.mockImplementation(() => {
			throw new Error('subscriber exploded');
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(service.deleteTask('task-1')).resolves.toEqual({ affected: 1, raw: [] });
		expect(log).toHaveBeenCalled();
	});

	it('works without the domain event bus (a service built by hand)', async () => {
		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.ORG_TASK_DELETE] }));
		Object.assign(service, { _domainEventBus: undefined });
		jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });

		await expect(service.deleteTask('task-1')).resolves.toEqual({ affected: 1, raw: [] });
	});
});
