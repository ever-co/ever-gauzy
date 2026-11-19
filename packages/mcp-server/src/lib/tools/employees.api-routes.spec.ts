/**
 * Four employee tools called routes the API never served: `/employee/me` and `/employee/statistics` were read as an
 * employee id and refused, and `/employee/:id/restore` answered 404. The person's own employee is now read and
 * updated through their employee id, the statistics through the employee statistics route, and a restore through
 * the recover route.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerEmployeeTools } from './employees';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000032';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls an employee tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (
			toolName: string,
			config: { inputSchema: RegisteredTool['inputSchema'] },
			callback: ToolCallback
		) => tools.set(toolName, { inputSchema: config.inputSchema, callback })
	};
	registerEmployeeTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

/** The signed-in user, read from `/user/me`, with their employee record. */
function signedInAs(employeeId: string) {
	return jest.spyOn(apiClient, 'get').mockImplementation(async (path: string) => {
		if (path === '/api/user/me') {
			return { id: 'user', employee: { id: employeeId } } as never;
		}
		return { id: employeeId } as never;
	});
}

describe('employee tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
	});

	afterEach(() => jest.restoreAllMocks());

	it("reads the signed-in person's own employee by its id, in the scope the route requires", async () => {
		const get = signedInAs(OWN_EMPLOYEE);

		await call('get_current_employee', { relations: ['user'] });

		expect(get).toHaveBeenCalledWith('/api/user/me', { params: { includeEmployee: true } });
		expect(get).toHaveBeenLastCalledWith(`/api/employee/${OWN_EMPLOYEE}`, {
			params: { ...SCOPE, relations: ['user'] }
		});
	});

	it("updates the signed-in person's own profile through the profile route, in their scope", async () => {
		signedInAs(OWN_EMPLOYEE);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: OWN_EMPLOYEE } as never);

		await call('update_employee_profile', { employee_data: { githubUrl: 'https://example.com/lina' } });

		expect(put).toHaveBeenCalledWith(
			`/api/employee/${OWN_EMPLOYEE}/profile`,
			expect.objectContaining({ githubUrl: 'https://example.com/lina', ...SCOPE })
		);
	});

	it('updates no profile when the signed-in user has no employee record', async () => {
		jest.spyOn(apiClient, 'get').mockResolvedValue({ id: 'user' } as never);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({} as never);

		await expect(call('update_employee_profile', { employee_data: { isAway: true } })).rejects.toThrow(
			'The logged-in user has no employee record.'
		);
		expect(put).not.toHaveBeenCalled();
	});

	it("reads an employee's statistics by month from the employee statistics route", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue([] as never);

		await call('get_employee_statistics', {
			employeeId: OTHER_EMPLOYEE,
			startDate: '2026-09-01',
			endDate: '2026-11-30'
		});

		expect(get).toHaveBeenCalledWith('/api/employee-statistics/months', {
			params: { employeeId: OTHER_EMPLOYEE, ...SCOPE, startDate: '2026-09-01', endDate: '2026-11-30' }
		});
	});

	it('restores a soft deleted employee through the recover route, in its organization', async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: OTHER_EMPLOYEE } as never);

		await call('restore_employee', { id: OTHER_EMPLOYEE });

		expect(put).toHaveBeenCalledWith(`/api/employee/${OTHER_EMPLOYEE}/recover`, SCOPE);
	});
});
