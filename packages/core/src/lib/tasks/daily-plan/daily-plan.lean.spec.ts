import { leanDailyPlans } from './daily-plan.lean';

/**
 * `shape=lean` on a daily plan list: plans and tasks as they are, the plan's employee and each task member trimmed
 * to their ids, name and the user fields that draw an avatar or a link.
 */
describe('leanDailyPlans', () => {
	const image = { id: 'img-1', url: 'https://cdn/x.png', thumbUrl: 'https://cdn/x-thumb.png', fullUrl: 'https://cdn/x.png', storageProvider: 'LOCAL' };
	const user = (id: string) => ({
		id,
		firstName: 'Ada',
		lastName: 'Lovelace',
		name: 'Ada Lovelace',
		username: 'ada',
		email: 'ada@example.com',
		imageUrl: 'https://cdn/x.png',
		image,
		hash: 'secret',
		role: { id: 'role-1', name: 'EMPLOYEE' },
		preferredLanguage: 'en'
	});
	const employee = (id: string, userId: string) => ({
		id,
		userId,
		fullName: 'Ada Lovelace',
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		billRateValue: 120,
		payPeriod: 'MONTHLY',
		isActive: true,
		user: user(userId)
	});
	const task = {
		id: 'task-1',
		title: 'Ship it',
		number: 12,
		prefix: 'GZ',
		taskNumber: 'GZ-12',
		status: 'in-progress',
		priority: null,
		size: null,
		issueType: null,
		estimate: 3600,
		public: true,
		projectId: 'project-1',
		members: [employee('employee-1', 'user-1'), employee('employee-2', 'user-2')]
	};
	const plan = {
		id: 'plan-1',
		date: '2026-11-07',
		workTimePlanned: 8,
		status: 'open',
		employeeId: 'employee-1',
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		employee: employee('employee-1', 'user-1'),
		tasks: [task]
	};

	it('trims the employee and the task members, keeps the plan and task columns', () => {
		const [lean]: any[] = leanDailyPlans([plan]);
		expect(lean).toMatchObject({ id: 'plan-1', date: '2026-11-07', workTimePlanned: 8, status: 'open', employeeId: 'employee-1' });
		expect(lean.employee).toEqual({
			id: 'employee-1',
			userId: 'user-1',
			fullName: 'Ada Lovelace',
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			user: { id: 'user-1', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', username: 'ada', imageUrl: 'https://cdn/x.png' }
		});
		const { members, ...columns } = task;
		expect(lean.tasks[0]).toMatchObject(columns);
		expect(lean.tasks[0].members).toEqual([
			{
				id: 'employee-1',
				userId: 'user-1',
				fullName: 'Ada Lovelace',
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				user: {
					id: 'user-1',
					name: 'Ada Lovelace',
					firstName: 'Ada',
					lastName: 'Lovelace',
					imageUrl: 'https://cdn/x.png',
					image: { id: 'img-1', thumbUrl: 'https://cdn/x-thumb.png', fullUrl: 'https://cdn/x.png' }
				}
			},
			expect.objectContaining({ id: 'employee-2', userId: 'user-2', user: expect.objectContaining({ id: 'user-2' }) })
		]);
		expect(members).toHaveLength(2);
		// the input is not mutated
		expect(plan.tasks[0].members[0].user.email).toBe('ada@example.com');
	});

	it('leaves plans without the relations, null users and images, and non-object members as they are', () => {
		const bare = { id: 'plan-2', date: '2026-11-08', workTimePlanned: 0, status: 'open' };
		const nullish = { ...plan, id: 'plan-3', employee: null, tasks: [{ ...task, members: [{ id: 'employee-9', userId: 'user-9', user: null }, 'oops'] }] };
		const [leanBare, leanNullish]: any[] = leanDailyPlans([bare, nullish]);
		expect(leanBare).toEqual(bare);
		expect(leanNullish.employee).toBeNull();
		expect(leanNullish.tasks[0].members).toEqual([{ id: 'employee-9', userId: 'user-9', user: null }, 'oops']);
	});
});
