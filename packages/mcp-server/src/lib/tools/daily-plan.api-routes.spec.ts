/**
 * The bulk daily plan tools called `/daily-plan/bulk`, which the API never served: a create got a 404, and an update
 * or a delete was read as the plan `bulk` and refused. They now call the route of one plan for each plan, in turn,
 * and the statistics tool, which no route serves, answers so without any request. The create route requires an
 * employee and a team: the create tools take the team, and the person's own employee when a plan names none.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerDailyPlanTools } from './daily-plan';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const FIRST_PLAN = '00000000-0000-4000-8000-000000000061';
const SECOND_PLAN = '00000000-0000-4000-8000-000000000062';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };
const TEAM = '00000000-0000-4000-8000-000000000041';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const OTHER = '00000000-0000-4000-8000-000000000032';

/** A plan as the create route receives it, its date converted, before the employee and the scope. */
const plan = (date: string, workTimePlanned: number) => ({
	date: new Date(date),
	workTimePlanned,
	status: 'open',
	organizationTeamId: TEAM
});

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a daily plan tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (
			toolName: string,
			config: { inputSchema: RegisteredTool['inputSchema'] },
			callback: ToolCallback
		) => tools.set(toolName, { inputSchema: config.inputSchema, callback })
	};
	registerDailyPlanTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('daily plan tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
	});

	afterEach(() => jest.restoreAllMocks());

	it("creates each plan through the route of one plan, in turn, the person's own when it names no employee", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ employee: { id: OWN_EMPLOYEE } } as never);
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: FIRST_PLAN } as never);

		await call('bulk_create_daily_plans', {
			plans: [
				{ date: '2026-11-20', workTimePlanned: 6, status: 'open', organizationTeamId: TEAM },
				{ date: '2026-11-21', workTimePlanned: 6, status: 'open', organizationTeamId: TEAM },
				{ date: '2026-11-22', workTimePlanned: 4, status: 'open', organizationTeamId: TEAM, employeeId: OTHER }
			]
		});

		expect(get.mock.calls).toEqual([['/api/user/me', { params: { includeEmployee: true } }]]);
		expect(post.mock.calls).toEqual([
			['/api/daily-plan', { ...plan('2026-11-20', 6), employeeId: OWN_EMPLOYEE, ...SCOPE }],
			['/api/daily-plan', { ...plan('2026-11-21', 6), employeeId: OWN_EMPLOYEE, ...SCOPE }],
			['/api/daily-plan', { ...plan('2026-11-22', 4), employeeId: OTHER, ...SCOPE }]
		]);
	});

	it('keeps the employee each plan names, without reading the signed-in one', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({} as never);
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: FIRST_PLAN } as never);

		await call('bulk_create_daily_plans', {
			plans: [
				{ date: '2026-11-20', workTimePlanned: 6, status: 'open', organizationTeamId: TEAM, employeeId: OTHER }
			]
		});

		expect(get).not.toHaveBeenCalled();
		expect(post).toHaveBeenCalledWith('/api/daily-plan', { ...plan('2026-11-20', 6), employeeId: OTHER, ...SCOPE });
	});

	it("creates one plan for the person's own employee in the team given, its date converted", async () => {
		jest.spyOn(apiClient, 'get').mockResolvedValue({ employee: { id: OWN_EMPLOYEE } } as never);
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: FIRST_PLAN } as never);

		await call('create_daily_plan', {
			daily_plan_data: { date: '2026-11-20', workTimePlanned: 6, status: 'open', organizationTeamId: TEAM }
		});

		expect(post).toHaveBeenCalledWith('/api/daily-plan', {
			...plan('2026-11-20', 6),
			employeeId: OWN_EMPLOYEE,
			...SCOPE
		});
	});

	it('requires the team of a plan, which the create route requires', () => {
		const result = call('create_daily_plan', {
			daily_plan_data: { date: '2026-11-20', workTimePlanned: 6, status: 'open' }
		});

		return expect(result).rejects.toThrow('organizationTeamId');
	});

	it('updates each plan by its id, without the id in the body', async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({} as never);

		await call('bulk_update_daily_plans', {
			plans: [{ id: FIRST_PLAN, date: '2026-11-20', workTimePlanned: 4, status: 'in-progress' }]
		});

		expect(put).toHaveBeenCalledWith(`/api/daily-plan/${FIRST_PLAN}`, {
			date: '2026-11-20',
			workTimePlanned: 4,
			status: 'in-progress',
			...SCOPE
		});
	});

	it('deletes each plan by its id, in its organization', async () => {
		const remove = jest.spyOn(apiClient, 'delete').mockResolvedValue({ affected: 1 } as never);

		await call('bulk_delete_daily_plans', { ids: [FIRST_PLAN, SECOND_PLAN] });

		expect(remove.mock.calls).toEqual([
			[`/api/daily-plan/${FIRST_PLAN}`, { params: SCOPE }],
			[`/api/daily-plan/${SECOND_PLAN}`, { params: SCOPE }]
		]);
	});

	it('says which plan failed and how many were deleted before it, instead of a success', async () => {
		jest.spyOn(apiClient, 'delete')
			.mockResolvedValueOnce({ affected: 1 } as never)
			.mockRejectedValueOnce(new Error('Request failed with status code 404'));

		await expect(call('bulk_delete_daily_plans', { ids: [FIRST_PLAN, SECOND_PLAN] })).rejects.toThrow(
			'Item 2 of 2 failed after 1 applied: Request failed with status code 404'
		);
	});

	it('answers that daily plan statistics are not offered, without any request', async () => {
		const requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);

		await expect(call('get_daily_plan_statistics', {})).rejects.toThrow(
			'This server does not offer daily plan statistics'
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
