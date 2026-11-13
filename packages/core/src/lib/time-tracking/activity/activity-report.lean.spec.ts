import { leanActivityReport } from './activity-report.lean';

/**
 * `shape=lean` on the daily activities report: numbers and grouping untouched, employees and projects trimmed on the
 * group heads to what a client shows, the copies on the rows under a group gone, rows outside a group trimmed.
 */
describe('leanActivityReport', () => {
	const image = { id: 'img-1', url: 'https://cdn/x.png', thumb: 'https://cdn/x-thumb.png', fullUrl: 'https://cdn/x.png', thumbUrl: 'https://cdn/x-thumb.png' };
	const user = {
		id: 'user-1',
		firstName: 'Ada',
		lastName: 'Lovelace',
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		imageUrl: 'https://cdn/x.png',
		image,
		hash: 'secret',
		preferredLanguage: 'en'
	};
	const employee = {
		id: 'employee-1',
		userId: 'user-1',
		kind: 'HUMAN',
		isOnline: true,
		isAway: false,
		fullName: 'Ada Lovelace',
		billRateValue: 120,
		payPeriod: 'MONTHLY',
		user
	};
	const project = { id: 'project-1', name: 'Gauzy', imageUrl: 'https://cdn/p.png', color: '#123456', membersCount: 7, description: 'long text', budget: 10000, image };
	const row = (title: string, duration: number) => ({
		employeeId: 'employee-1',
		projectId: 'project-1',
		date: '2026-11-07',
		title,
		duration,
		sessions: 3,
		duration_percentage: '50.00',
		employee,
		project
	});

	it('trims the group heads and strips the rows under them, keeping every number (grouped by date)', () => {
		const report = [
			{ date: '2026-11-07', employees: [{ employee, projects: [{ project, activity: [row('Chrome', 300), row('Code', 300)] }] }] }
		];
		const lean: any = leanActivityReport(report);
		expect(lean).toEqual([
			{
				date: '2026-11-07',
				employees: [
					{
						employee: {
							id: 'employee-1',
							userId: 'user-1',
							kind: 'HUMAN',
							isOnline: true,
							isAway: false,
							fullName: 'Ada Lovelace',
							user: { id: 'user-1', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', imageUrl: 'https://cdn/x.png' }
						},
						projects: [
							{
								project: { id: 'project-1', name: 'Gauzy', imageUrl: 'https://cdn/p.png', color: '#123456', membersCount: 7 },
								activity: [
									{ employeeId: 'employee-1', projectId: 'project-1', date: '2026-11-07', title: 'Chrome', duration: 300, sessions: 3, duration_percentage: '50.00' },
									{ employeeId: 'employee-1', projectId: 'project-1', date: '2026-11-07', title: 'Code', duration: 300, sessions: 3, duration_percentage: '50.00' }
								]
							}
						]
					}
				]
			}
		]);
		// the input is not mutated
		expect(report[0].employees[0].projects[0].activity[0].employee).toBe(employee);
	});

	it('handles the employee and project groupings the same way', () => {
		const byEmployee: any = leanActivityReport([{ employee, dates: [{ date: '2026-11-07', projects: [{ project, activity: [row('Chrome', 60)] }] }] }]);
		expect(byEmployee[0].employee.user).toEqual({ id: 'user-1', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', imageUrl: 'https://cdn/x.png' });
		expect(byEmployee[0].dates[0].projects[0].project).toEqual({ id: 'project-1', name: 'Gauzy', imageUrl: 'https://cdn/p.png', color: '#123456', membersCount: 7 });
		expect(byEmployee[0].dates[0].projects[0].activity[0]).not.toHaveProperty('employee');
		expect(byEmployee[0].dates[0].projects[0].activity[0]).toMatchObject({ title: 'Chrome', duration: 60, duration_percentage: '50.00' });

		const byProject: any = leanActivityReport([{ project, dates: [{ date: '2026-11-07', employees: [{ employee, activity: [row('Chrome', 60)] }] }] }]);
		expect(byProject[0].project).toEqual({ id: 'project-1', name: 'Gauzy', imageUrl: 'https://cdn/p.png', color: '#123456', membersCount: 7 });
		expect(byProject[0].dates[0].employees[0].employee.id).toBe('employee-1');
		expect(byProject[0].dates[0].employees[0].activity[0]).not.toHaveProperty('project');
	});

	it('keeps trimmed copies on rows that are not under a group, and null heads as null', () => {
		const ungrouped: any = leanActivityReport([row('Chrome', 60), { ...row('Code', 30), employee: null, project: undefined }]);
		expect(ungrouped[0].employee).toEqual({
			id: 'employee-1',
			userId: 'user-1',
			kind: 'HUMAN',
			isOnline: true,
			isAway: false,
			fullName: 'Ada Lovelace',
			user: { id: 'user-1', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', imageUrl: 'https://cdn/x.png' }
		});
		expect(ungrouped[0].project).toEqual({ id: 'project-1', name: 'Gauzy', imageUrl: 'https://cdn/p.png', color: '#123456', membersCount: 7 });
		expect(ungrouped[1].employee).toBeNull();
		expect(ungrouped[1].project).toBeUndefined();
		expect(ungrouped[1].duration).toBe(30);
	});
});
