// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

import { ConflictException } from '@nestjs/common';
import { IEmployeeUpdateInput, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { TRACKING_SWITCH_CHANGED } from './../../../time-tracking/timer/tracking-switch-rule';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * A save made from a screen read before someone turned the tracking switch could act on a state that is gone: a
 * stale "off" sent back stopped a timer the member had started since (ever-co/ever-gauzy#11830). A save that says
 * which switch its screen showed is refused when the stored one differs, and writes nothing.
 */
describe('EmployeeUpdateHandler — the tracking switch the screen showed', () => {
	const ID = 'employee-1';

	let publish: jest.Mock;
	let create: jest.Mock;
	let writeUnderTrackingSwitchAsSeen: jest.Mock;
	let join: jest.Mock;
	let activityLog: { create: jest.Mock };
	let stored: Record<string, unknown>;
	let handler: EmployeeUpdateHandler;

	const save = (input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(ID, input));

	/** The refusal's code, or undefined when the save went through. */
	const refusalCodeOf = async (input: IEmployeeUpdateInput): Promise<string | undefined> => {
		try {
			await save(input);
			return undefined;
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictException);
			return (error as ConflictException).getResponse()['code'];
		}
	};

	beforeEach(() => {
		publish = jest.fn();
		stored = { id: ID, tenantId: 'tenant-1', organization: { id: 'organization-1' }, isTrackingEnabled: true };
		create = jest.fn(async (entity) => entity);
		const employeeService = {
			findOneByIdString: jest.fn(async () => stored),
			create,
			// The comparison made with the write has its own spec (tracking-switch-as-seen.orm-parity.spec.ts)
			writeUnderTrackingSwitchAsSeen: jest.fn()
		};
		writeUnderTrackingSwitchAsSeen = employeeService.writeUnderTrackingSwitchAsSeen;
		// The transaction's join: the services it is handed write in the save's transaction
		join = jest.fn((other) => other);
		writeUnderTrackingSwitchAsSeen.mockImplementation(async (_id, _expected, write) =>
			write(employeeService, join)
		);
		activityLog = { create: jest.fn(async (entry) => entry) };
		handler = new EmployeeUpdateHandler(employeeService as never, activityLog as never, { publish } as never);

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

	it('refuses a switch whose screen showed another state, and writes and announces nothing', async () => {
		// The screen showed tracking off, and someone turned it on since
		const input = { isTrackingEnabled: false, expectedIsTrackingEnabled: false } as IEmployeeUpdateInput;

		expect(await refusalCodeOf(input)).toBe(TRACKING_SWITCH_CHANGED);
		expect(create).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it('refuses any other save carrying a screen state that is gone', async () => {
		const input = { shortDescription: 'Designer', expectedIsTrackingEnabled: false } as IEmployeeUpdateInput;

		expect(await refusalCodeOf(input)).toBe(TRACKING_SWITCH_CHANGED);
		expect(create).not.toHaveBeenCalled();
	});

	it('turns tracking off when the screen showed it on, and never writes the flag', async () => {
		await save({ isTrackingEnabled: false, expectedIsTrackingEnabled: true } as IEmployeeUpdateInput);

		const written = create.mock.calls[0][0];
		expect(written.isTrackingEnabled).toBe(false);
		expect(written).not.toHaveProperty('expectedIsTrackingEnabled');
		expect(publish).toHaveBeenCalledTimes(1);
	});

	it('makes the save under the switch the screen showed, compared again with the write', async () => {
		await save({ isTrackingEnabled: false, expectedIsTrackingEnabled: true } as IEmployeeUpdateInput);

		expect(writeUnderTrackingSwitchAsSeen).toHaveBeenCalledWith(ID, true, expect.any(Function));
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('answers the 409 of a switch saved after the check as the 409 it is', async () => {
		writeUnderTrackingSwitchAsSeen.mockRejectedValue(
			new ConflictException({ message: 'changed', code: TRACKING_SWITCH_CHANGED })
		);

		expect(
			await refusalCodeOf({ isTrackingEnabled: false, expectedIsTrackingEnabled: true } as IEmployeeUpdateInput)
		).toBe(TRACKING_SWITCH_CHANGED);
		expect(publish).not.toHaveBeenCalled();
	});

	it('reads a stored switch that is not true as off, as the timer does', async () => {
		stored.isTrackingEnabled = null;

		await save({ isTrackingEnabled: true, expectedIsTrackingEnabled: false } as IEmployeeUpdateInput);

		expect(create).toHaveBeenCalledTimes(1);
	});

	describe('the acknowledgement of a new exit restriction', () => {
		const restricting = { allowAgentAppExit: false, acknowledgeAgentExitLogoutRestriction: true };

		it("is written in the save's transaction, after the comparison and before the save", async () => {
			await save({ ...restricting, expectedIsTrackingEnabled: true } as IEmployeeUpdateInput);

			expect(join).toHaveBeenCalledWith(activityLog);
			expect(activityLog.create).toHaveBeenCalledTimes(1);
			expect(activityLog.create.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
		});

		it('is not written when the save is refused under the switch its screen showed', async () => {
			writeUnderTrackingSwitchAsSeen.mockRejectedValue(
				new ConflictException({ message: 'changed', code: TRACKING_SWITCH_CHANGED })
			);

			expect(
				await refusalCodeOf({ ...restricting, expectedIsTrackingEnabled: true } as IEmployeeUpdateInput)
			).toBe(TRACKING_SWITCH_CHANGED);
			expect(activityLog.create).not.toHaveBeenCalled();
			expect(create).not.toHaveBeenCalled();
		});

		it('is written before the save, as before, by a save that does not say what its screen showed', async () => {
			await save(restricting as IEmployeeUpdateInput);

			expect(writeUnderTrackingSwitchAsSeen).not.toHaveBeenCalled();
			expect(activityLog.create).toHaveBeenCalledTimes(1);
			expect(activityLog.create.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
		});
	});

	it('leaves a save that does not say what its screen showed as it was', async () => {
		await save({ isTrackingEnabled: false } as IEmployeeUpdateInput);

		expect(create.mock.calls[0][0].isTrackingEnabled).toBe(false);
		expect(writeUnderTrackingSwitchAsSeen).not.toHaveBeenCalled();
		expect(publish).toHaveBeenCalledTimes(1);
	});
});
