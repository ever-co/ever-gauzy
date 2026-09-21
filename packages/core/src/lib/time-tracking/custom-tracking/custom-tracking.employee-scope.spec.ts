/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see the note in
 * `custom-tracking.service.spec.ts`.
 */
import '../../core/entities/internal';
import { RequestContext } from '../../core/context';
import { CustomTrackingService } from './custom-tracking.service';
import { CustomTrackingSessionsQueryDTO } from './dto';

const TENANT_ID = '3f9b0d11-9d24-4a6e-9a1a-6c5a2d7a5f01';
const ORGANIZATION_ID = 'c2b7e6c0-3f7d-4a3e-9c2b-1f0e6d5a4b02';
const OWN_EMPLOYEE_ID = '5d2c1b0a-7e8f-4c3d-9a1b-0f2e3d4c5b04';
const VICTIM_EMPLOYEE_ID = '9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c06';

/**
 * `getTrackingSessions` used the `employeeIds` of the request as given, with no permission or manager
 * check, so any TIME_TRACKER holder — every default EMPLOYEE — could read a colleague's tracking
 * sessions, and with `includeDecodedData=true` their decoded payloads. The ids now go through
 * ManagedEmployeeService, which is the same gate the time-log and statistics reads use.
 */
describe('CustomTrackingService employee scoping', () => {
	let service: CustomTrackingService;
	let filterAccessibleEmployeeIds: jest.Mock;
	let getTimeSlotSessionsWithFilters: jest.SpyInstance;

	beforeEach(() => {
		filterAccessibleEmployeeIds = jest.fn().mockResolvedValue([OWN_EMPLOYEE_ID]);
		service = new CustomTrackingService(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ filterAccessibleEmployeeIds } as any
		);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: OWN_EMPLOYEE_ID } as any);
		// The query itself is out of scope here: the assertion is which employees reach it.
		getTimeSlotSessionsWithFilters = jest
			.spyOn(service as any, 'getTimeSlotSessionsWithFilters')
			.mockResolvedValue([]);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const run = (query: Partial<CustomTrackingSessionsQueryDTO>) =>
		service.getTrackingSessions({ organizationId: ORGANIZATION_ID, ...query } as CustomTrackingSessionsQueryDTO);

	it('sends the requested employee ids through the access filter rather than using them as given', async () => {
		await run({ employeeIds: [VICTIM_EMPLOYEE_ID], includeDecodedData: true } as any);

		expect(filterAccessibleEmployeeIds).toHaveBeenCalledWith([VICTIM_EMPLOYEE_ID], [], []);
		// The second argument is the employee scope the query runs with
		expect(getTimeSlotSessionsWithFilters.mock.calls[0][1]).toEqual([OWN_EMPLOYEE_ID]);
	});

	it('passes the team and project scope along, so a manager keeps their reach', async () => {
		const TEAM_ID = '7e6d5c4b-3a2f-4e1d-8c0b-9a8f7e6d5c07';
		const PROJECT_ID = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e05';

		await run({ teamIds: [TEAM_ID], projectIds: [PROJECT_ID] } as any);

		expect(filterAccessibleEmployeeIds).toHaveBeenCalledWith([], [TEAM_ID], [PROJECT_ID]);
	});

	it('falls back to the caller own employee record when the filter returns nothing', async () => {
		filterAccessibleEmployeeIds.mockResolvedValue([]);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			employeeId: OWN_EMPLOYEE_ID,
			employee: { id: OWN_EMPLOYEE_ID }
		} as any);

		await run({ employeeIds: [VICTIM_EMPLOYEE_ID] } as any);

		// The second argument is the employee scope the query runs with
		expect(getTimeSlotSessionsWithFilters.mock.calls[0][1]).toEqual([OWN_EMPLOYEE_ID]);
	});
});
