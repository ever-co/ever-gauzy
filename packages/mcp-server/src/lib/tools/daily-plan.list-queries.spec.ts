/**
 * The daily plan list routes validate `BaseQueryDTO` (`where` is required) or read the organization from `where`: a
 * query of flat filters was refused (400 "where should not be empty") or answered no plan. The daily plan list tools
 * now send their filters inside `where`, with `skip` read as a page number, as those routes read it. `get_daily_plans`
 * with no team and no employee reads the person's own plans: the list route refuses an employee who names no team.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerDailyPlanTools } from './daily-plan';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const TEAM = '00000000-0000-4000-8000-000000000020';
const EMPLOYEE = '00000000-0000-4000-8000-000000000040';
const TASK = '00000000-0000-4000-8000-000000000050';
const DATE = '2026-11-19';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The daily plan tools, by name, as a server would be handed their schemas and callbacks. */
function dailyPlanTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerDailyPlanTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = dailyPlanTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('daily plan list tools — the route and query each one reads', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it("get_daily_plans with no team and no employee reads the person's own plans", async () => {
		await call('get_daily_plans', { date: DATE, status: 'OPEN' });

		expect(get).toHaveBeenCalledWith('/api/daily-plan/me', {
			params: { where: { ...SCOPE, date: DATE, status: 'open' }, take: 10, skip: 1 }
		});
	});

	it('get_daily_plans with a team reads the list route with the team in `where`', async () => {
		await call('get_daily_plans', { organizationTeamId: TEAM, page: 2, limit: 5, relations: ['tasks'] });

		expect(get).toHaveBeenCalledWith('/api/daily-plan', {
			params: { where: { ...SCOPE, organizationTeamId: TEAM }, take: 5, skip: 2, relations: ['tasks'] }
		});
	});

	it('get_daily_plans with an employee reads the list route with the employee in `where`', async () => {
		await call('get_daily_plans', { employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/daily-plan', {
			params: { where: { ...SCOPE, employeeId: EMPLOYEE }, take: 10, skip: 1 }
		});
	});

	it('get_my_daily_plans filters inside `where`', async () => {
		await call('get_my_daily_plans', { organizationTeamId: TEAM, status: 'COMPLETED', page: 3, limit: 4 });

		expect(get).toHaveBeenCalledWith('/api/daily-plan/me', {
			params: { where: { ...SCOPE, organizationTeamId: TEAM, status: 'completed' }, take: 4, skip: 3 }
		});
	});

	it('get_team_daily_plans names the team inside `where`', async () => {
		await call('get_team_daily_plans', { organizationTeamId: TEAM, date: DATE });

		expect(get).toHaveBeenCalledWith('/api/daily-plan/team', {
			params: { where: { ...SCOPE, organizationTeamId: TEAM, date: DATE }, take: 10, skip: 1 }
		});
	});

	it('get_employee_daily_plans sends the organization inside `where`', async () => {
		await call('get_employee_daily_plans', { employeeId: EMPLOYEE, status: 'IN_PROGRESS' });

		expect(get).toHaveBeenCalledWith(`/api/daily-plan/employee/${EMPLOYEE}`, {
			params: { where: { ...SCOPE, status: 'in-progress' }, take: 10, skip: 1 }
		});
	});

	it('get_daily_plans_for_task sends the organization inside `where`', async () => {
		await call('get_daily_plans_for_task', { taskId: TASK, relations: ['employee'] });

		expect(get).toHaveBeenCalledWith(`/api/daily-plan/task/${TASK}`, {
			params: { where: SCOPE, take: 10, skip: 1, relations: ['employee'] }
		});
	});

	it('takes a stored status as it is', async () => {
		await call('get_my_daily_plans', { status: 'in-progress' });

		expect(get).toHaveBeenCalledWith('/api/daily-plan/me', {
			params: { where: { ...SCOPE, status: 'in-progress' }, take: 10, skip: 1 }
		});
	});

	it('get_daily_plan_count counts the stored status', async () => {
		get.mockResolvedValue(2 as never);

		await call('get_daily_plan_count', { status: 'IN_PROGRESS' });

		expect(get).toHaveBeenCalledWith('/api/daily-plan/count', { params: { ...SCOPE, status: 'in-progress' } });
	});
});
