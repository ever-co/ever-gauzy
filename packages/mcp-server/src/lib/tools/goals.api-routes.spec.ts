/**
 * Four goal tools called routes the API never served: `/goals/me` and `/goals/statistics` were read as a goal id and
 * refused, and `/goals/:id/progress` and `/goals/:id/align` answered 404. A goal's progress now goes through the
 * goal's update, the person's goals through the goal list, and the statistics and the alignment of one goal with
 * another, which no route offers, are answered so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerGoalTools } from './goals';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const GOAL = '00000000-0000-4000-8000-000000000071';
const PARENT_GOAL = '00000000-0000-4000-8000-000000000072';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a goal tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (
			toolName: string,
			config: { inputSchema: RegisteredTool['inputSchema'] },
			callback: ToolCallback
		) => tools.set(toolName, { inputSchema: config.inputSchema, callback })
	};
	registerGoalTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

/** Spies on every request method of the API client, answering each with `answer`. */
const spyOnRequests = (answer: unknown = {}) =>
	(['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
		jest.spyOn(apiClient, method).mockResolvedValue(answer as never)
	);

describe('goal tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});

	afterEach(() => jest.restoreAllMocks());

	it("sets a goal's progress through the goal's update, with the name and the scope the routes require", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ id: GOAL, name: 'Ship the kit' } as never);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: GOAL } as never);

		await call('update_goal_progress', { id: GOAL, progress: 40 });

		expect(get).toHaveBeenCalledWith(`/api/goals/${GOAL}`, {
			params: { organizationId: ORGANIZATION, tenantId: TENANT }
		});
		expect(put).toHaveBeenCalledWith(`/api/goals/${GOAL}`, {
			name: 'Ship the kit',
			progress: 40,
			tenantId: TENANT
		});
	});

	it('lists the goals the signed-in person owns, and pages them', async () => {
		const goals = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		const get = jest.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
			if (path === '/api/user/me') {
				return { employee: { id: OWN_EMPLOYEE } } as never;
			}
			return { items: goals, total: goals.length } as never;
		});

		const result = await call('get_my_goals', { level: 'EMPLOYEE', page: 2, limit: 2 });

		const findInput = {
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			ownerEmployeeId: OWN_EMPLOYEE,
			level: 'EMPLOYEE'
		};
		expect(get).toHaveBeenLastCalledWith('/api/goals', { params: { data: JSON.stringify({ findInput }) } });
		expect(JSON.parse(result.content[0].text)).toEqual({ items: [{ id: 'c' }], total: 3 });
	});

	it('refuses a status filter on goals, without any request', async () => {
		const requests = spyOnRequests();

		await expect(call('get_my_goals', { status: 'completed' })).rejects.toThrow(
			'This server does not offer a status filter on goals'
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it.each([
		['get_goal_statistics', {}, 'goal statistics'],
		['align_goals', { parentGoalId: PARENT_GOAL, childGoalId: GOAL }, 'aligning one goal with another']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		const requests = spyOnRequests();

		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
