/**
 * `GET /api/employee-award` validates `BaseQueryDTO`: `where` is required, and a query of flat filters was refused (400
 * "where should not be empty"). The employee award list tools now send their filters inside `where`.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerEmployeeAwardTools } from './employee-awards';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE = '00000000-0000-4000-8000-000000000040';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The employee award tools, by name, as a server would be handed their schemas and callbacks. */
function awardTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerEmployeeAwardTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = awardTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('employee award list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_employee_awards reads the pagination route, which pages, joins the relations and sorts', async () => {
		await call('get_employee_awards', {
			employeeId: EMPLOYEE,
			year: '2026',
			sortBy: 'name',
			page: 2,
			limit: 5,
			relations: ['employee']
		});

		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: {
				where: { ...SCOPE, employeeId: EMPLOYEE, year: '2026' },
				take: 5,
				skip: 2,
				relations: ['employee'],
				order: { name: 'DESC', id: 'ASC' }
			}
		});
	});

	it('get_employee_awards_by_employee names the employee inside `where`', async () => {
		await call('get_employee_awards_by_employee', { employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: { where: { ...SCOPE, employeeId: EMPLOYEE }, take: 10, skip: 1, order: { year: 'DESC', id: 'ASC' } }
		});
	});

	it('get_employee_awards_by_year names the year inside `where`', async () => {
		await call('get_employee_awards_by_year', { year: '2025', employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: {
				where: { ...SCOPE, year: '2025', employeeId: EMPLOYEE },
				take: 10,
				skip: 1,
				order: { name: 'ASC', id: 'ASC' }
			}
		});
	});

	it('sorts the awards by employee on the column that names it', async () => {
		await call('get_employee_awards_by_year', { year: '2025', sortBy: 'employee', sortOrder: 'DESC' });

		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: { where: { ...SCOPE, year: '2025' }, take: 10, skip: 1, order: { employeeId: 'DESC', id: 'ASC' } }
		});
	});

	it('orders awards that share the value by their id, after the field named', async () => {
		await call('get_employee_awards_by_year', { year: '2025', sortBy: 'createdAt', sortOrder: 'DESC' });

		const [, { params }] = get.mock.calls[0];
		expect(Object.entries(params.order)).toEqual([
			['createdAt', 'DESC'],
			['id', 'ASC']
		]);
	});

	it('get_employee_awards sends no order when no field is named', async () => {
		await call('get_employee_awards');

		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: { where: SCOPE, take: 10, skip: 1 }
		});
	});
});

describe('get_employee_awards — the search the route does not apply', () => {
	const AWARDS = [
		{ id: 'a1', name: 'Best Mentor' },
		{ id: 'a2', name: 'Fastest Fixer' },
		{ id: 'a3', name: 'best newcomer' }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: AWARDS, total: AWARDS.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps the awards whose name contains the search, read whole from the pagination route', async () => {
		const result = await call('get_employee_awards', { search: 'BEST', sortBy: 'year' });

		expect(JSON.parse(result.content[0].text)).toEqual({ items: [AWARDS[0], AWARDS[2]], total: 2 });
		expect(get).toHaveBeenCalledWith('/api/employee-award/pagination', {
			params: { where: SCOPE, take: 100, skip: 1, order: { year: 'DESC', id: 'ASC' } }
		});
	});
});
