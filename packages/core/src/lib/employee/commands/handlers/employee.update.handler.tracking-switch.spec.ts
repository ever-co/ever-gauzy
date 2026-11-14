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
 * ever-co/ever-teams#5015: where the organization turns `restrictTrackingSwitchToHigherRoles` on, only someone of a
 * higher role may turn an employee's own time tracking switch on or off, and an admin also for another admin. The switch
 * counts in every team, so the tenant roles rank here. Off, the default, the switch is saved as before.
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
	/** Runs once, right after the handler first reads the employee: lets a test change the row before the save. */
	let afterEmployeeRead: (row: Record<string, unknown>) => void;

	/** The caller: by default the user of the employee `SELF`, holding the given role. */
	const asCaller = (role: RolesEnum, employeeId = SELF) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: `user-of-${employeeId}`,
			employeeId,
			role: { name: role }
		} as never);
	};

	/**
	 * The employee to save, with the tenant role of their user, in an organization that restricts the switch to higher
	 * roles unless `restricted` says otherwise.
	 */
	const storeEmployee = (id: string, role: RolesEnum, isTrackingEnabled = true, restricted = true) => {
		stored = {
			id,
			tenantId: 'tenant-1',
			organization: { id: 'organization-1', restrictTrackingSwitchToHigherRoles: restricted },
			isTrackingEnabled,
			user: { id: `user-of-${id}`, role: { name: role } }
		};
	};

	const save = (id: string, input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(id, input));

	beforeEach(() => {
		publish = jest.fn();
		afterEmployeeRead = () => undefined;
		// The save stores what it is given in the row, as the repository would
		create = jest.fn(async (entity) => Object.assign(stored, entity));
		const findOneByIdString = jest.fn(async () => {
			const read = { ...stored };
			const changeAfterRead = afterEmployeeRead;
			afterEmployeeRead = () => undefined;
			changeAfterRead(stored);
			return read;
		});
		const employeeService = { findOneByIdString, create };
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

	it('saves the other fields of a caller who may not switch the employee, without the switch they sent back', async () => {
		asCaller(RolesEnum.EMPLOYEE);
		storeEmployee(OTHER, RolesEnum.ADMIN, true);

		await save(OTHER, { isTrackingEnabled: true, short_description: 'Designer' } as IEmployeeUpdateInput);
		await save(OTHER, { short_description: 'Lead' } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[0][0]).toMatchObject({ short_description: 'Designer' });
		expect(create.mock.calls[0][0]).not.toHaveProperty('isTrackingEnabled');
	});

	it('still saves the switch an admin sends back unchanged: they may turn it', async () => {
		asCaller(RolesEnum.ADMIN);
		storeEmployee(OTHER, RolesEnum.EMPLOYEE, true);

		await save(OTHER, { isTrackingEnabled: true } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: OTHER, isTrackingEnabled: true }));
	});

	it("does not save a stale switch over an admin's change made after the handler read the employee", async () => {
		asCaller(RolesEnum.MANAGER);
		storeEmployee(SELF, RolesEnum.MANAGER, true);
		// Their form still shows tracking on; an admin turns it off once the handler has read the employee
		afterEmployeeRead = (row) => {
			row.isTrackingEnabled = false;
		};

		await save(SELF, { isTrackingEnabled: true, short_description: 'Lead' } as IEmployeeUpdateInput);

		expect(stored).toMatchObject({ isTrackingEnabled: false, short_description: 'Lead' });
	});

	it('reads anything but true as off, as the timer does: a null for an employee who is off changes nothing', async () => {
		asCaller(RolesEnum.EMPLOYEE);
		storeEmployee(SELF, RolesEnum.EMPLOYEE, false);

		await save(SELF, { isTrackingEnabled: null } as unknown as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).not.toHaveProperty('isTrackingEnabled');
	});

	/** The default: the organization leaves the switch to whoever may edit the employee, as before the setting. */
	describe('where the organization does not restrict the switch', () => {
		it('saves a manager turning their own tracking off, as before', async () => {
			asCaller(RolesEnum.MANAGER);
			storeEmployee(SELF, RolesEnum.MANAGER, true, false);

			await save(SELF, { isTrackingEnabled: false } as IEmployeeUpdateInput);

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, isTrackingEnabled: false }));
		});

		it('saves the switch of an admin changed by a role the tenant gave ORG_EMPLOYEES_EDIT, as before', async () => {
			asCaller(RolesEnum.EMPLOYEE);
			storeEmployee(OTHER, RolesEnum.ADMIN, true, false);

			await save(OTHER, { isTrackingEnabled: false } as IEmployeeUpdateInput);

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: OTHER, isTrackingEnabled: false }));
			expect(publish).toHaveBeenCalledTimes(1);
		});

		it('reads an organization that never set the switch as not restricting it', async () => {
			asCaller(RolesEnum.MANAGER);
			storeEmployee(SELF, RolesEnum.MANAGER, true);
			stored.organization = { id: 'organization-1' };

			await save(SELF, { isTrackingEnabled: false } as IEmployeeUpdateInput);

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: SELF, isTrackingEnabled: false }));
		});
	});
});
