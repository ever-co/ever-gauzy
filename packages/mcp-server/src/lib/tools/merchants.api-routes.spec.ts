/**
 * Six merchant tools called routes the API never served: `/merchants/by-code`, `/merchants/search` and
 * `/merchants/statistics` were read as a merchant id, and the archive, restore and bulk routes answered 404. A bulk
 * create now posts each merchant in turn and a code is looked up in the merchant list. The API has no merchant archive
 * (no merchant DTO declares `isArchived`, and the soft delete hides a merchant from the app for good), no search and no
 * statistics: those tools answer so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerMerchantTools } from './merchants';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const MERCHANT = '00000000-0000-4000-8000-000000000131';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };
const HARBOR = { name: 'Harbor Supplies', code: 'HARBOR', email: 'ops@example.com', currency: 'USD' };
const RIDGE = { name: 'Blue Ridge', code: 'RIDGE', email: 'hello@example.com', currency: 'EUR' };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a merchant tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerMerchantTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('merchant tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
	});

	afterEach(() => jest.restoreAllMocks());

	it('looks a code up in the merchant list, in the scope the guard reads, and answers the merchant', async () => {
		const merchant = { id: MERCHANT, code: 'HARBOR' };
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [merchant], total: 1 } as never);

		const result = await call('get_merchant_by_code', { code: 'HARBOR', relations: ['contact'] });

		expect(get).toHaveBeenCalledWith('/api/merchants', {
			params: { ...SCOPE, where: { ...SCOPE, code: 'HARBOR' }, take: 1, skip: 0, relations: ['contact'] }
		});
		expect(JSON.parse(result.content[0].text)).toEqual(merchant);
	});

	it('says no merchant has a code the list does not match', async () => {
		jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);

		await expect(call('get_merchant_by_code', { code: 'NOWHERE' })).rejects.toThrow(
			'No merchant has the code NOWHERE.'
		);
	});

	it('creates each merchant through the route of one merchant, in turn', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: MERCHANT } as never);

		await call('bulk_create_merchants', {
			merchants: [{ ...HARBOR }, { ...RIDGE }]
		});

		expect(post.mock.calls).toEqual([
			['/api/merchants', { ...HARBOR, ...SCOPE }],
			['/api/merchants', { ...RIDGE, ...SCOPE }]
		]);
	});

	it.each([
		['name', { ...RIDGE, name: '' }],
		['code', { ...RIDGE, code: '' }],
		['code', { ...RIDGE, code: undefined }],
		['email', { ...RIDGE, email: undefined }],
		['email', { ...RIDGE, email: 'not an address' }],
		['currency', { ...RIDGE, currency: undefined }]
	])(
		'creates no merchant of a batch where one misses a valid %s, which the create route requires',
		async (field, invalid) => {
			const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: MERCHANT } as never);

			await expect(call('bulk_create_merchants', { merchants: [{ ...HARBOR }, invalid] })).rejects.toThrow(field);
			expect(post).not.toHaveBeenCalled();
		}
	);

	it.each([
		['archive_merchant', { id: MERCHANT }, 'archiving a merchant'],
		['restore_merchant', { id: MERCHANT }, 'restoring an archived merchant'],
		['search_merchants', { query: 'harbor' }, 'searching merchants'],
		['get_merchant_statistics', {}, 'merchant statistics']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		const requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);

		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it('points an archive to the removal of the merchant', async () => {
		jest.spyOn(apiClient, 'delete').mockResolvedValue({} as never);

		await expect(call('archive_merchant', { id: MERCHANT })).rejects.toThrow('delete_merchant removes a merchant.');
	});
});
