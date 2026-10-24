jest.mock('./../../core/entities/internal', () => ({
	OrganizationTeam: class OrganizationTeam {},
	Task: class Task {}
}));
jest.mock('./../../time-tracking/statistic', () => ({ StatisticService: class StatisticService {} }));
jest.mock('./../../time-tracking/timer/timer.service', () => ({ TimerService: class TimerService {} }));
jest.mock('../../organization-team/repository/type-orm-organization-team.repository', () => ({
	TypeOrmOrganizationTeamRepository: class TypeOrmOrganizationTeamRepository {}
}));
jest.mock('../employee/public-employee.service', () => ({ applyEmployeeVisibility: (employee: unknown) => employee }));
jest.mock('../../core/utils', () => ({ parseFindOptionsRelations: (relations: unknown) => relations }));

import { isPubliclyVisibleTask, PublicTeamService } from './public-team.service';

/**
 * The anonymous team link (`GET /public/team/:profile_link/:id?relations[]=tasks`, the Ever Teams public team page)
 * answered every task of the team in full: the tasks marked private ("This task is Private") and the drafts too, and
 * their titles again through each member's last worked task and task statistics.
 */
const OPEN = { id: 'task-open', title: 'Ship the landing page', public: true, isDraft: false };
const PRIVATE = { id: 'task-private', title: 'Acquisition of Contoso', public: false, isDraft: false };
const DRAFT = { id: 'task-draft', title: 'Layoff plan', public: true, isDraft: true };
const LEGACY = { id: 'task-legacy', title: 'Write the docs', public: null, isDraft: null };

function setUp() {
	const team = {
		id: 'team-1',
		organizationId: 'organization-1',
		tenantId: 'tenant-1',
		public: true,
		tasks: [OPEN, PRIVATE, DRAFT, LEGACY],
		members: [{ id: 'member-1', employeeId: 'employee-1' }]
	};
	const find = jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown>[] }) =>
		[PRIVATE, DRAFT].filter((task) =>
			where.some((condition) =>
				Object.entries(condition).every(([key, value]) =>
					key === 'id' || key === 'tenantId' ? true : (task as Record<string, unknown>)[key] === value
				)
			)
		)
	);
	const repository = { findOneOrFail: jest.fn(async () => structuredClone(team)), manager: { find } };
	const statistics = [OPEN, PRIVATE, DRAFT].map(({ id, title }) => ({ id, title, duration: 60 }));
	const statisticService = { getTasks: jest.fn(async () => statistics) };
	const timerService = {
		getTimerWorkedStatus: jest.fn(async () => [
			{ lastLog: { employeeId: 'employee-1', task: PRIVATE }, timerStatus: 'running' }
		])
	};
	const service = new PublicTeamService(repository as any, statisticService as any, timerService as any);
	return { service, find };
}

describe('the public team link and private tasks', () => {
	it('shows only the tasks that are neither private nor drafts', async () => {
		const { service } = setUp();

		const team = await service.findOneByProfileLink(
			{ profile_link: 'link', id: 'team-1' } as any,
			{
				relations: ['tasks']
			} as any
		);

		expect(team.tasks.map((task) => task.id)).toEqual(['task-open', 'task-legacy']);
	});

	it('hides a private last worked task and the private and draft tasks of the statistics', async () => {
		const { service, find } = setUp();

		const team = await service.findOneByProfileLink(
			{ profile_link: 'link', id: 'team-1' } as any,
			{
				withLastWorkedTask: 'true'
			} as any
		);

		const [member] = team.members as any[];
		expect(member.lastWorkedTask).toBeNull();
		expect(member.timerStatus).toBe('running');
		expect(member.totalWorkedTasks.map((task: { id: string }) => task.id)).toEqual(['task-open']);
		expect(member.totalTodayTasks.map((task: { id: string }) => task.id)).toEqual(['task-open']);
		expect(JSON.stringify(team)).not.toContain('Contoso');
		expect(JSON.stringify(team)).not.toContain('Layoff');
		// One lookup for every member's statistics, in the team's tenant
		expect(find).toHaveBeenCalledTimes(1);
		expect(find.mock.calls[0][1].where).toEqual([
			expect.objectContaining({ tenantId: 'tenant-1', public: false }),
			expect.objectContaining({ tenantId: 'tenant-1', isDraft: true })
		]);
	});

	it('treats a task without the flags as public', () => {
		expect(isPubliclyVisibleTask(LEGACY as any)).toBe(true);
		expect(isPubliclyVisibleTask(OPEN)).toBe(true);
		expect(isPubliclyVisibleTask(PRIVATE)).toBe(false);
		expect(isPubliclyVisibleTask(DRAFT)).toBe(false);
		expect(isPubliclyVisibleTask(null)).toBe(false);
	});
});
