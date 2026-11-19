/**
 * Nine deal tools called routes the API never served: `/deals/me`, `/deals/statistics`, `/deals/pipeline`,
 * `/deals/search` and `/deals/count` were read as a deal id, and the stage and property routes answered 404. The
 * person's deals now come from the deal list, filtered on who created them, and the count from the list's total; the
 * API has no fixed deal stages, no deal properties, no deal statistics, no organization-wide grouping by stage and no
 * deal search, and those tools answer so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerDealTools } from './deals';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000021';
const DEAL = '00000000-0000-4000-8000-000000000101';
const CLIENT = '00000000-0000-4000-8000-000000000111';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a deal tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerDealTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

/** Spies on every request method of the API client, answering each with `answer`. */
const spyOnRequests = (answer: unknown = {}) =>
	(['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
		jest.spyOn(apiClient, method).mockResolvedValue(answer as never)
	);

describe('deal tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
		jest.spyOn(authManager, 'getUserId').mockReturnValue(USER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists the deals the signed-in user created, a page at a time, in the scope the guard reads', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);

		await call('get_my_deals', { page: 2, limit: 5, relations: ['stage'] });

		expect(get).toHaveBeenCalledWith('/api/deals', {
			params: {
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				where: { organizationId: ORGANIZATION, tenantId: TENANT, createdByUserId: USER },
				take: 5,
				skip: 5,
				relations: ['stage']
			}
		});
	});

	it("counts the organization's deals from the total of the deal list, with the client asked", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [{ id: DEAL }], total: 7 } as never);

		const result = await call('get_deal_count', { clientId: CLIENT });

		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/api/deals', {
			params: {
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				where: { organizationId: ORGANIZATION, tenantId: TENANT, clientId: CLIENT },
				take: 1,
				skip: 0
			}
		});
		expect(JSON.parse(result.content[0].text)).toEqual({ count: 7 });
	});

	it.each([
		['get_my_deals', { stage: 'NEGOTIATION' }],
		['get_deal_count', { stage: 'NEGOTIATION' }]
	])('refuses a filter on fixed deal stages in %s, without any request', async (name, args) => {
		const requests = spyOnRequests();

		await expect(call(name, args)).rejects.toThrow('This server does not offer a filter on fixed deal stages');
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it.each([
		['update_deal_stage', { id: DEAL, stage: 'NEGOTIATION' }, 'fixed deal stages'],
		['get_deal_statistics', {}, 'deal statistics'],
		['add_deal_property', { dealId: DEAL, property: { name: 'region', value: 'north' } }, 'custom properties'],
		['update_deal_property', { dealId: DEAL, propertyName: 'region', value: 'south' }, 'custom properties'],
		['remove_deal_property', { dealId: DEAL, propertyName: 'region' }, 'custom properties'],
		['get_deals_pipeline', {}, 'deals grouped by pipeline stage'],
		['search_deals', { query: 'harbor' }, 'searching deals']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		const requests = spyOnRequests();

		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});

	it('points a stage change to the update of the deal', async () => {
		spyOnRequests();

		await expect(call('update_deal_stage', { id: DEAL, stage: 'LEAD' })).rejects.toThrow(
			'update_deal sets its stageId'
		);
	});
});
