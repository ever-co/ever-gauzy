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

	it('get_merchants adds the caller’s filters to `where`', async () => {
		await call('get_merchants', {
			where: { isActive: true },
			page: 3,
			limit: 5,
			relations: ['tags']
		});

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { where: { ...SCOPE, isActive: true }, take: 5, skip: 10, relations: ['tags'] }
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

describe('merchant list tools — the search the route does not apply', () => {
	const MERCHANTS = [
		{ id: 'm1', name: 'Northwind Supply', code: 'NW-1', email: 'orders@example.com' },
		{ id: 'm2', name: 'Harbor Goods', code: 'HB-2', email: 'north.desk@example.com' },
		{ id: 'm3', name: 'Tally Parts', code: 'TP-3', email: 'tally@example.com' }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: MERCHANTS, total: MERCHANTS.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(['get_merchants', 'get_active_merchants', 'get_archived_merchants'])(
		'%s keeps the merchants whose name, code or email contains the search',
		async (name) => {
			const result = await call(name, { search: 'NORTH' });
			expect(JSON.parse(result.content[0].text)).toEqual({ items: [MERCHANTS[0], MERCHANTS[1]], total: 2 });

			const byCode = await call(name, { search: 'tp-3' });
			expect(JSON.parse(byCode.content[0].text)).toEqual({ items: [MERCHANTS[2]], total: 1 });
		}
	);

	it('reads the whole list for a search, with the filters of the tool', async () => {
		await call('get_archived_merchants', { search: 'north' });

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { where: { ...SCOPE, isArchived: true }, take: 100, skip: 0 }
		});
	});
});
