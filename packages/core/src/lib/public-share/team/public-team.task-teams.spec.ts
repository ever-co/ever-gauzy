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

import { PublicTeamService, publicTaskTeams } from './public-team.service';

/**
 * The anonymous team link (`GET /public/team/:profile_link/:id?relations[]=tasks.teams`, the Ever Teams public team
 * page) answered, on each task, the whole row of every team the task is shared with: the organization's other teams
 * too, the private ones included, with their share link, settings and image. The page files a task under the team
 * of the link by its id, and its schema needs that team's name.
 */

/** A team of a task, as `tasks.teams` loads it: the whole row. */
function teamRow(id: string, name: string, isPublic: boolean) {
	return {
		id,
		name,
		prefix: name.slice(0, 3).toUpperCase(),
		color: '#123456',
		emoji: null,
		logo: null,
		public: isPublic,
		profile_link: `${id}-share-link`,
		shareProfileView: true,
		requirePlanToTrack: false,
		teamSize: '5',
		organizationId: 'organization-1',
		tenantId: 'tenant-1',
		createdByUserId: 'user-1',
		imageId: `${id}-image`,
		image: { id: `${id}-image`, url: `${id}.png`, tenantId: 'tenant-1' }
	};
}

const SHARED = teamRow('team-1', 'Platform', true);
const PRIVATE = teamRow('team-private', 'Mergers and acquisitions', false);
const OTHER_PUBLIC = teamRow('team-2', 'Website', true);

/** What the link shows of its own team on a task. */
const SHARED_ON_TASK = { id: 'team-1', name: 'Platform', prefix: 'PLA', color: '#123456', emoji: null, logo: null };

function read(tasks: Record<string, unknown>[]) {
	const team = { id: 'team-1', name: 'Platform', public: true, organizationId: 'organization-1', tasks };
	const repository = { findOneOrFail: jest.fn(async () => structuredClone(team)), manager: { find: jest.fn() } };
	const service = new PublicTeamService(repository as any, {} as any, {} as any);
	return service.findOneByProfileLink(
		{ profile_link: 'link', id: 'team-1' } as any,
		{ relations: ['tasks', 'tasks.members', 'tasks.teams', 'tasks.tags'] } as any
	) as Promise<any>;
}

describe('the public team link and the teams of its tasks', () => {
	it('shows, on each task, the team of the link only, with the fields its page reads', async () => {
		const team = await read([
			{ id: 'task-1', title: 'Ship the landing page', public: true, teams: [SHARED, PRIVATE, OTHER_PUBLIC] },
			{ id: 'task-2', title: 'Write the docs', public: true, teams: [SHARED] }
		]);

		expect(team.tasks[0].teams).toEqual([SHARED_ON_TASK]);
		expect(team.tasks[1].teams).toEqual([SHARED_ON_TASK]);
		const answer = JSON.stringify(team);
		expect(answer).not.toContain('Mergers and acquisitions');
		expect(answer).not.toContain('team-private');
		expect(answer).not.toContain('Website');
		expect(answer).not.toContain('share-link');
	});

	it('keeps what Ever Teams files a task by: the id of the team of the link, and its name', async () => {
		const team = await read([{ id: 'task-1', public: true, teams: [PRIVATE, SHARED] }]);

		const [taskTeam] = team.tasks[0].teams;
		expect(team.tasks[0].teams.some((candidate: { id: string }) => candidate.id === team.id)).toBe(true);
		expect(typeof taskTeam.name).toBe('string');
	});

	it('answers a task without teams, and one not loaded with them, as they are', async () => {
		const team = await read([
			{ id: 'task-1', public: true },
			{ id: 'task-2', public: true, teams: [] }
		]);

		expect(team.tasks).toEqual([
			{ id: 'task-1', public: true },
			{ id: 'task-2', public: true, teams: [] }
		]);
	});

	it('leaves out every team when it cannot tell which one the link is for', () => {
		expect(publicTaskTeams([SHARED, PRIVATE] as any, undefined)).toEqual([]);
		expect(publicTaskTeams([null, SHARED] as any, 'team-1')).toEqual([SHARED_ON_TASK]);
	});
});
