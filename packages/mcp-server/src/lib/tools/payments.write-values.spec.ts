/**
 * The payment tools list methods the API does not store (`PAYPAL`, `DEBIT_CARD`, `CHECK`), and the API refuses a
 * payment with one of them (#12104). The tools that create or update a payment now send the method the API stores for
 * it; a method the API stores is sent as it is.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { PaymentMethodEnum } from '../input-schemas';
import { registerPaymentTools } from './payments';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};
const PAYMENT = '00000000-0000-4000-8000-000000000070';

/** The methods the API stores (PaymentMethodEnum of @gauzy/contracts). */
const API_PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'DEBIT', 'ONLINE'];

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The payment tools, by name, as a server would be handed their schemas and callbacks, whichever way they register. */
function paymentTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback }),
		tool: (name: string, _description: string, shape: z.ZodRawShape, _hints: unknown, callback: ToolCallback) =>
			tools.set(name, { inputSchema: z.object(shape), callback })
	};
	registerPaymentTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tool = paymentTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('payment write tools: the methods the API stores', () => {
	let post: jest.SpyInstance;
	let put: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		jest.spyOn(apiClient, 'get').mockResolvedValue({ id: PAYMENT, organizationId: SCOPE.organizationId });
		post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: PAYMENT } as never);
		put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: PAYMENT } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['PAYPAL', 'ONLINE'],
		['STRIPE', 'ONLINE'],
		['DEBIT_CARD', 'DEBIT'],
		['CHECK', 'CHEQUE']
	])('create_payment stores %s as %s', async (listed, stored) => {
		await call('create_payment', { payment_data: { amount: 120, currency: 'EUR', paymentMethod: listed } });

		expect(post).toHaveBeenCalledWith(
			'/api/payments',
			expect.objectContaining({ paymentMethod: stored, ...SCOPE })
		);
	});

	it('update_payment stores the method the API knows', async () => {
		await call('update_payment', { id: PAYMENT, payment_data: { paymentMethod: 'PAYPAL' } });

		expect(put).toHaveBeenCalledWith(
			`/api/payments/${PAYMENT}`,
			expect.objectContaining({ paymentMethod: 'ONLINE' })
		);
	});

	it('CONTROL: sends a method the API stores, or a payment without one, as it is', async () => {
		await call('create_payment', { payment_data: { amount: 120, currency: 'EUR', paymentMethod: 'CHEQUE' } });
		await call('update_payment', { id: PAYMENT, payment_data: { amount: 80 } });

		expect(post).toHaveBeenCalledWith('/api/payments', expect.objectContaining({ paymentMethod: 'CHEQUE' }));
		expect(put).toHaveBeenCalledWith(
			`/api/payments/${PAYMENT}`,
			expect.not.objectContaining({ paymentMethod: expect.anything() })
		);
	});

	it('offers every method the API stores', () => {
		expect(API_PAYMENT_METHODS.filter((method) => !PaymentMethodEnum.safeParse(method).success)).toEqual([]);
	});
});
