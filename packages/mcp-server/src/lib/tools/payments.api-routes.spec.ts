/**
 * Six payment tools called routes the API never served: `/payments/statistics`, `/payments/overdue` and
 * `/payments/search` were read as a payment id, and the status, process and refund routes answered 404. Overdue
 * payments now come from the payment list, filtered on the payment's overdue flag. The API derives a payment's status
 * from its amounts and sets it through no route, and serves no payment statistics or search: those tools answer so
 * without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerPaymentTools } from './payments';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const PAYMENT = '00000000-0000-4000-8000-000000000141';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a payment tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerPaymentTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('payment tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists the overdue payments from the payment pages, in the scope the guard reads and the currency asked', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);

		await call('get_overdue_payments', { page: 2, limit: 25, currency: 'EUR', relations: ['invoice'] });

		expect(get).toHaveBeenCalledWith('/api/payments/pagination', {
			params: {
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				where: { organizationId: ORGANIZATION, tenantId: TENANT, overdue: true, currency: 'EUR' },
				take: 25,
				skip: 2,
				relations: ['invoice']
			}
		});
	});

	it.each([
		['update_payment_status', { id: PAYMENT, status: 'COMPLETED' }, "setting a payment's status"],
		['get_payment_statistics', {}, 'payment statistics'],
		['process_payment', { id: PAYMENT }, 'processing a payment'],
		['refund_payment', { id: PAYMENT, refundAmount: 20 }, 'refunding a payment'],
		['search_payments', { query: 'deposit' }, 'searching payments']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		const requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);

		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
