/**
 * A failed daily plan tool answered the assistant with the error and its whole stack: the folder the server runs from,
 * and the files and lines of its libraries (#12103). Every daily plan tool now answers with the message alone, as the
 * other tool groups do, and the server's log keeps the stack.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { Logger } from '@nestjs/common';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerDailyPlanTools } from './daily-plan';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;

/** Every daily plan tool's callback, by name, as a server would be handed them. */
function dailyPlanCallbacks(): Map<string, ToolCallback> {
	const callbacks = new Map<string, ToolCallback>();
	const server = {
		registerTool: (name: string, _config: unknown, callback: ToolCallback) => callbacks.set(name, callback)
	};
	registerDailyPlanTools(server as never);
	return callbacks;
}

/** A line of a stack trace: `at <function> (<file>:<line>:<column>)`. */
const STACK_FRAME = /\n\s+at .+:\d+:\d+/;

/** What a tool's callback ended with: the error it threw, or none. */
async function failureOf(callback: ToolCallback): Promise<Error | undefined> {
	try {
		await callback({});
		return undefined;
	} catch (error) {
		return error as Error;
	}
}

describe('daily plan tools: what a failure tells the assistant', () => {
	const callbacks = dailyPlanCallbacks();
	let logged: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
			// The API client's own failure, whose stack runs through the HTTP library's files
			jest.spyOn(apiClient, method).mockRejectedValue(new Error('Request failed with status code 400'));
		}
		logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('covers every daily plan tool', () => {
		expect(callbacks.size).toBe(17);
	});

	it.each([...callbacks.keys()])('%s answers a failure without its stack, which stays in the log', async (name) => {
		const failure = await failureOf(callbacks.get(name) as ToolCallback);

		expect(failure?.message).toMatch(/^Failed to /);
		expect(failure?.message).not.toMatch(STACK_FRAME);
		const log = logged.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
		expect(log).toMatch(/at .+:\d+:\d+/);
	});
});
