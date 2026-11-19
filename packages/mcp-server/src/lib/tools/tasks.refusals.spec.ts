/**
 * The task tools built their error from the HTTP client's message alone, so a refused task reached the assistant as
 * "Request failed with status code 400" without the API's reason (#12104). They now give the reason, as the other tool
 * groups do.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerTaskTools } from './tasks';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};
const TASK = '00000000-0000-4000-8000-000000000060';
const REASON = 'title should not be empty';

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;
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
async function call(name: string, args: Record<string, unknown>) {
	const tool = taskTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('task tools: why the API refused a request', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		const refusal = Object.assign(new Error('Request failed with status code 400'), {
			response: { status: 400, data: { statusCode: 400, message: [REASON] } }
		});
		for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
			jest.spyOn(apiClient, method).mockRejectedValue(refusal);
		}
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['create_task', { task_data: { title: 'Send the Larchmont quote' } }, 'Failed to create task'],
		['update_task', { id: TASK, task_data: { title: '' } }, 'Failed to update task'],
		['get_task', { id: TASK }, 'Failed to fetch task']
	])('%s gives the reason', async (name, args, failure) => {
		await expect(call(name, args)).rejects.toThrow(`${failure}: Request failed with status code 400: ${REASON}`);
	});
});
