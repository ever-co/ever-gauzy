/**
 * `request_equipment_sharing` posted its arguments under their own names (`shareStartDate`, `shareEndDate`,
 * `shareRequestDate`, `shareWithEmployeeId`, `reason`) and a string `status: 'REQUESTED'` to `POST
 * /api/equipment-sharing`. The equipment sharing maps none of those names — its columns are `shareRequestDay`,
 * `shareStartDay`, `shareEndDay`, an integer `status`, and an `employees` relation — and that route is the CRUD base's
 * raw create, which needs the decision permission and files no request approval. The tool now files the request
 * through the route the web app uses, `POST /api/equipment-sharing/organization/:id`, in the sharing's own names.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import {
	EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME,
	equipmentSharingRequestBody,
	registerEquipmentTools
} from './equipment';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const EQUIPMENT = '00000000-0000-4000-8000-000000000010';
const EMPLOYEE = '00000000-0000-4000-8000-000000000030';
const START = '2026-11-02T09:00:00.000Z';
const END = '2026-11-06T17:00:00.000Z';

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

describe('request_equipment_sharing — the body the request route files a sharing from', () => {
	it('names every field as the equipment sharing does', () => {
		const now = new Date('2026-10-25T08:00:00.000Z');

		expect(
			equipmentSharingRequestBody(
				{
					equipmentId: EQUIPMENT,
					shareWithEmployeeId: EMPLOYEE,
					shareStartDate: START,
					shareEndDate: END,
					reason: 'Client workshop'
				},
				now
			)
		).toEqual({
			name: 'Client workshop',
			equipmentId: EQUIPMENT,
			employees: [{ id: EMPLOYEE }],
			shareRequestDay: now,
			shareStartDay: new Date(START),
			shareEndDay: new Date(END),
			// `RequestApprovalStatusTypesEnum.REQUESTED`: the column is an integer, not the string the tool sent.
			status: 1
		});
	});

	it('files the name it is given as the label, else the reason, else a default: the approval requires a name', () => {
		const args = { equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: START, shareEndDate: END };

		expect(equipmentSharingRequestBody({ ...args, name: 'Projector', reason: 'Workshop' }).name).toBe('Projector');
		expect(equipmentSharingRequestBody({ ...args, reason: 'Workshop' }).name).toBe('Workshop');
		expect(equipmentSharingRequestBody({ ...args, name: '  ', reason: 'Workshop' }).name).toBe('Workshop');
		// Without one the route would save the sharing and then fail to file its approval (`name` is NOT NULL there).
		expect(equipmentSharingRequestBody(args).name).toBe(EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME);
		expect(equipmentSharingRequestBody({ ...args, name: '', reason: '' }).name).toBe(
			EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME
		);
	});

	it('refuses a date that is not one, rather than posting an invalid period', () => {
		const args = { equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: START, shareEndDate: END };

		expect(() => equipmentSharingRequestBody({ ...args, shareStartDate: 'next week' })).toThrow(/shareStartDate/);
		expect(() => equipmentSharingRequestBody({ ...args, shareEndDate: '' })).toThrow(/shareEndDate/);
	});

	it.each([
		['an impossible day, which `new Date()` rolls into March', '2026-02-30'],
		['an impossible day in a date-time', '2026-04-31T09:00:00Z'],
		['a date that is not ISO 8601, which `new Date()` still reads', 'Nov 2 2026'],
		['a slashed date', '2026/11/02'],
		['an hour out of range', '2026-11-02T24:00:00Z'],
		['a minute out of range', '2026-11-02T09:60:00Z'],
		['an offset out of range', '2026-11-02T09:00:00+24:00']
	])('refuses %s (%p)', (_, value) => {
		const args = { equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: START, shareEndDate: END };

		expect(() => equipmentSharingRequestBody({ ...args, shareStartDate: value })).toThrow(/shareStartDate/);
		expect(() => equipmentSharingRequestBody({ ...args, shareEndDate: value })).toThrow(/shareEndDate/);
	});

	it.each([
		['a date', '2026-11-02', '2026-11-02T00:00:00.000Z'],
		['a UTC date-time', '2026-11-02T09:00:00Z', '2026-11-02T09:00:00.000Z'],
		['a date-time with milliseconds', '2026-11-02T09:00:00.250Z', '2026-11-02T09:00:00.250Z'],
		['a date-time with an offset', '2026-11-02T09:00:00+02:00', '2026-11-02T07:00:00.000Z'],
		['the last day of a leap February', '2028-02-29', '2028-02-29T00:00:00.000Z']
	])('reads %s (%p)', (_, value, instant) => {
		const body = equipmentSharingRequestBody({
			equipmentId: EQUIPMENT,
			shareWithEmployeeId: EMPLOYEE,
			shareStartDate: value,
			shareEndDate: '2030-01-01T00:00:00Z'
		});

		expect(body.shareStartDay.toISOString()).toBe(instant);
	});

	it('refuses a period that ends before it starts, and accepts one that ends when it starts', () => {
		const args = { equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE };

		expect(() => equipmentSharingRequestBody({ ...args, shareStartDate: END, shareEndDate: START })).toThrow(
			/shareEndDate is before shareStartDate/
		);
		expect(equipmentSharingRequestBody({ ...args, shareStartDate: START, shareEndDate: START }).shareEndDay).toEqual(
			new Date(START)
		);
	});
});

describe('request_equipment_sharing — the call the tool makes', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
	});
	afterEach(() => jest.restoreAllMocks());

	it('files the request through the request route of the caller’s organization, in the sharing’s own names', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: 'sharing-1' } as never);
		const tool = equipmentTools().get('request_equipment_sharing');

		const result = await tool({
			equipmentId: EQUIPMENT,
			shareWithEmployeeId: EMPLOYEE,
			shareStartDate: START,
			shareEndDate: END,
			reason: 'Client workshop'
		});

		expect(post).toHaveBeenCalledTimes(1);
		const [path, body] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(path).toBe(`/api/equipment-sharing/organization/${ORGANIZATION}`);
		expect(body).toEqual({
			name: 'Client workshop',
			equipmentId: EQUIPMENT,
			employees: [{ id: EMPLOYEE }],
			shareRequestDay: expect.any(Date),
			shareStartDay: new Date(START),
			shareEndDay: new Date(END),
			status: 1
		});
		// None of the names no column maps; the organization is the path's, the tenant the token's.
		for (const unmapped of [
			'shareWithEmployeeId',
			'shareStartDate',
			'shareEndDate',
			'shareRequestDate',
			'reason',
			'organizationId',
			'tenantId'
		]) {
			expect(body).not.toHaveProperty(unmapped);
		}
		expect(JSON.parse(result.content[0].text)).toEqual({ id: 'sharing-1' });
	});

	it('files an unlabelled request under the default label', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: 'sharing-1' } as never);
		const tool = equipmentTools().get('request_equipment_sharing');

		await tool({ equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: START, shareEndDate: END });

		expect((post.mock.calls[0] as [string, Record<string, unknown>])[1].name).toBe(
			EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME
		);
	});

	it('posts nothing for a period it cannot read', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({} as never);
		const tool = equipmentTools().get('request_equipment_sharing');

		await expect(
			tool({ equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: 'soon', shareEndDate: END })
		).rejects.toThrow(/Failed to request equipment sharing/);
		await expect(
			tool({ equipmentId: EQUIPMENT, shareWithEmployeeId: EMPLOYEE, shareStartDate: END, shareEndDate: START })
		).rejects.toThrow(/Failed to request equipment sharing/);
		expect(post).not.toHaveBeenCalled();
	});
});
