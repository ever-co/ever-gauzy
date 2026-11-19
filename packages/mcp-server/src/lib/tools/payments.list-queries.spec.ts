/**
 * `GET /api/payments` validates `BaseQueryDTO`: `where` is required, and a query of flat filters was refused (400
 * "where should not be empty"). The payment list tools now send their filters inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerPaymentTools } from './payments';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const INVOICE = '00000000-0000-4000-8000-000000000080';
const CONTACT = '00000000-0000-4000-8000-000000000081';
const PROJECT = '00000000-0000-4000-8000-000000000030';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The payment tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerPaymentTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('payment list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_payments filters inside `where`, the search and the date range outside it as before', async () => {
		await call('get_payments', {
			status: 'COMPLETED',
			paymentMethod: 'BANK_TRANSFER',
			invoiceId: INVOICE,
			organizationContactId: CONTACT,
			projectId: PROJECT,
			currency: 'EUR',
			overdue: false,
			search: 'deposit',
			startDate: '2026-11-01',
			endDate: '2026-11-30',
			page: 2,
			limit: 5,
			relations: ['invoice']
		});

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: {
				where: {
					...SCOPE,
					status: 'CAPTURED',
					paymentMethod: 'BANK_TRANSFER',
					invoiceId: INVOICE,
					organizationContactId: CONTACT,
					projectId: PROJECT,
					currency: 'EUR',
					overdue: false
				},
				take: 5,
				skip: 5,
				relations: ['invoice'],
				search: 'deposit',
				startDate: '2026-11-01',
				endDate: '2026-11-30'
			}
		});
	});

	it('get_payments_by_invoice names the invoice inside `where`', async () => {
		await call('get_payments_by_invoice', { invoiceId: INVOICE, status: 'PENDING' });

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: { where: { ...SCOPE, invoiceId: INVOICE, status: 'AUTHORIZED' }, take: 10, skip: 0 }
		});
	});

	it('get_payments_by_client names the contact inside `where`', async () => {
		await call('get_payments_by_client', { organizationContactId: CONTACT, currency: 'USD' });

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: { where: { ...SCOPE, organizationContactId: CONTACT, currency: 'USD' }, take: 10, skip: 0 }
		});
	});
});

describe('payment list tools — the stored status and method a filter is sent as', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['PENDING', 'AUTHORIZED'],
		['PROCESSING', 'PARTIALLY_CAPTURED'],
		['COMPLETED', 'CAPTURED'],
		['FAILED', 'FAILED'],
		['CANCELLED', 'CANCELED'],
		['REFUNDED', 'REFUNDED'],
		['PARTIALLY_REFUNDED', 'PARTIALLY_REFUNDED']
	])('sends the status %s as %s', async (status, stored) => {
		await call('get_payments', { status });

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: { where: { ...SCOPE, status: stored }, take: 10, skip: 0 }
		});
	});

	it.each([
		['CREDIT_CARD', 'CREDIT_CARD'],
		['DEBIT_CARD', 'DEBIT'],
		['BANK_TRANSFER', 'BANK_TRANSFER'],
		['PAYPAL', 'ONLINE'],
		['STRIPE', 'ONLINE'],
		['CASH', 'CASH'],
		['CHECK', 'CHEQUE'],
		['CHEQUE', 'CHEQUE']
	])('sends the method %s as %s', async (paymentMethod, stored) => {
		await call('get_payments', { paymentMethod });

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: { where: { ...SCOPE, paymentMethod: stored }, take: 10, skip: 0 }
		});
	});

	it('get_payments_by_client filters the stored status', async () => {
		await call('get_payments_by_client', { organizationContactId: CONTACT, status: 'COMPLETED' });

		expect(get).toHaveBeenCalledWith('/api/payments', {
			params: { where: { ...SCOPE, organizationContactId: CONTACT, status: 'CAPTURED' }, take: 10, skip: 0 }
		});
	});

	it('get_payment_count counts the stored status and method', async () => {
		get.mockResolvedValue(0 as never);

		await call('get_payment_count', { status: 'CANCELLED', paymentMethod: 'CHECK' });

		expect(get).toHaveBeenCalledWith('/api/payments/count', {
			params: { ...SCOPE, status: 'CANCELED', paymentMethod: 'CHEQUE' }
		});
	});
});
