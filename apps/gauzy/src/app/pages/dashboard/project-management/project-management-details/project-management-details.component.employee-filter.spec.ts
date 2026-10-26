import { ProjectManagementDetailsComponent } from './project-management-details.component';

/**
 * With an employee selected, the table switches to `GET /tasks/employee`, whose service reads the
 * selected employee from `where.members.id` (not `where.employeeId`, which it ignores for users who
 * can change the selected employee, so they used to see every employee's tasks).
 *
 * Only the data-source setup is exercised, on a bare instance: no template or DI is needed.
 */
describe('ProjectManagementDetailsComponent task source', () => {
	const buildSource = (selectedEmployeeId: string | null) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(ProjectManagementDetailsComponent.prototype);
		Object.assign(component, {
			_organization: { id: 'org-1', tenantId: 'tenant-1' },
			_httpClient: {},
			selectedEmployeeId,
			selectedProjectId: null,
			filters: {}
		});
		component._setSmartTableSource();
		return component._smartTableSource.conf;
	};

	it('sends the selected employee as where.members.id to /tasks/employee', () => {
		const conf = buildSource('employee-1');

		expect(conf.endPoint).toMatch(/\/tasks\/employee$/);
		expect(conf.where).toEqual({ organizationId: 'org-1', tenantId: 'tenant-1', members: { id: 'employee-1' } });
		expect(conf.where).not.toHaveProperty('employeeId');
	});

	it('uses the paginated endpoint without an employee filter when none is selected', () => {
		const conf = buildSource(null);

		expect(conf.endPoint).toMatch(/\/tasks\/pagination$/);
		expect(conf.where).not.toHaveProperty('members');
	});
});
