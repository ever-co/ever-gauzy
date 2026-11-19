/**
 * `GET /api/invoices/pagination` validates `BaseQueryDTO`: `where` is required, and a query of flat filters was refused
 * (400 "where should not be empty"). `get_invoices` now sends its filters inside `where`, with `skip` read as a page
 * number, as the pagination route reads it.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerInvoiceTools } from './invoices';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The invoice tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerInvoiceTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('invoice list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_invoices filters inside `where`, the date range as the route reads it', async () => {
		await call('get_invoices', {
			status: 'SENT',
			invoiceType: 'BY_EMPLOYEE_HOURS',
			paid: false,
			startDate: '2026-11-01',
			endDate: '2026-11-30',
			page: 2,
			limit: 5,
			relations: ['invoiceItems']
		});

		expect(get).toHaveBeenCalledWith('/api/invoices/pagination', {
			params: {
				where: {
					...SCOPE,
					status: 'SENT',
					invoiceType: 'BY_EMPLOYEE_HOURS',
					paid: false,
					invoiceDate: { startDate: '2026-11-01', endDate: '2026-11-30' }
				},
				take: 5,
				skip: 2,
				relations: ['invoiceItems']
			}
		});
	});
});

describe('get_invoices — an open date range, and the search the route does not apply', () => {
	const INVOICES = [
		{ id: 'i1', invoiceNumber: 107, toContact: { name: 'Northwind Traders' } },
		{ id: 'i2', invoiceNumber: 215, toContact: { name: 'Tally Hub' } },
		{ id: 'i3', invoiceNumber: 1070 }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: INVOICES, total: INVOICES.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[{ startDate: '2026-11-01' }, { startDate: '2026-11-01', endDate: '9999-12-31T23:59:59.999Z' }],
		[{ endDate: '2026-11-30' }, { startDate: '1970-01-01T00:00:00.000Z', endDate: '2026-11-30' }]
	])('sends an open range %p with its open end as the earliest or latest date', async (range, invoiceDate) => {
		await call('get_invoices', range);

		expect(get).toHaveBeenCalledWith('/api/invoices/pagination', {
			params: { where: { ...SCOPE, invoiceDate }, take: 10, skip: 1 }
		});
	});

	it('keeps the invoices whose number or client name contains the search, reading their clients', async () => {
		const result = await call('get_invoices', { search: '107' });
		expect(JSON.parse(result.content[0].text)).toEqual({ items: [INVOICES[0], INVOICES[2]], total: 2 });

		const byClient = await call('get_invoices', { search: 'tally' });
		expect(JSON.parse(byClient.content[0].text)).toEqual({ items: [INVOICES[1]], total: 1 });

		expect(get).toHaveBeenCalledWith('/api/invoices/pagination', {
			params: { where: SCOPE, take: 100, skip: 1, relations: ['toContact'] }
		});
	});
});
