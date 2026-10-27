import { leaveOutFormerEmployees, withFormerEmployeeLinks } from './former-employees';

/**
 * Employees whose work ended keep their memberships (Back to Work restores them), but no member list shows them:
 * a team's, a sprint's, a project module's, a department's, a client's. The API answers are filtered once,
 * wherever their `members` lists sit, in the shapes both ORMs and both protocols answer.
 */
const WORKING = new Set(['employee-a', 'employee-b']);
const lookup = () => ({
	findWorkingEmployeeIds: jest.fn(async (ids: string[]) => new Set(ids.filter((id) => WORKING.has(id))))
});

const row = (id: string, employeeId: string) => ({ id, employeeId, employee: { id: employeeId } });
const idsOf = (members: Array<{ id: string }>) => members.map(({ id }) => id);

describe('leaveOutFormerEmployees', () => {
	it('filters the membership rows of every team of a page, in one lookup (the Teams page, `/me`)', async () => {
		const page = {
			items: [
				{ id: 'team-1', members: [row('m1', 'employee-a'), row('m2', 'employee-ended')] },
				{ id: 'team-2', members: [row('m3', 'employee-b')] }
			],
			total: 2
		};
		const workingLookup = lookup();

		await leaveOutFormerEmployees(page, workingLookup);

		expect(idsOf(page.items[0].members)).toEqual(['m1']);
		expect(idsOf(page.items[1].members)).toEqual(['m3']);
		expect(workingLookup.findWorkingEmployeeIds).toHaveBeenCalledTimes(1);
		expect(workingLookup.findWorkingEmployeeIds).toHaveBeenCalledWith([
			'employee-a',
			'employee-ended',
			'employee-b'
		]);
	});

	it('filters a single team (`GET /organization-team/:id`, which Ever Teams reads) and its nested lists', async () => {
		const team = {
			id: 'team-1',
			members: [row('m1', 'employee-a'), row('m2', 'employee-ended')],
			projects: [{ id: 'project-1', members: [row('p1', 'employee-ended'), row('p2', 'employee-b')] }]
		};

		await leaveOutFormerEmployees(team, lookup());

		expect(idsOf(team.members)).toEqual(['m1']);
		expect(idsOf(team.projects[0].members)).toEqual(['p2']);
	});

	it('keeps the former employees of historical records: a task’s assignees, a comment’s mentions', async () => {
		// A team read with `relations: ['tasks.members']`: the task's members are who was assigned the work
		const team = {
			id: 'team-1',
			members: [row('m1', 'employee-a'), row('m2', 'employee-ended')],
			tasks: [
				{
					id: 'task-1',
					members: [{ id: 'employee-ended', userId: 'u2', isActive: false, isArchived: true }],
					comments: [{ id: 'comment-1', members: [{ id: 'employee-ended', userId: 'u2' }] }]
				}
			]
		};

		await leaveOutFormerEmployees(team, lookup());

		expect(idsOf(team.members)).toEqual(['m1']);
		expect(idsOf(team.tasks[0].members)).toEqual(['employee-ended']);
		expect(idsOf(team.tasks[0].comments[0].members)).toEqual(['employee-ended']);
	});

	it('filters a GraphQL connection once, whose nodes and edges share the rows', async () => {
		const node = { id: 'sprint-1', members: [row('m1', 'employee-a'), row('m2', 'employee-ended')] };
		const connection = { nodes: [node], edges: [{ cursor: 'c', node }], totalCount: 1 };

		await leaveOutFormerEmployees(connection, lookup());

		expect(idsOf(connection.nodes[0].members)).toEqual(['m1']);
		expect(connection.edges[0].node).toBe(connection.nodes[0]);
	});

	it('names the employee of a MikroORM membership through its relation, loaded or as a key', async () => {
		const projectModule = {
			members: [
				{ id: 'm1', employee: { id: 'employee-a' } },
				{ id: 'm2', employee: 'employee-ended' },
				{ id: 'm3', employee: 'employee-b' }
			]
		};

		await leaveOutFormerEmployees(projectModule, lookup());

		expect(idsOf(projectModule.members)).toEqual(['m1', 'm3']);
	});

	it('reads an employee row of a many-to-many list (a department, a client) by its own status', async () => {
		const department = {
			members: [
				{ id: 'employee-a', userId: 'u1', isActive: true, isArchived: false },
				{ id: 'employee-ended', userId: 'u2', isActive: false, isArchived: true },
				{ id: 'employee-deactivated', userId: 'u3', isActive: false, isArchived: false }
			]
		};
		const workingLookup = lookup();

		await leaveOutFormerEmployees(department, workingLookup);

		expect(idsOf(department.members)).toEqual(['employee-a']);
		// Their status was read: nothing was looked up
		expect(workingLookup.findWorkingEmployeeIds).not.toHaveBeenCalled();
	});

	it('looks up an employee row that does not state its status', async () => {
		const contact = {
			members: [
				{ id: 'employee-a', userId: 'u1' },
				{ id: 'employee-ended', userId: 'u2' }
			]
		};

		await leaveOutFormerEmployees(contact, lookup());

		expect(idsOf(contact.members)).toEqual(['employee-a']);
	});

	it('keeps a member it cannot name or look up: only an employee known not to work is left out', async () => {
		const team = { members: [{ id: 'unnamed' }, row('m2', 'employee-ended')] };
		const department = { members: [{ id: 'employee-x', userId: 'u1' }] };

		await leaveOutFormerEmployees(team, undefined);
		await leaveOutFormerEmployees(department, undefined);

		expect(idsOf(team.members)).toEqual(['unnamed', 'm2']);
		expect(idsOf(department.members)).toEqual(['employee-x']);
	});

	it('leaves a response without member lists, and other lists, as they are', async () => {
		const workingLookup = lookup();
		const answer = { items: [{ id: 'team-1', tags: [{ id: 't' }] }], total: 1 };

		await leaveOutFormerEmployees(answer, workingLookup);
		await leaveOutFormerEmployees(undefined, workingLookup);
		await leaveOutFormerEmployees(true, workingLookup);

		expect(answer).toEqual({ items: [{ id: 'team-1', tags: [{ id: 't' }] }], total: 1 });
		expect(workingLookup.findWorkingEmployeeIds).not.toHaveBeenCalled();
	});
});

describe('withFormerEmployeeLinks', () => {
	const linked: Array<{ id: string; isActive?: boolean; isArchived?: boolean }> = [
		{ id: 'employee-a', isActive: true, isArchived: false },
		{ id: 'employee-ended', isActive: false, isArchived: true }
	];

	it('keeps a linked former employee the edit could not see, and drops a working one it took off', () => {
		expect(withFormerEmployeeLinks([{ id: 'employee-new' }], linked)).toEqual([
			{ id: 'employee-new' },
			{ id: 'employee-ended', isActive: false, isArchived: true }
		]);
	});

	it('states a former employee once when the edit sends them back, and changes nothing without links', () => {
		expect(withFormerEmployeeLinks([{ id: 'employee-ended' }], linked)).toEqual([{ id: 'employee-ended' }]);
		expect(withFormerEmployeeLinks([], undefined)).toEqual([]);
	});
});
