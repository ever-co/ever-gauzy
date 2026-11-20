/**
 * The invoice tools listed `CANCELLED`, a status the API does not store: it stores a cancelled invoice as `VOID`, and
 * refused the status (#12104). They also left out statuses the API does store. The tools that write or filter an
 * invoice status now send `VOID` for `CANCELLED`, and every other status as it is.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { InvoiceStatusEnum } from '../input-schemas';
import { registerInvoiceTools } from './invoices';

const SCOPE = {
	organizationId: '00000000-0000-4000-8000-000000000002',
	tenantId: '00000000-0000-4000-8000-000000000001'
};
const INVOICE = '00000000-0000-4000-8000-000000000080';
const NEW_INVOICE = { invoiceNumber: '42', invoiceDate: '2026-11-20', dueDate: '2026-12-20', currency: 'EUR' };

/** The statuses the API stores: InvoiceStatusTypesEnum and EstimateStatusTypesEnum of @gauzy/contracts. */
const API_INVOICE_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'FULLY_PAID', 'PARTIALLY_PAID', 'OVERPAID', 'VOID'];
const API_ESTIMATE_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'VOID'];

type ToolCallback = (args: Record<string, unknown>) => Promise<unknown>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The invoice tools, by name, as a server would be handed their schemas and callbacks. */
function invoiceTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerInvoiceTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tool = invoiceTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('invoice tools: the statuses the API stores', () => {
	let get: jest.SpyInstance;
	let post: jest.SpyInstance;
	let put: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
		post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: INVOICE } as never);
		put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: INVOICE } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('create_invoice and update_invoice store a cancelled invoice as VOID', async () => {
		await call('create_invoice', { invoice_data: { ...NEW_INVOICE, status: 'CANCELLED' } });
		await call('update_invoice', { id: INVOICE, invoice_data: { status: 'CANCELLED' } });

		expect(post).toHaveBeenCalledWith('/api/invoices', expect.objectContaining({ status: 'VOID' }));
		expect(put).toHaveBeenCalledWith(`/api/invoices/${INVOICE}`, expect.objectContaining({ status: 'VOID' }));
	});

	it('update_invoice_action and update_estimate_status send VOID for CANCELLED', async () => {
		await call('update_invoice_action', { id: INVOICE, status: 'CANCELLED' });
		await call('update_estimate_status', { id: INVOICE, data: { status: 'CANCELLED', isEstimate: true } });

		expect(put).toHaveBeenCalledWith(`/api/invoices/${INVOICE}/action`, { status: 'VOID' });
		expect(put).toHaveBeenCalledWith(`/api/invoices/${INVOICE}/estimate`, { status: 'VOID', isEstimate: true });
	});

	it('get_invoices and get_invoice_count filter cancelled invoices on VOID', async () => {
		await call('get_invoices', { status: 'CANCELLED' });
		await call('get_invoice_count', { status: 'CANCELLED' });

		const [, listQuery] = get.mock.calls[0];
		const [, countQuery] = get.mock.calls[1];
		expect(listQuery.params.where.status).toBe('VOID');
		expect(countQuery.params.status).toBe('VOID');
	});

	it('CONTROL: sends a status the API stores as it is', async () => {
		await call('update_invoice_action', { id: INVOICE, status: 'SENT' });
		await call('get_invoices', { status: 'SENT' });

		expect(put).toHaveBeenCalledWith(`/api/invoices/${INVOICE}/action`, { status: 'SENT' });
		expect(get.mock.calls[0][1].params.where.status).toBe('SENT');
	});

	it('offers every status the API stores for an invoice or an estimate', () => {
		const statuses = [...new Set([...API_INVOICE_STATUSES, ...API_ESTIMATE_STATUSES])];

		expect(statuses.filter((status) => !InvoiceStatusEnum.safeParse(status).success)).toEqual([]);
	});
});
