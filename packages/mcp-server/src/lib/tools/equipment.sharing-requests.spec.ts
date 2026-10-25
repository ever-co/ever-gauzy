/**
 * `get_equipment_sharing_requests` sent `organizationId`, `equipmentId`, `employeeId`, `status`, `page` and `limit` as
 * query parameters of their own to `GET /api/equipment-sharing`. That route reads one `data` parameter, the JSON of
 * `{ relations, findInput }` (`ParseJsonPipe`; a missing one parses to `{}`), so every filter was dropped and the tool
 * answered every sharing of the tenant. The tool now sends the columns it filters on as `findInput`, and applies the
 * employee (a membership) and the page (the route has none) to the answer.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import {
	EQUIPMENT_SHARING_REQUESTS_RELATIONS,
	equipmentSharingRequestsQuery,
	equipmentSharingStatusValue,
	registerEquipmentTools,
	selectEquipmentSharingRequests
} from './equipment';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const EQUIPMENT = '00000000-0000-4000-8000-000000000010';
const EMPLOYEE = '00000000-0000-4000-8000-000000000030';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000031';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

/** The equipment tools, by name, as a server would be handed their callbacks. */
function equipmentTools(): Map<string, ToolCallback> {
	const tools = new Map<string, ToolCallback>();
	const server = {
		registerTool: (name: string, _config: unknown, callback: ToolCallback) => tools.set(name, callback),
		tool: () => undefined
	};
	registerEquipmentTools(server as any);
	return tools;
}

/** The `data` find-input a call sent. */
function sentData(params: Record<string, unknown>): { relations: string[]; findInput: Record<string, unknown> } {
	expect(Object.keys(params)).toEqual(['data']);
	return JSON.parse(params['data'] as string);
}

describe('get_equipment_sharing_requests — the query the route reads', () => {
	it('sends the filters as the `data` find-input, with the integer status the column holds', () => {
		const params = equipmentSharingRequestsQuery(
			{ organizationId: ORGANIZATION, tenantId: TENANT },
			{ equipmentId: EQUIPMENT, status: 'APPROVED' }
		);

		expect(sentData(params)).toEqual({
			relations: [...EQUIPMENT_SHARING_REQUESTS_RELATIONS],
			findInput: { organizationId: ORGANIZATION, tenantId: TENANT, equipmentId: EQUIPMENT, status: 2 }
		});
	});

	it('filters on the organization alone when no other filter is given, and loads the memberships', () => {
		const { relations, findInput } = sentData(equipmentSharingRequestsQuery({ organizationId: ORGANIZATION }));

		expect(findInput).toEqual({ organizationId: ORGANIZATION });
		// The employee filter is applied to the answer, so each sharing must come with its employees.
		expect(relations).toContain('employees');
	});

	it.each([
		['REQUESTED', 1],
		['approved', 2],
		[' Refused ', 3],
		['1', 1],
		[3, 3]
	])('reads the status %p as %p', (status, value) => {
		expect(equipmentSharingStatusValue(status)).toBe(value);
	});

	it.each([['PENDING'], ['0'], [4], ['2.5'], ['constructor'], ['__proto__']])(
		'refuses the status %p rather than a filter that matches nothing',
		(status) => {
			expect(() => equipmentSharingStatusValue(status)).toThrow(
				/status must be one of REQUESTED, APPROVED, REFUSED/
			);
		}
	);
});

describe('get_equipment_sharing_requests — the answer', () => {
	const sharing = (id: string, employees: string[]) => ({ id, employees: employees.map((e) => ({ id: e })) });
	const items = [
		sharing('s1', [EMPLOYEE]),
		sharing('s2', [OTHER_EMPLOYEE]),
		sharing('s3', [OTHER_EMPLOYEE, EMPLOYEE]),
		{ id: 's4' },
		sharing('s5', [EMPLOYEE])
	];

	it('keeps the sharings shared with the employee, and counts them before paging', () => {
		expect(selectEquipmentSharingRequests(items, { employeeId: EMPLOYEE, page: 1, limit: 2 })).toEqual({
			items: [items[0], items[2]],
			total: 3
		});
		expect(selectEquipmentSharingRequests(items, { employeeId: EMPLOYEE, page: 2, limit: 2 })).toEqual({
			items: [items[4]],
			total: 3
		});
	});

	it('pages every sharing when no employee is named', () => {
		expect(selectEquipmentSharingRequests(items, { page: 2, limit: 3 })).toEqual({
			items: [items[3], items[4]],
			total: 5
		});
	});
});

describe('get_equipment_sharing_requests — the call the tool makes', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});
	afterEach(() => jest.restoreAllMocks());

	it('reads the list through the `data` find-input, and answers the filtered page', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
			items: [
				{ id: 's1', status: 1, employees: [{ id: EMPLOYEE }] },
				{ id: 's2', status: 1, employees: [{ id: OTHER_EMPLOYEE }] }
			],
			total: 2
		} as never);
		const tool = equipmentTools().get('get_equipment_sharing_requests');

		const result = await tool({
			equipmentId: EQUIPMENT,
			employeeId: EMPLOYEE,
			status: 'REQUESTED',
			page: 1,
			limit: 10
		});

		expect(get).toHaveBeenCalledTimes(1);
		const [path, config] = get.mock.calls[0] as [string, { params: Record<string, unknown> }];
		expect(path).toBe('/api/equipment-sharing');
		expect(sentData(config.params).findInput).toEqual({
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			equipmentId: EQUIPMENT,
			status: 1
		});
		// None of the loose parameters the route never read.
		for (const loose of ['organizationId', 'equipmentId', 'employeeId', 'status', 'page', 'limit']) {
			expect(config.params).not.toHaveProperty(loose);
		}
		expect(JSON.parse(result.content[0].text)).toEqual({
			items: [{ id: 's1', status: 1, employees: [{ id: EMPLOYEE }] }],
			total: 1
		});
	});

	it('reads nothing for a status it cannot map', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [] } as never);
		const tool = equipmentTools().get('get_equipment_sharing_requests');

		await expect(tool({ status: 'PENDING' })).rejects.toThrow(/Failed to fetch equipment sharing requests/);
		expect(get).not.toHaveBeenCalled();
	});
});
