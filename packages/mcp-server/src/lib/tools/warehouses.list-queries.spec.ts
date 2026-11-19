/**
 * `GET /api/warehouses` validates `BaseQueryDTO`: `where` is required, and a query of flat filters was refused (400
 * "where should not be empty"). `get_warehouses` now sends its filters inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerWarehouseTools } from './warehouses';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The warehouse tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerWarehouseTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('warehouse list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_warehouses reads the first page with the scope in `where`', async () => {
		await call('get_warehouses');

		expect(get).toHaveBeenCalledWith('/api/warehouses', { params: { where: SCOPE, take: 10, skip: 0 } });
	});

	it('get_warehouses filters the active state inside `where`, the search outside it as before', async () => {
		await call('get_warehouses', { active: false, search: 'north', page: 2, limit: 5, relations: ['contact'] });

		expect(get).toHaveBeenCalledWith('/api/warehouses', {
			params: { where: { ...SCOPE, active: false }, take: 5, skip: 5, relations: ['contact'], search: 'north' }
		});
	});
});
