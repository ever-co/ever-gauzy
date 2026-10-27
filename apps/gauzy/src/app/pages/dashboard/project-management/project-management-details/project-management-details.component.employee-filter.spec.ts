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

/**
 * The filter bar is applied by the server — the list is paged, so hiding loaded rows would miss the
 * matches further down. Search goes in `where.title`; status, priority and due date go out as the
 * API's advanced filters.
 */
describe('ProjectManagementDetailsComponent filter bar', () => {
	// A Wednesday at noon, local time.
	const NOW = new Date(2026, 9, 28, 12, 0, 0);

	const withFilters = (state: object) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(ProjectManagementDetailsComponent.prototype);
		Object.assign(
			component,
			{
				_organization: { id: 'org-1', tenantId: 'tenant-1' },
				_httpClient: {},
				selectedEmployeeId: null,
				selectedProjectId: null,
				filters: {},
				statusFilter: 'all',
				priorityFilter: 'all',
				dueFilter: 'any',
				searchTerm: ''
			},
			state
		);
		return component;
	};
	const params = (state: object) =>
		Object.fromEntries(withFilters(state).advancedFilters(NOW).map(({ field, search }) => [field, search]));

	it('sends no advanced filters by default', () => {
		expect(params({})).toEqual({});
	});

	it('sends every status a tab stands for', () => {
		expect(params({ statusFilter: 'done' })).toEqual({ statuses: ['done', 'completed'] });
		expect(params({ statusFilter: 'review' })).toEqual({ statuses: ['ready-for-review', 'in-review'] });
	});

	it('sends the picked priority', () => {
		expect(params({ priorityFilter: 'urgent' })).toEqual({ priorities: ['urgent'] });
	});

	it('treats overdue as due before today and not closed, unless a status tab is picked', () => {
		const overdue = params({ dueFilter: 'overdue' });
		expect(new Date(overdue.dueDateTo as string)).toEqual(new Date(2026, 9, 27, 23, 59, 59, 999));
		expect(overdue.statuses).not.toEqual(expect.arrayContaining(['done']));
		expect(overdue.statuses).not.toEqual(expect.arrayContaining(['completed']));
		expect(overdue.statuses).not.toEqual(expect.arrayContaining(['cancelled']));
		expect(overdue.statuses).toEqual(expect.arrayContaining(['open', 'in-progress', 'blocked']));

		expect(params({ dueFilter: 'overdue', statusFilter: 'open' }).statuses).toEqual(['open']);
	});

	it('covers the whole of today for "Due today"', () => {
		const today = params({ dueFilter: 'today' });
		expect(new Date(today.dueDateFrom as string)).toEqual(new Date(2026, 9, 28, 0, 0, 0, 0));
		expect(new Date(today.dueDateTo as string)).toEqual(new Date(2026, 9, 28, 23, 59, 59, 999));
	});

	it('runs "Due this week" from today, not from the start of the week', () => {
		const week = params({ dueFilter: 'week' });
		expect(new Date(week.dueDateFrom as string)).toEqual(new Date(2026, 9, 28, 0, 0, 0, 0));
		expect(new Date(week.dueDateTo as string).getTime()).toBeGreaterThan(new Date(2026, 9, 28, 23, 59).getTime());
	});

	it('asks for tasks without a due date', () => {
		expect(params({ dueFilter: 'none' })).toEqual({ withoutDueDate: true });
	});

	it('puts the search term in where.title and the rest on the data source', () => {
		const component = withFilters({ searchTerm: 'invoice', statusFilter: 'open' });
		component._setSmartTableSource();

		expect(component._smartTableSource.conf.where).toMatchObject({ title: 'invoice' });
		expect(component._smartTableSource.filterConf).toEqual([{ field: 'statuses', search: ['open'] }]);
	});

	it('reports whether any filter is active', () => {
		expect(withFilters({}).hasActiveFilters).toBe(false);
		expect(withFilters({ searchTerm: 'x' }).hasActiveFilters).toBe(true);
		expect(withFilters({ dueFilter: 'none' }).hasActiveFilters).toBe(true);
	});
});
