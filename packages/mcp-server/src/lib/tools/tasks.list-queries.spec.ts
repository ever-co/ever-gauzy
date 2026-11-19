/**
 * The task list routes validate `BaseQueryDTO`: `where` is required, and a query of flat filters was refused (400
 * "where should not be empty") for everyone. The task list tools now send their filters inside `where`, with the
 * paging each route reads: a row offset on `/api/tasks`, a page number on `/api/tasks/pagination` and `/api/tasks/me`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerTaskTools } from './tasks';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const PROJECT = '00000000-0000-4000-8000-000000000030';
const EMPLOYEE = '00000000-0000-4000-8000-000000000040';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The task tools, by name, as a server would be handed their schemas and callbacks, whichever way they register. */
function taskTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback }),
		tool: (name: string, _description: string, shape: z.ZodRawShape, _hints: unknown, callback: ToolCallback) =>
			tools.set(name, { inputSchema: z.object(shape), callback })
	};
	registerTaskTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = taskTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('task list tools — the query each route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_tasks reads the first page of the list route with the scope in `where`', async () => {
		await call('get_tasks');

		expect(get).toHaveBeenCalledWith('/api/tasks', { params: { where: SCOPE, take: 10, skip: 0 } });
	});

	it('get_tasks filters inside `where`, an employee on the assignees, and pages by row offset', async () => {
		await call('get_tasks', {
			projectId: PROJECT,
			employeeId: EMPLOYEE,
			status: 'OPEN',
			priority: 'HIGH',
			size: 'SMALL',
			issueType: 'BUG',
			page: 3,
			limit: 5,
			relations: ['members']
		});

		expect(get).toHaveBeenCalledWith('/api/tasks', {
			params: {
				where: {
					...SCOPE,
					projectId: PROJECT,
					status: 'open',
					priority: 'high',
					size: 'small',
					issueType: 'bug',
					members: { id: EMPLOYEE }
				},
				take: 5,
				skip: 10,
				relations: ['members']
			}
		});
	});

	it('get_tasks searches a title through the pagination route, which matches part of it', async () => {
		await call('get_tasks', { search: 'login', projectId: PROJECT, page: 2, limit: 5 });

		expect(get).toHaveBeenCalledWith('/api/tasks/pagination', {
			params: { where: { ...SCOPE, projectId: PROJECT, title: 'login' }, take: 5, skip: 2 }
		});
	});

	it('get_my_tasks reads the caller’s tasks with the scope in `where`, paged by page number', async () => {
		await call('get_my_tasks');

		expect(get).toHaveBeenCalledWith('/api/tasks/me', { params: { where: SCOPE, take: 10, skip: 1 } });
	});

	it('get_my_tasks filters the status in `where` and the priority in the advanced filters the route reads', async () => {
		await call('get_my_tasks', { status: 'IN_PROGRESS', priority: 'LOW', page: 2, limit: 20 });

		expect(get).toHaveBeenCalledWith('/api/tasks/me', {
			params: {
				where: { ...SCOPE, status: 'in-progress' },
				take: 20,
				skip: 2,
				filters: { priorities: ['low'] }
			}
		});
	});

	it('get_tasks_pagination filters inside `where`, an employee on the assignees, paged by page number', async () => {
		await call('get_tasks_pagination', {
			projectId: PROJECT,
			employeeId: EMPLOYEE,
			status: 'BLOCKED',
			page: 4,
			limit: 25,
			relations: ['project']
		});

		expect(get).toHaveBeenCalledWith('/api/tasks/pagination', {
			params: {
				where: { ...SCOPE, projectId: PROJECT, status: 'blocked', members: { id: EMPLOYEE } },
				take: 25,
				skip: 4,
				relations: ['project']
			}
		});
	});

	it('get_tasks_by_employee filters the employee’s tasks inside `where`', async () => {
		await call('get_tasks_by_employee', { employeeId: EMPLOYEE, status: 'COMPLETED', priority: 'HIGH' });

		expect(get).toHaveBeenCalledWith(`/api/tasks/employee/${EMPLOYEE}`, {
			params: { where: { ...SCOPE, status: 'completed', priority: 'high' }, take: 10, skip: 0 }
		});
	});
});

describe('task list tools — the enum values a filter is sent as', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sends each key as the value the API stores', async () => {
		await call('get_tasks', {
			status: 'READY_FOR_REVIEW',
			priority: 'HIGHEST',
			size: 'X_SMALL',
			issueType: 'FEATURE'
		});

		expect(get).toHaveBeenCalledWith('/api/tasks', {
			params: {
				where: { ...SCOPE, status: 'ready-for-review', priority: 'urgent', size: 'tiny', issueType: 'feature' },
				take: 10,
				skip: 0
			}
		});
	});

	it('takes the stored values themselves, those with no key included', async () => {
		await call('get_tasks', { status: 'backlog', priority: 'urgent', size: 'x-large', issueType: 'memo' });

		expect(get).toHaveBeenCalledWith('/api/tasks', {
			params: {
				where: { ...SCOPE, status: 'backlog', priority: 'urgent', size: 'x-large', issueType: 'memo' },
				take: 10,
				skip: 0
			}
		});
	});

	it('refuses a value the API does not store', () => {
		const tool = taskTools().get('get_tasks') as RegisteredTool;

		expect(tool.inputSchema.safeParse({ status: 'archived' }).success).toBe(false);
	});

	it('get_task_count counts the stored status', async () => {
		await call('get_task_count', { status: 'IN_REVIEW' });

		expect(get).toHaveBeenCalledWith('/api/tasks/count', { params: { ...SCOPE, status: 'in-review' } });
	});

	it('get_team_tasks filters the team’s tasks by the stored status', async () => {
		const team = '00000000-0000-4000-8000-000000000020';
		await call('get_team_tasks', { teamId: team, status: 'IN_PROGRESS' });

		expect(get).toHaveBeenCalledWith('/api/tasks/team', {
			params: { where: { ...SCOPE, teams: [team], status: 'in-progress' }, take: 10, skip: 1 }
		});
	});
});
