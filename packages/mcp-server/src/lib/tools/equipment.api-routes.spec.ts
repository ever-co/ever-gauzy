/**
 * Six equipment tools called routes the API never served. Equipment has no status and no assignee in the API: it is
 * shared with employees for a period, and has no statistics or search route. Those tools answer that this server does
 * not offer their action, without any request, and point to the sharing tools where they do a close one.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerEquipmentTools } from './equipment';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const EQUIPMENT = '00000000-0000-4000-8000-000000000121';
const EMPLOYEE = '00000000-0000-4000-8000-000000000032';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls an equipment tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerEquipmentTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('equipment tools: the actions the API does not offer', () => {
	let requests: jest.SpyInstance[];

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
		requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['update_equipment_status', { id: EQUIPMENT, status: 'IN_REPAIR' }, 'a status on equipment'],
		['assign_equipment', { id: EQUIPMENT, employeeId: EMPLOYEE }, 'assigning equipment'],
		['unassign_equipment', { id: EQUIPMENT }, 'unassigning equipment'],
		['get_my_equipment', {}, 'equipment assigned to a person'],
		['get_equipment_statistics', {}, 'equipment statistics'],
		['search_equipment', { query: 'laptop' }, 'searching equipment']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it.each([
		['assign_equipment', { id: EQUIPMENT, employeeId: EMPLOYEE }, 'request_equipment_sharing'],
		['get_my_equipment', {}, 'get_equipment_sharing_requests']
	])('%s points to %s', async (name, args, instead) => {
		await expect(call(name, args)).rejects.toThrow(instead as string);
	});
});
