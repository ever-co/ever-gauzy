/**
 * `GET /api/employee` and `GET /api/employee/pagination` validate `BaseQueryDTO`: `where` is required, and a query with
 * the scope outside it was refused (400 "where should not be empty"). The employee list tools now send the scope and
 * the caller's filters inside `where`, with the paging each route reads: a row offset on the list, a page number on the
 * pagination route.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerEmployeeTools } from './employees';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The employee tools, by name, as a server would be handed their schemas and callbacks. */
function employeeTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerEmployeeTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = employeeTools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('employee list tools — the query each route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_employees reads the first page with the scope in `where`', async () => {
		await call('get_employees');

		expect(get).toHaveBeenCalledWith('/api/employee', { params: { where: SCOPE, take: 10, skip: 0 } });
	});

	it('get_employees adds the caller’s filters to `where`', async () => {
		await call('get_employees', {
			where: { isActive: true },
			page: 3,
			limit: 5,
			relations: ['user']
		});

		expect(get).toHaveBeenCalledWith('/api/employee', {
			params: { where: { ...SCOPE, isActive: true }, take: 5, skip: 10, relations: ['user'] }
		});
	});

	it('get_employees_pagination adds the caller’s filters to `where`, paged by page number', async () => {
		await call('get_employees_pagination', { where: { isArchived: false }, page: 3, limit: 5 });

		expect(get).toHaveBeenCalledWith('/api/employee/pagination', {
			params: { where: { ...SCOPE, isArchived: false }, take: 5, skip: 3 }
		});
	});
});

describe('employee list tools — a search of the name or email', () => {
	const EMPLOYEES = [
		{ id: 'e1', user: { firstName: 'Lina', lastName: 'Marsh', email: 'lina@example.com' } },
		{ id: 'e2', user: { firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' } },
		{ id: 'e3', user: { firstName: 'Nadia', lastName: 'Okafor', email: 'nadia@example.com' } }
	];
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: EMPLOYEES, total: EMPLOYEES.length } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_employees keeps the employees whose full name or email matches, reading their users', async () => {
		const result = await call('get_employees', { search: 'lina marsh', relations: ['contact'] });

		expect(JSON.parse(result.content[0].text)).toEqual({ items: [EMPLOYEES[0]], total: 1 });
		expect(get).toHaveBeenCalledWith('/api/employee', {
			params: { where: SCOPE, take: 100, skip: 0, relations: ['contact', 'user'] }
		});
	});

	it('get_employees_pagination sends the search to the name and email its route matches', async () => {
		await call('get_employees_pagination', { search: 'nadia', page: 2, limit: 5 });

		expect(get).toHaveBeenCalledWith('/api/employee/pagination', {
			params: { where: { ...SCOPE, user: { name: 'nadia', email: 'nadia' } }, take: 5, skip: 2 }
		});
	});
});
