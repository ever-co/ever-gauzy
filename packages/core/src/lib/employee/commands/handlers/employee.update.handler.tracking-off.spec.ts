// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

import { IEmployeeUpdateInput, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TrackingTurnedOffEvent } from './../../../time-tracking/timer/events/tracking-turned-off.event';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * An employee's running timer kept counting after an admin turned their tracking off. The save that turns it off now
 * announces it, and the timer module stops the timer.
 */
describe('EmployeeUpdateHandler — turning tracking off', () => {
	const ID = 'employee-1';

	let publish: jest.Mock;
	let stored: Record<string, unknown>;
	let handler: EmployeeUpdateHandler;

	const save = (input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(ID, input));

	beforeEach(() => {
		publish = jest.fn();
		stored = { id: ID, tenantId: 'tenant-1', organization: { id: 'organization-1' }, isTrackingEnabled: true };
		const employeeService = {
			findOneByIdString: jest.fn(async () => stored),
			create: jest.fn(async (entity) => entity)
		};
		handler = new EmployeeUpdateHandler(employeeService as never, {} as never, { publish } as never);

		// An admin: only a higher role, or an admin, may switch an employee's tracking (ever-co/ever-teams#5015)
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'admin',
			employeeId: null,
			role: { name: RolesEnum.ADMIN }
		} as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.ORG_EMPLOYEES_EDIT
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('announces that tracking was turned off, with the employee, organization and tenant', async () => {
		await save({ isTrackingEnabled: false } as IEmployeeUpdateInput);

		expect(publish).toHaveBeenCalledWith(
			new TrackingTurnedOffEvent({ employeeId: ID, organizationId: 'organization-1', tenantId: 'tenant-1' })
		);
	});

	it('announces nothing when tracking stays on, or was already off', async () => {
		await save({ isTrackingEnabled: true } as IEmployeeUpdateInput);
		await save({ shortDescription: 'Designer' } as IEmployeeUpdateInput);
		stored.isTrackingEnabled = false;
		await save({ isTrackingEnabled: false } as IEmployeeUpdateInput);

		expect(publish).not.toHaveBeenCalled();
	});
});
