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

	it('get_employee_awards filters inside `where`, the search and the sort outside it as before', async () => {
		await call('get_employee_awards', {
			employeeId: EMPLOYEE,
			year: '2026',
			search: 'best',
			sortBy: 'name',
			page: 2,
			limit: 5,
			relations: ['employee']
		});

		expect(get).toHaveBeenCalledWith('/api/employee-award', {
			params: {
				where: { ...SCOPE, employeeId: EMPLOYEE, year: '2026' },
				take: 5,
				skip: 5,
				relations: ['employee'],
				search: 'best',
				sortBy: 'name',
				sortOrder: 'DESC'
			}
		});
	});

	it('get_employee_awards_by_employee names the employee inside `where`', async () => {
		await call('get_employee_awards_by_employee', { employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/employee-award', {
			params: { where: { ...SCOPE, employeeId: EMPLOYEE }, take: 10, skip: 0, sortBy: 'year', sortOrder: 'DESC' }
		});
	});

	it('get_employee_awards_by_year names the year inside `where`', async () => {
		await call('get_employee_awards_by_year', { year: '2025', employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith('/api/employee-award', {
			params: {
				where: { ...SCOPE, year: '2025', employeeId: EMPLOYEE },
				take: 10,
				skip: 0,
				sortBy: 'name',
				sortOrder: 'ASC'
			}
		});
	});
});
