/**
 * A failed project, task or timer tool logged the HTTP client's error whole: its request headers, with the person's
 * token in clear, went to the server's log. Every tool now logs the error through `sanitizeForLogging`, as the other
 * tool groups do, and so does the server where a tool call fails (#12119).
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';
import { Logger } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';
import { registerTimerTools } from './timer';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};

/** The person's own token, sent in the failed request's headers. */
const TOKEN = 'gauzy-person-token-0123456789abcdef';

const API_FAILURE = 'Request failed with status code 500';

/** The HTTP client's error for a request the API answered 500, with the request it was for. */
function failedRequest(): AxiosError {
	const config = {
		url: '/api/tasks',
		method: 'get',
		headers: new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` })
	};
	const response = { status: 500, statusText: 'Internal Server Error', data: {}, headers: {}, config };
	return new AxiosError(API_FAILURE, 'ERR_BAD_RESPONSE', config as never, {}, response as never);
}

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;
type Register = (server: never) => void;

/** Every tool's callback of one group, by name, as a server would be handed them. */
function callbacksOf(register: Register): Map<string, ToolCallback> {
	const callbacks = new Map<string, ToolCallback>();
	const server = {
		registerTool: (name: string, _config: unknown, callback: ToolCallback) => callbacks.set(name, callback),
		// Some task tools still register through the SDK's older `tool(name, ..., callback)`
		tool: (name: string, ...rest: unknown[]) => {
			const callback = rest.filter((part) => typeof part === 'function').at(-1) as ToolCallback;
			callbacks.set(name, callback);
		}
	};
	register(server as never);
	return callbacks;
}

/** Each tool, and the start of what it answers the assistant, which this change leaves as it was. */
const FAILING_TOOLS: Array<[string, string, Register, string]> = [
	['projects', 'get_projects', registerProjectTools as Register, 'Failed to fetch projects'],
	['tasks', 'get_tasks', registerTaskTools as Register, 'Failed to fetch tasks: '],
	['timer', 'timer_status', registerTimerTools as Register, `Failed to fetch timer status: ${API_FAILURE}`],
	['timer', 'start_timer', registerTimerTools as Register, `Failed to start timer: ${API_FAILURE}`],
	['timer', 'stop_timer', registerTimerTools as Register, `Failed to stop timer: ${API_FAILURE}`]
];

const API_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

describe("a failed tool's log keeps the person's token out", () => {
	let logged: jest.SpyInstance[];

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		for (const method of API_METHODS) {
			jest.spyOn(apiClient, method).mockRejectedValue(failedRequest());
		}
		logged = [
			jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
			jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
		];
	});

	afterEach(() => jest.restoreAllMocks());

	// What the logger was handed, written out the way a console logger writes an object
	const loggedText = () =>
		logged
			.flatMap((spy) => spy.mock.calls)
			.map((args) => inspect(args, { depth: 10 }))
			.join('\n');

	it.each(FAILING_TOOLS)(
		'%s: %s logs the failure without the token, and answers as before',
		async (_group, name, register, answer) => {
			const callback = callbacksOf(register).get(name) as ToolCallback;

			const failure = callback({});

			await expect(failure).rejects.toThrow(answer);
			await expect(failure).rejects.not.toThrow(TOKEN);
			expect(loggedText()).toContain(API_FAILURE);
			expect(loggedText()).not.toContain(TOKEN);
		}
	);

	it('no tool, and not the server where a tool call fails, hands the logger a raw error', () => {
		const tools = readdirSync(__dirname).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
		const sources = [...tools.map((file) => join(__dirname, file)), join(__dirname, '..', 'mcp-server.ts')];
		const rawLogs = sources.filter((file) =>
			/logger\.(error|warn)\([^;]*, error\);/.test(readFileSync(file, 'utf8'))
		);

		expect(rawLogs).toEqual([]);
	});
});
