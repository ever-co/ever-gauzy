/**
 * The task tools list statuses, priorities, sizes and types by key (`OPEN`, `HIGH`), and the list filters send the value
 * the API stores (`open`, `high`). The tools that create or update tasks sent the key as it was: a task created through
 * the assistant was stored with the status `OPEN`, which none of the workspace's statuses use (#12104). They now send
 * the stored value; any other value, a custom status included, is sent as it is.
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
const OTHER_TASK = '00000000-0000-4000-8000-000000000061';

/** A task's enum fields as the tools list them, and as the API stores them. */
const BY_KEY = { status: 'IN_PROGRESS', priority: 'HIGHEST', size: 'X_SMALL', issueType: 'BUG' };
const STORED = { status: 'in-progress', priority: 'urgent', size: 'tiny', issueType: 'bug' };

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

describe('task write tools: the values the API stores', () => {
	let post: jest.SpyInstance;
	let put: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		jest.spyOn(apiClient, 'get').mockResolvedValue({ id: TASK, title: 'Send the Larchmont quote', status: 'open' });
		post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: TASK } as never);
		put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: TASK } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('create_task stores the values of the keys it is given', async () => {
		await call('create_task', { task_data: { title: 'Send the Larchmont quote', ...BY_KEY } });

		expect(post).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ ...STORED, ...SCOPE }));
	});

	it('update_task stores the values of the keys it is given', async () => {
		await call('update_task', { id: TASK, task_data: BY_KEY });

		expect(put).toHaveBeenCalledWith(`/api/tasks/${TASK}`, expect.objectContaining(STORED));
	});

	it('bulk_create_tasks stores the values for each task', async () => {
		await call('bulk_create_tasks', {
			tasks: [
				{ title: 'First', ...BY_KEY },
				{ title: 'Second', status: 'BLOCKED' }
			]
		});

		const [, body] = post.mock.calls[0];
		expect(body.items).toEqual([
			expect.objectContaining({ title: 'First', ...STORED }),
			expect.objectContaining({ title: 'Second', status: 'blocked' })
		]);
	});

	it('bulk_update_tasks stores the values for each task', async () => {
		await call('bulk_update_tasks', {
			updates: [
				{ id: TASK, data: { title: 'First', ...BY_KEY } },
				{ id: OTHER_TASK, data: { title: 'Second', status: 'COMPLETED' } }
			]
		});

		expect(put).toHaveBeenCalledWith(`/api/tasks/${TASK}`, expect.objectContaining(STORED));
		expect(put).toHaveBeenCalledWith(`/api/tasks/${OTHER_TASK}`, expect.objectContaining({ status: 'completed' }));
	});

	it('CONTROL: sends a stored value or a custom status as it is', async () => {
		await call('update_task', { id: TASK, task_data: { status: 'waiting on client', priority: 'low' } });

		expect(put).toHaveBeenCalledWith(
			`/api/tasks/${TASK}`,
			expect.objectContaining({ status: 'waiting on client', priority: 'low' })
		);
	});
});
