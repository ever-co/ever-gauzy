/**
 * The bulk employee award tools called `/employee-award/bulk`, which the API never served: a create got a 404, and an
 * update or a delete was read as the award `bulk` and refused. They now call the route of one award for each award,
 * in turn, and the statistics tool, which no route serves, answers so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerEmployeeAwardTools } from './employee-awards';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE = '00000000-0000-4000-8000-000000000032';
const FIRST_AWARD = '00000000-0000-4000-8000-000000000151';
const SECOND_AWARD = '00000000-0000-4000-8000-000000000152';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };
/** An award as the API reads it. */
const STORED_AWARD = { id: FIRST_AWARD, name: 'Mentor of the year', year: '2025', employeeId: EMPLOYEE, ...SCOPE };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls an employee award tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerEmployeeAwardTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('employee award tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates each award through the route of one award, in turn', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: FIRST_AWARD } as never);

		await call('bulk_create_employee_awards', {
			awards: [
				{ name: 'Mentor of the year', year: 2026, employeeId: EMPLOYEE },
				{ name: 'Customer hero', year: 2026, employeeId: EMPLOYEE }
			]
		});

		expect(post.mock.calls).toEqual([
			['/api/employee-award', { name: 'Mentor of the year', year: 2026, employeeId: EMPLOYEE, ...SCOPE }],
			['/api/employee-award', { name: 'Customer hero', year: 2026, employeeId: EMPLOYEE, ...SCOPE }]
		]);
	});

	it('updates each award by its id with its own data, in the scope the route requires', async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({} as never);

		await call('bulk_update_employee_awards', {
			awards: [
				{ id: FIRST_AWARD, data: { name: 'Mentor of the year', year: '2025' } },
				{ id: SECOND_AWARD, data: { name: 'Customer hero', year: '2026' } }
			]
		});

		expect(put.mock.calls).toEqual([
			[`/api/employee-award/${FIRST_AWARD}`, { name: 'Mentor of the year', year: '2025', ...SCOPE }],
			[`/api/employee-award/${SECOND_AWARD}`, { name: 'Customer hero', year: '2026', ...SCOPE }]
		]);
	});

	it.each([
		['update_employee_award', { id: FIRST_AWARD, award_data: { name: 'Mentor of the decade' } }],
		['bulk_update_employee_awards', { awards: [{ id: FIRST_AWARD, data: { name: 'Mentor of the decade' } }] }]
	])('%s keeps the current year of an award whose change names only a new name', async (name, args) => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue(STORED_AWARD as never);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({} as never);

		await call(name, args);

		expect(get).toHaveBeenCalledWith(`/api/employee-award/${FIRST_AWARD}`, { params: SCOPE });
		expect(put).toHaveBeenCalledWith(`/api/employee-award/${FIRST_AWARD}`, {
			name: 'Mentor of the decade',
			year: '2025',
			...SCOPE
		});
	});

	it('reads no award whose change names both a name and a year', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue(STORED_AWARD as never);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({} as never);

		await call('update_employee_award', { id: FIRST_AWARD, award_data: { name: 'Customer hero', year: '2026' } });

		expect(get).not.toHaveBeenCalled();
		expect(put).toHaveBeenCalledWith(`/api/employee-award/${FIRST_AWARD}`, {
			name: 'Customer hero',
			year: '2026',
			...SCOPE
		});
	});

	it('says which award failed and how many were deleted before it, instead of a success', async () => {
		const remove = jest
			.spyOn(apiClient, 'delete')
			.mockResolvedValueOnce({ affected: 1 } as never)
			.mockRejectedValueOnce(new Error('Request failed with status code 404'));

		await expect(call('bulk_delete_employee_awards', { ids: [FIRST_AWARD, SECOND_AWARD] })).rejects.toThrow(
			'Item 2 of 2 failed after 1 applied: Request failed with status code 404'
		);
		expect(remove.mock.calls).toEqual([
			[`/api/employee-award/${FIRST_AWARD}`, { params: SCOPE }],
			[`/api/employee-award/${SECOND_AWARD}`, { params: SCOPE }]
		]);
	});

	it('answers that employee award statistics are not offered, without any request', async () => {
		const requests = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
			jest.spyOn(apiClient, method).mockResolvedValue({} as never)
		);

		await expect(call('get_employee_awards_statistics', {})).rejects.toThrow(
			'This server does not offer employee award statistics'
		);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});
