/**
 * `GET /api/products/pagination` validates `BaseQueryDTO`: `where` is required, and `get_products_pagination` sent no
 * scope, so it was refused (400 "where should not be empty") unless the caller named filters. It now sends the
 * signed-in scope and the caller's filters inside `where`, with `skip` read as a page number.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerProductTools } from './products';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The product tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerProductTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('product list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_products_pagination sends the signed-in scope inside `where`, paged by page number', async () => {
		await call('get_products_pagination');

		expect(get).toHaveBeenCalledWith('/api/products/pagination', { params: { where: SCOPE, take: 10, skip: 1 } });
	});

	it("get_products_pagination adds the caller's filters to `where`, the search outside it as before", async () => {
		const category = '00000000-0000-4000-8000-000000000070';
		await call('get_products_pagination', {
			where: { enabled: true, productCategoryId: category },
			search: 'desk',
			page: 2,
			limit: 5,
			relations: ['productCategory']
		});

		expect(get).toHaveBeenCalledWith('/api/products/pagination', {
			params: {
				where: { ...SCOPE, enabled: true, productCategoryId: category },
				take: 5,
				skip: 2,
				relations: ['productCategory'],
				search: 'desk'
			}
		});
	});
});
