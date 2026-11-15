// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

import { ForbiddenException } from '@nestjs/common';
import { IEmployeeUpdateInput, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TRACKING_SWITCH_REFUSED } from './../../../time-tracking/timer/tracking-switch-rule';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * Follow-up of ever-co/ever-gauzy#11818: the employee subscriber turns tracking on when a write changes the start date
 * to a date or clears the end date ("back to work"), and off when it sets the end date. Where the organization restricts
 * the tracking switch to higher roles, those work-date changes count as a switch of the tracking: someone who may not
 * turn the tracking on or off may not move it through the dates either. Dates sent back as stored are left out of the
 * save, so a subscriber that cannot tell what changed never reads them as a start.
 */
describe('EmployeeUpdateHandler — work dates that would switch the tracking', () => {
	const SELF = 'employee-self';
	const OTHER = 'employee-other';
	const STORED_START = new Date('2026-01-05T00:00:00.000Z');
	const STORED_END = new Date('2026-10-30T00:00:00.000Z');

	let stored: Record<string, unknown>;
	let create: jest.Mock;
	let handler: EmployeeUpdateHandler;

	/** The caller: the user of `employeeId`, holding `role`, with only PROFILE_EDIT unless `editsEmployees`. */
	const asCaller = (role: RolesEnum, employeeId: string, editsEmployees = false) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			employeeId,
			role: { name: role }
		} as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => {
			if (permission === PermissionsEnum.PROFILE_EDIT) {
				return true;
			}
			return editsEmployees && permission === PermissionsEnum.ORG_EMPLOYEES_EDIT;
		});
	};

	/** The employee as stored, an EMPLOYEE, in an organization that restricts the switch unless `restricted` is false. */
	const storeEmployee = (
		id: string,
		values: { isTrackingEnabled: boolean; endWork?: Date | null },
		restricted = true
	) => {
		stored = {
			id,
			tenantId: 'tenant-1',
			organization: { id: 'organization-1', restrictTrackingSwitchToHigherRoles: restricted },
			startedWorkOn: STORED_START,
			endWork: values.endWork ?? null,
			isTrackingEnabled: values.isTrackingEnabled,
			user: { id: `user-of-${id}`, role: { name: RolesEnum.EMPLOYEE } }
		};
	};

	const save = (id: string, input: Record<string, unknown>) =>
		handler.execute(new EmployeeUpdateCommand(id, input as IEmployeeUpdateInput));

	beforeEach(() => {
		create = jest.fn(async (entity) => Object.assign(stored, entity));
		const findOneByIdString = jest.fn(async () => ({ ...stored }));
		handler = new EmployeeUpdateHandler(
			{ findOneByIdString, create } as never,
			{} as never,
			{ publish: jest.fn() } as never
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the organization restricts the switch, the employee edits their own profile', () => {
		it('refuses a changed start date while an admin keeps their tracking off', async () => {
			asCaller(RolesEnum.EMPLOYEE, SELF);
			storeEmployee(SELF, { isTrackingEnabled: false });

			const saving = save(SELF, { startedWorkOn: new Date('2026-11-02T00:00:00.000Z') });

			await expect(saving).rejects.toThrow(ForbiddenException);
			await expect(saving).rejects.toThrow(TRACKING_SWITCH_REFUSED);
			expect(create).not.toHaveBeenCalled();
		});

		it('refuses an end date set while their tracking is on', async () => {
			asCaller(RolesEnum.EMPLOYEE, SELF);
			storeEmployee(SELF, { isTrackingEnabled: true });

			const saving = save(SELF, { endWork: new Date('2026-11-14T00:00:00.000Z') });

			await expect(saving).rejects.toThrow(TRACKING_SWITCH_REFUSED);
			expect(create).not.toHaveBeenCalled();
		});

		it('refuses a cleared end date ("back to work") while their tracking is off', async () => {
			asCaller(RolesEnum.EMPLOYEE, SELF);
			storeEmployee(SELF, { isTrackingEnabled: false, endWork: STORED_END });

			const saving = save(SELF, { endWork: null });

			await expect(saving).rejects.toThrow(TRACKING_SWITCH_REFUSED);
			expect(create).not.toHaveBeenCalled();
		});

		it('leaves the work dates sent back as stored out of the save, and saves the rest', async () => {
			asCaller(RolesEnum.EMPLOYEE, SELF);
			storeEmployee(SELF, { isTrackingEnabled: false, endWork: STORED_END });

			await save(SELF, {
				startedWorkOn: new Date(STORED_START.getTime()),
				endWork: STORED_END.toISOString(),
				short_description: 'Edited'
			});

			expect(create).toHaveBeenCalledTimes(1);
			const written = create.mock.calls[0][0];
			expect(written).toEqual(expect.objectContaining({ id: SELF, short_description: 'Edited' }));
			expect(written).not.toHaveProperty('startedWorkOn');
			expect(written).not.toHaveProperty('endWork');
		});

		it('saves a changed start date that leaves their tracking as it is', async () => {
			asCaller(RolesEnum.EMPLOYEE, SELF);
			storeEmployee(SELF, { isTrackingEnabled: true });
			const startedWorkOn = new Date('2026-11-02T00:00:00.000Z');

			await save(SELF, { startedWorkOn });

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, startedWorkOn }));
		});
	});

	it('lets an admin change the dates of an employee whose tracking is off', async () => {
		asCaller(RolesEnum.ADMIN, OTHER, true);
		storeEmployee(SELF, { isTrackingEnabled: false, endWork: STORED_END });

		await save(SELF, { endWork: null });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, endWork: null }));
	});

	it('saves every date change as before where the organization does not restrict the switch', async () => {
		asCaller(RolesEnum.EMPLOYEE, SELF);
		storeEmployee(SELF, { isTrackingEnabled: false }, false);
		const startedWorkOn = new Date('2026-11-02T00:00:00.000Z');

		await save(SELF, { startedWorkOn });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, startedWorkOn }));
	});
});
