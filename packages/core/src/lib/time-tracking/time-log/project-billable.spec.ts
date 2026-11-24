// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { EntityManager } from 'typeorm';
import { OrganizationProject, Task } from '../../core/entities/internal';
import { billableOfProject } from './project-billable';

/**
 * A client can ask that time be billable as its project is set (`billableFromProject`), as the Ever Teams web app
 * decides (ever-co/ever-teams#5571). The project is the one the time names, else its task's, read in the employee's
 * organization; a project without a setting is not billable; time without a project is left to the request.
 */

const EMPLOYEE = { employeeId: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' };

interface IStore {
	projects?: Record<string, unknown>[];
	tasks?: Record<string, unknown>[];
}

/** A manager over stored projects and tasks that answers a lookup by id, tenant and organization. */
function managerOver({ projects = [], tasks = [] }: IStore) {
	const findOne = jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
		const rows = entity === OrganizationProject ? projects : tasks;
		const found = rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value));
		return found ?? null;
	});
	return { manager: { findOne } as unknown as EntityManager, findOne };
}

const inOrganization = { tenantId: EMPLOYEE.tenantId, organizationId: EMPLOYEE.organizationId };

describe('billableOfProject', () => {
	it.each([
		[true, true],
		[false, false],
		[null, false]
	])('reads a named project set to %s as billable %s', async (billable, expected) => {
		const { manager, findOne } = managerOver({ projects: [{ id: 'project-1', billable, ...inOrganization }] });

		expect(await billableOfProject(manager, EMPLOYEE, { projectId: 'project-1' })).toBe(expected);
		expect(findOne).toHaveBeenCalledWith(OrganizationProject, {
			where: { id: 'project-1', ...inOrganization },
			select: { id: true, billable: true }
		});
	});

	it("takes the task's project when the time names no project", async () => {
		const { manager } = managerOver({
			projects: [{ id: 'project-of-task', billable: true, ...inOrganization }],
			tasks: [{ id: 'task-1', projectId: 'project-of-task', ...inOrganization }]
		});

		expect(await billableOfProject(manager, EMPLOYEE, { taskId: 'task-1' })).toBe(true);
	});

	it('leaves time without a project to the request, without reading a project', async () => {
		const { manager, findOne } = managerOver({ tasks: [{ id: 'task-1', projectId: null, ...inOrganization }] });

		expect(await billableOfProject(manager, EMPLOYEE, { taskId: 'task-1' })).toBeUndefined();
		expect(await billableOfProject(manager, EMPLOYEE, {})).toBeUndefined();
		expect(findOne).not.toHaveBeenCalledWith(OrganizationProject, expect.anything());
	});

	it("never reads a project of another organization: the request's own choice applies", async () => {
		const { manager } = managerOver({
			projects: [{ id: 'project-1', billable: true, tenantId: 'tenant-1', organizationId: 'organization-2' }]
		});

		expect(await billableOfProject(manager, EMPLOYEE, { projectId: 'project-1' })).toBeUndefined();
	});

	it('CONTROL: reads the task only in the employee organization too', async () => {
		const { manager, findOne } = managerOver({});

		await billableOfProject(manager, EMPLOYEE, { taskId: 'task-1' });

		expect(findOne).toHaveBeenCalledWith(Task, {
			where: { id: 'task-1', ...inOrganization },
			select: { id: true, projectId: true }
		});
	});
});
