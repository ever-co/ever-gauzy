import '../core/entities/internal';

import { of, throwError } from 'rxjs';
import { Employee, Organization, OrganizationProject, OrganizationTeam, User } from '../core/entities/internal';
import { SEED_SAMPLE_ISSUES } from './task-seed-issues';
import { createRandomTask, GITHUB_API_URL, loadSeedIssues } from './task.seed';

// The GitHub issues request, answered per test
const get = jest.fn();
jest.mock('@nestjs/axios', () => ({
	...jest.requireActual('@nestjs/axios'),
	HttpService: jest.fn().mockImplementation(() => ({ get }))
}));

/**
 * The random seed turns the open issues of ever-co/ever-gauzy into tasks. The GitHub request is unauthenticated
 * (60 an hour per IP); on its 403 the seed threw: no tags, no tasks, and with no project holding a task the time
 * logs, activities and job proposals seeded after it failed as well. It now seeds the local sample issues.
 */
describe('createRandomTask when GitHub refuses the issues request', () => {
	const tenant = { id: 'tenant-1' };
	const organization = { id: 'org-1', tenantId: 'tenant-1' };
	const project = { id: 'project-1', name: 'Gauzy Web' };

	const fakeDataSource = () => {
		const saved: any[] = [];
		const query = {
			alias: 'task',
			select: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getRawOne: jest.fn().mockResolvedValue({ maxTaskNumber: 0 })
		};
		const dataSource = {
			manager: {
				find: jest.fn(async (entity: unknown) =>
					entity === User
						? [{ id: 'user-1' }]
						: entity === Organization
							? [organization]
							: entity === OrganizationTeam
								? []
								: []
				),
				findBy: jest.fn(async (entity: unknown) =>
					entity === OrganizationProject ? [project] : entity === Employee ? [{ id: 'employee-1' }] : []
				),
				save: jest.fn(async (task: unknown) => {
					saved.push(task);
					return task;
				})
			},
			getRepository: jest.fn(() => ({ save: jest.fn(async (tags: unknown) => tags) })),
			createQueryBuilder: jest.fn(() => query)
		};
		return { dataSource, saved };
	};

	beforeEach(() => {
		get.mockReset();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('seeds the sample issues as tasks, with their labels as tags, instead of failing', async () => {
		get.mockReturnValue(
			throwError(() =>
				Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } })
			)
		);
		const { dataSource, saved } = fakeDataSource();

		await createRandomTask(dataSource as never, [tenant] as never);

		// Asked once, with a deadline so an unreachable GitHub cannot hold the seed
		expect(get).toHaveBeenCalledWith(
			`${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`,
			expect.objectContaining({ timeout: expect.any(Number) })
		);
		expect(saved.map((task) => task.title)).toEqual(SEED_SAMPLE_ISSUES.map((issue) => issue.title));
		expect(saved.every((task) => task.project === project && task.tags.length > 0)).toBe(true);
	});
});

describe('loadSeedIssues', () => {
	const answering = (data: unknown) => ({ get: jest.fn(() => of({ data })) });

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('hands back the issues GitHub answers, unchanged', async () => {
		const issues = [
			{
				title: 'From GitHub',
				body: '',
				state: 'open',
				labels: [{ name: 'bug', description: '', color: 'd73a4a' }]
			}
		];

		expect(await loadSeedIssues(answering(issues) as never)).toBe(issues);
	});

	it('falls back to the sample issues when GitHub answers none', async () => {
		expect(await loadSeedIssues(answering([]) as never)).toBe(SEED_SAMPLE_ISSUES);
	});
});
