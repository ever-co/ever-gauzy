import '../../core/entities/internal';

import { PublicTeamService } from './public-team.service';

/**
 * #10712 — the anonymous public team link (`GET /public/team/:profile_link/:id?relations[]=tasks.members`)
 * answered each task assignee as a full employee row: pay rates, income averages, HR dates and tracking
 * settings, even the values the employee chose to hide. Assignees now keep the public profile fields only,
 * and the financial ones still follow the employee's `show_*` flags, as on the public employee endpoint.
 */
describe('PublicTeamService.findOneByProfileLink — task assignees', () => {
	/** A task assignee as `tasks.members` loads it: the whole employee row. */
	const fullEmployeeRow = (flags: boolean) => ({
		id: 'employee-1',
		userId: 'user-1',
		isActive: true,
		isOnline: false,
		organizationId: 'organization-1',
		tenantId: 'tenant-1',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-02T00:00:00.000Z'),
		short_description: 'Backend developer',
		// Financial fields, each behind its `show_*` flag
		startedWorkOn: new Date('2025-01-01T00:00:00.000Z'),
		payPeriod: 'WEEKLY',
		billRateValue: 120,
		billRateCurrency: 'USD',
		averageIncome: 9000,
		averageExpenses: 300,
		averageBonus: 500,
		show_billrate: flags,
		show_payperiod: flags,
		show_start_work_on: flags,
		show_average_income: flags,
		show_average_expenses: flags,
		show_average_bonus: flags,
		// Private fields, never public
		employeeLevel: 'Senior',
		anonymousBonus: true,
		minimumBillingRate: 90,
		reWeeklyLimit: 40,
		totalWorkHours: 1234,
		offerDate: new Date('2024-11-01T00:00:00.000Z'),
		acceptDate: new Date('2024-11-02T00:00:00.000Z'),
		rejectDate: null,
		endWork: null,
		valueDate: new Date('2024-12-01T00:00:00.000Z'),
		isTrackingEnabled: true,
		allowScreenshotCapture: true,
		isTrackingTime: false,
		isJobSearchActive: true,
		linkedInId: 'linkedin-1',
		upworkId: 'upwork-1'
	});

	const FINANCIAL_FIELDS = [
		'startedWorkOn',
		'payPeriod',
		'billRateValue',
		'billRateCurrency',
		'averageIncome',
		'averageExpenses',
		'averageBonus'
	];
	const PRIVATE_FIELDS = [
		'employeeLevel',
		'anonymousBonus',
		'minimumBillingRate',
		'reWeeklyLimit',
		'totalWorkHours',
		'offerDate',
		'acceptDate',
		'rejectDate',
		'endWork',
		'valueDate',
		'isTrackingEnabled',
		'allowScreenshotCapture',
		'isTrackingTime',
		'isJobSearchActive',
		'linkedInId',
		'upworkId'
	];

	/** The service over a team the repository answers as given. */
	const read = async (team: Record<string, unknown>) => {
		const service = new PublicTeamService(
			{ findOneOrFail: jest.fn(async () => team) } as any,
			{} as any,
			{} as any
		);
		return (await service.findOneByProfileLink(
			{ profile_link: 'team-link', id: 'team-1' } as any,
			{ relations: ['tasks', 'tasks.members'] } as any
		)) as any;
	};

	it('strips the private HR and tracking fields of every task assignee', async () => {
		const team = await read({ id: 'team-1', tasks: [{ id: 'task-1', members: [fullEmployeeRow(true)] }] });
		const [assignee] = team.tasks[0].members;

		for (const field of PRIVATE_FIELDS) {
			expect(assignee).not.toHaveProperty(field);
		}
		expect(assignee).toMatchObject({
			id: 'employee-1',
			userId: 'user-1',
			isActive: true,
			isOnline: false,
			short_description: 'Backend developer'
		});
	});

	it('keeps the financial fields the employee chose to show', async () => {
		const team = await read({ id: 'team-1', tasks: [{ id: 'task-1', members: [fullEmployeeRow(true)] }] });
		const [assignee] = team.tasks[0].members;

		for (const field of FINANCIAL_FIELDS) {
			expect(assignee).toHaveProperty(field);
		}
		expect(assignee.billRateValue).toBe(120);
	});

	it('strips the financial fields the employee chose to hide', async () => {
		const team = await read({ id: 'team-1', tasks: [{ id: 'task-1', members: [fullEmployeeRow(false)] }] });
		const [assignee] = team.tasks[0].members;

		for (const field of FINANCIAL_FIELDS) {
			expect(assignee).not.toHaveProperty(field);
		}
	});

	it.each([
		['show_billrate', ['billRateValue', 'billRateCurrency']],
		['show_payperiod', ['payPeriod']],
		['show_start_work_on', ['startedWorkOn']],
		['show_average_income', ['averageIncome']],
		['show_average_expenses', ['averageExpenses']],
		['show_average_bonus', ['averageBonus']]
	])('follows %s on its own: only the fields behind it are kept', async (flag, fields) => {
		const team = await read({
			id: 'team-1',
			tasks: [{ id: 'task-1', members: [{ ...fullEmployeeRow(false), [flag]: true }] }]
		});
		const [assignee] = team.tasks[0].members;

		expect(FINANCIAL_FIELDS.filter((field) => field in assignee)).toEqual(fields);
	});

	it('answers a team without tasks, and a task without members, as they are', async () => {
		await expect(read({ id: 'team-1' })).resolves.toEqual({ id: 'team-1' });

		const team = await read({ id: 'team-1', tasks: [{ id: 'task-1' }, { id: 'task-2', members: [] }] });
		expect(team.tasks).toEqual([{ id: 'task-1' }, { id: 'task-2', members: [] }]);
	});
});
