/**
 * `GET /api/product-categories` validates `BaseQueryDTO`: `where` is required, and a query with the scope outside it
 * was refused (400 "where should not be empty"). `get_product_categories` now sends the scope inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerProductCategoryTools } from './product-categories';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The product category tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerProductCategoryTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('product category list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_product_categories reads the pagination route, with the language in the header the API reads', async () => {
		await call('get_product_categories', {
			langCode: 'fr',
			page: 2,
			limit: 5,
			relations: ['products']
		});

		expect(get).toHaveBeenCalledWith('/api/product-categories/pagination', {
			params: { where: SCOPE, take: 5, skip: 2, relations: ['products'] },
			headers: { language: 'fr' }
		});
	});

	it('get_product_categories sends no language header when none is named', async () => {
		await call('get_product_categories');

		expect(get).toHaveBeenCalledWith('/api/product-categories/pagination', {
			params: { where: SCOPE, take: 10, skip: 1 },
			headers: {}
		});
	});
});

describe('get_product_categories — the search the route does not apply', () => {
	const CATEGORIES = [
		{ id: 'g1', name: 'Fournitures de bureau' },
		{ id: 'g2', name: 'Mobilier de bureau' },
		{ id: 'g3', name: 'Informatique' }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: CATEGORIES, total: CATEGORIES.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps the categories whose translated name contains the search, reading every page in that language', async () => {
		const result = await call('get_product_categories', { search: 'BUREAU', langCode: 'fr', limit: 1, page: 2 });

		expect(JSON.parse(result.content[0].text)).toEqual({ items: [CATEGORIES[1]], total: 2 });
		expect(get).toHaveBeenCalledWith('/api/product-categories/pagination', {
			params: { where: SCOPE, take: 100, skip: 1 },
			headers: { language: 'fr' }
		});
	});
});
