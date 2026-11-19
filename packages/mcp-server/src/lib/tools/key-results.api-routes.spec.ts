/**
 * Four key result tools called routes the API never served: `/key-results/me`, `/key-results/statistics` and
 * `/key-results/count` were read as a key result id, and `/key-results/:id/progress` answered 404. The progress now
 * goes through the key result's update, the person's key results and the count through the key result list, and the
 * statistics, which no route offers, are answered so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerKeyResultTools } from './key-results';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000012';
const TENANT = '00000000-0000-4000-8000-000000000001';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000032';
const GOAL = '00000000-0000-4000-8000-000000000071';
const KEY_RESULT = '00000000-0000-4000-8000-000000000081';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a key result tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerKeyResultTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('key result tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});

	afterEach(() => jest.restoreAllMocks());

	it("sets a key result's progress and value through the key result's update, with the tenant", async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: KEY_RESULT } as never);

		await call('update_key_result_progress', { id: KEY_RESULT, progress: 60, update: 12 });

		expect(put).toHaveBeenCalledWith(`/api/key-results/${KEY_RESULT}`, {
			progress: 60,
			update: 12,
			tenantId: TENANT
		});
	});

	it('lists the key results the signed-in person owns in their organization, with the goal and status asked', async () => {
		const keyResults = [
			{ id: 'mine', ownerId: OWN_EMPLOYEE, organizationId: ORGANIZATION, goalId: GOAL, status: 'on track' },
			{ id: 'late', ownerId: OWN_EMPLOYEE, organizationId: ORGANIZATION, goalId: GOAL, status: 'at risk' },
			{ id: 'theirs', ownerId: OTHER_EMPLOYEE, organizationId: ORGANIZATION, goalId: GOAL, status: 'on track' },
			{ id: 'elsewhere', ownerId: OWN_EMPLOYEE, organizationId: OTHER_ORGANIZATION, status: 'on track' }
		];
		const get = jest.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
			if (path === '/api/user/me') {
				return { employee: { id: OWN_EMPLOYEE } } as never;
			}
			return { items: keyResults, total: keyResults.length } as never;
		});

		const result = await call('get_my_key_results', { goalId: GOAL, status: 'on track' });

		expect(get).toHaveBeenLastCalledWith('/api/key-results', {
			params: { organizationId: ORGANIZATION, tenantId: TENANT }
		});
		expect(JSON.parse(result.content[0].text)).toEqual({ items: [keyResults[0]], total: 1 });
	});

	it("counts the organization's key results from the key result list, with the goal and owner asked", async () => {
		const keyResults = [
			{ id: 'first', ownerId: OWN_EMPLOYEE, organizationId: ORGANIZATION, goalId: GOAL },
			{ id: 'second', ownerId: OTHER_EMPLOYEE, organizationId: ORGANIZATION, goalId: GOAL },
			{ id: 'other goal', ownerId: OTHER_EMPLOYEE, organizationId: ORGANIZATION },
			{ id: 'elsewhere', ownerId: OTHER_EMPLOYEE, organizationId: OTHER_ORGANIZATION, goalId: GOAL }
		];
		const get = jest
			.spyOn(apiClient, 'get')
			.mockResolvedValue({ items: keyResults, total: keyResults.length } as never);

		const inGoal = await call('get_key_result_count', { goalId: GOAL });
		const theirs = await call('get_key_result_count', { goalId: GOAL, ownerId: OTHER_EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/key-results', {
			params: { organizationId: ORGANIZATION, tenantId: TENANT }
		});
		expect(get).not.toHaveBeenCalledWith('/api/key-results/count', expect.anything());
		expect(JSON.parse(inGoal.content[0].text)).toEqual({ count: 2 });
		expect(JSON.parse(theirs.content[0].text)).toEqual({ count: 1 });
	});

	it('answers that key result statistics are not offered, without any request', async () => {
		const requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);

		await expect(call('get_key_result_statistics', {})).rejects.toThrow(
			'This server does not offer key result statistics'
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
