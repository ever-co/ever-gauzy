/**
 * `GET /api/merchants` validates `BaseQueryDTO`: `where` is required and must name the organization. The merchant list
 * tools sent the scope outside `where`, so they were refused (400 "where should not be empty", or "where.organizationId
 * must be a UUID" when a filter was named). They now send the scope and their filters inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerMerchantTools } from './merchants';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The merchant tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerMerchantTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('merchant list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_merchants adds the caller’s filters to `where`, the search outside it as before', async () => {
		await call('get_merchants', {
			where: { isActive: true },
			search: 'north',
			page: 3,
			limit: 5,
			relations: ['tags']
		});

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { where: { ...SCOPE, isActive: true }, take: 5, skip: 10, relations: ['tags'], search: 'north' }
		});
	});

	it('get_active_merchants reads the active merchants of the organization', async () => {
		await call('get_active_merchants');

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { where: { ...SCOPE, isActive: true, isArchived: false }, take: 10, skip: 0 }
		});
	});

	it('get_archived_merchants reads the archived merchants of the organization', async () => {
		await call('get_archived_merchants');

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { where: { ...SCOPE, isArchived: true }, take: 10, skip: 0 }
		});
	});
});
