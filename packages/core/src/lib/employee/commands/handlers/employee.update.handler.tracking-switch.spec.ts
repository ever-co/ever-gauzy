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
 * ever-co/ever-teams#5015: only someone of a higher role may turn an employee's own time tracking switch on or off,
 * and an admin also for another admin. The switch counts in every team, so the tenant roles rank here.
 * `PUT /employee/:id` and the GraphQL `updateEmployee` both run this handler; both need ORG_EMPLOYEES_EDIT, which only
 * the admins hold by default, so the rule matters where a tenant gave it to another role.
 */
describe('EmployeeUpdateHandler — who may switch an employee’s tracking', () => {
	const SELF = 'employee-self';
	const OTHER = 'employee-other';

	let stored: Record<string, unknown>;
	let create: jest.Mock;
	let publish: jest.Mock;
	let handler: EmployeeUpdateHandler;

	/** The caller: by default the user of the employee `SELF`, holding the given role. */
	const asCaller = (role: RolesEnum, employeeId = SELF) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			employeeId,
			role: { name: role }
		} as never);
	};

	/** The employee to save, with the tenant role of their user. */
	const storeEmployee = (id: string, role: RolesEnum, isTrackingEnabled = true) => {
		stored = {
			id,
			tenantId: 'tenant-1',
			organization: { id: 'organization-1' },
			isTrackingEnabled,
			user: { id: `user-of-${id}`, role: { name: role } }
		};
	};

	const save = (id: string, input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(id, input));

	beforeEach(() => {
		publish = jest.fn();
		create = jest.fn(async (entity) => entity);
		const employeeService = { findOneByIdString: jest.fn(async () => stored), create };
		handler = new EmployeeUpdateHandler(employeeService as never, {} as never, { publish } as never);

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.ORG_EMPLOYEES_EDIT
		);
	});

	afterEach(() => jest.restoreAllMocks());

	type Case = { who: string; whom: string; callerRole: RolesEnum; id: string; targetRole: RolesEnum };

	it.each<Case>([
		{ who: 'an admin', whom: 'another admin', callerRole: RolesEnum.ADMIN, id: OTHER, targetRole: RolesEnum.ADMIN },
		{
			who: 'an admin',
			whom: 'a super admin',
			callerRole: RolesEnum.ADMIN,
			id: OTHER,
			targetRole: RolesEnum.SUPER_ADMIN
		},
		{
			who: 'a super admin',
			whom: 'an admin',
			callerRole: RolesEnum.SUPER_ADMIN,
			id: OTHER,
			targetRole: RolesEnum.ADMIN
		},
		{ who: 'an admin', whom: 'themselves', callerRole: RolesEnum.ADMIN, id: SELF, targetRole: RolesEnum.ADMIN },
		{ who: 'an admin', whom: 'a manager', callerRole: RolesEnum.ADMIN, id: OTHER, targetRole: RolesEnum.MANAGER },
		{
			who: 'an admin',
			whom: 'an employee',
			callerRole: RolesEnum.ADMIN,
			id: OTHER,
			targetRole: RolesEnum.EMPLOYEE
		},
		{
			who: 'a manager',
			whom: 'an employee',
			callerRole: RolesEnum.MANAGER,
			id: OTHER,
			targetRole: RolesEnum.EMPLOYEE
		}
	])('lets $who switch $whom', async ({ callerRole, id, targetRole }) => {
		asCaller(callerRole);
		storeEmployee(id, targetRole);

		await save(id, { isTrackingEnabled: false } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id, isTrackingEnabled: false }));
	});

	it.each<Case>([
		{
			who: 'a manager',
			whom: 'themselves',
			callerRole: RolesEnum.MANAGER,
			id: SELF,
			targetRole: RolesEnum.MANAGER
		},
		{
			who: 'a manager',
			whom: 'another manager',
			callerRole: RolesEnum.MANAGER,
			id: OTHER,
			targetRole: RolesEnum.MANAGER
		},
		{ who: 'a manager', whom: 'an admin', callerRole: RolesEnum.MANAGER, id: OTHER, targetRole: RolesEnum.ADMIN },
		{
			who: 'an employee',
			whom: 'themselves',
			callerRole: RolesEnum.EMPLOYEE,
			id: SELF,
			targetRole: RolesEnum.EMPLOYEE
		},
		{
			who: 'an employee',
			whom: 'another employee',
			callerRole: RolesEnum.EMPLOYEE,
			id: OTHER,
			targetRole: RolesEnum.EMPLOYEE
		},
		{
			who: 'an employee',
			whom: 'a manager',
			callerRole: RolesEnum.EMPLOYEE,
			id: OTHER,
			targetRole: RolesEnum.MANAGER
		},
		{ who: 'an employee', whom: 'an admin', callerRole: RolesEnum.EMPLOYEE, id: OTHER, targetRole: RolesEnum.ADMIN }
	])('refuses $who switching $whom, and saves nothing', async ({ callerRole, id, targetRole }) => {
		asCaller(callerRole);
		storeEmployee(id, targetRole);

		await expect(save(id, { isTrackingEnabled: false } as IEmployeeUpdateInput)).rejects.toThrow(
			new ForbiddenException(TRACKING_SWITCH_REFUSED)
		);

		expect(create).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it('makes a manager whose tracking was turned off wait for an admin to turn it on', async () => {
		storeEmployee(SELF, RolesEnum.MANAGER, false);

		asCaller(RolesEnum.MANAGER);
		await expect(save(SELF, { isTrackingEnabled: true } as IEmployeeUpdateInput)).rejects.toThrow(
			TRACKING_SWITCH_REFUSED
		);

		asCaller(RolesEnum.ADMIN, 'employee-admin');
		await save(SELF, { isTrackingEnabled: true } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, isTrackingEnabled: true }));
	});

	it('lets anyone save the switch back as it is, and the other fields with it', async () => {
		asCaller(RolesEnum.EMPLOYEE);
		storeEmployee(OTHER, RolesEnum.ADMIN, true);

		await save(OTHER, { isTrackingEnabled: true, short_description: 'Designer' } as IEmployeeUpdateInput);
		await save(OTHER, { short_description: 'Lead' } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('reads anything but true as off, as the timer does: a null for an employee who is off changes nothing', async () => {
		asCaller(RolesEnum.EMPLOYEE);
		storeEmployee(SELF, RolesEnum.EMPLOYEE, false);

		await save(SELF, { isTrackingEnabled: null } as unknown as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(1);
	});
});
